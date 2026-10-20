import { execute, query, queryOne, withTransaction, type PoolConnection, type RowDataPacket } from '../../config/db';
import { BusinessRuleError, notFound } from '../../lib/errors';
import { MAX_PAGE_SIZE, paginate, parseListQuery, type Paginated } from '../../lib/pagination';
import { getSettings } from '../settings/settings.service';
import { notify } from '../notifications/notifications.service';

export type ReservationStatus = 'waiting' | 'ready' | 'fulfilled' | 'expired' | 'cancelled';

interface ReservationRow extends RowDataPacket {
  id: number;
  book_id: number;
  user_id: number;
  status: ReservationStatus;
  ready_at: string | null;
  expires_at: string | null;
  note: string | null;
  created_at: string;
  book_title: string;
  book_author: string;
  cover_path: string | null;
  available_copies: number;
  full_name: string;
  member_code: string | null;
}

export interface Reservation {
  id: number;
  bookId: number;
  userId: number;
  status: ReservationStatus;
  /** 1-based place in the queue while `waiting`; null otherwise. */
  queuePosition: number | null;
  readyAt: string | null;
  expiresAt: string | null;
  note: string | null;
  createdAt: string;
  book: {
    id: number;
    title: string;
    author: string;
    coverPath: string | null;
    availableCopies: number;
  };
  member: { id: number; fullName: string; memberCode: string | null };
}

const RES_SELECT = `
  SELECT r.id, r.book_id, r.user_id, r.status, r.ready_at, r.expires_at, r.note, r.created_at,
         b.title AS book_title, b.author AS book_author, b.cover_path, b.available_copies,
         u.full_name, u.member_code
    FROM reservations r
    JOIN books b ON b.id = r.book_id
    JOIN users u ON u.id = r.user_id
`;

/**
 * Queue position is computed, never stored.
 *
 * Storing a `position` column would need a recalculation on every cancel,
 * expiry and fulfilment - three places to get wrong. Counting the earlier
 * `waiting` rows for the same book is cheap and always correct.
 */
async function withPosition(rows: ReservationRow[]): Promise<Reservation[]> {
  const out: Reservation[] = [];

  for (const row of rows) {
    let position: number | null = null;
    if (row.status === 'waiting') {
      const pos = await queryOne<RowDataPacket & { n: number }>(
        `SELECT COUNT(*) AS n FROM reservations
          WHERE book_id = ? AND status = 'waiting'
            AND (created_at < ? OR (created_at = ? AND id <= ?))`,
        [row.book_id, row.created_at, row.created_at, row.id],
      );
      position = Number(pos?.n ?? 0);
    }

    out.push({
      id: row.id,
      bookId: row.book_id,
      userId: row.user_id,
      status: row.status,
      queuePosition: position,
      readyAt: row.ready_at,
      expiresAt: row.expires_at,
      note: row.note,
      createdAt: row.created_at,
      book: {
        id: row.book_id,
        title: row.book_title,
        author: row.book_author,
        coverPath: row.cover_path,
        availableCopies: Number(row.available_copies),
      },
      member: {
        id: row.user_id,
        fullName: row.full_name,
        memberCode: row.member_code,
      },
    });
  }

  return out;
}

/**
 * Marks every `ready` reservation whose hold window has passed as `expired`
 * and tells the member.
 *
 * This runs on read instead of in a cron job, for the same reason `overdue` is
 * derived: a scheduled job needs the server to be running at the right moment,
 * and when it is not, the data silently drifts.
 */
export async function expireStaleReservations(): Promise<number> {
  const stale = await query<RowDataPacket & { id: number; user_id: number; book_id: number; title: string }>(
    `SELECT r.id, r.user_id, r.book_id, b.title
       FROM reservations r
       JOIN books b ON b.id = r.book_id
      WHERE r.status = 'ready' AND r.expires_at IS NOT NULL AND r.expires_at < NOW()`,
  );

  if (stale.length === 0) return 0;

  const ids = stale.map((r) => r.id);
  await execute(
    `UPDATE reservations SET status = 'expired' WHERE id IN (${ids.map(() => '?').join(',')})`,
    ids,
  );

  await Promise.all(
    stale.map((r) =>
      notify({
        userId: r.user_id,
        type: 'reservation.expired',
        title: 'Masa ambil reservasi habis',
        body: `Buku "${r.title}" tidak diambil dalam batas waktu. Silakan pesan ulang bila masih ingin membacanya.`,
        link: '/perpustakaan/reservasi',
        dedupeKey: `res-expired-${r.id}`,
      }),
    ),
  );

  return stale.length;
}

export async function listReservations(params: {
  status?: 'all' | ReservationStatus;
  bookId?: number;
  userId?: number;
  page?: number;
  pageSize?: number;
}): Promise<Paginated<Reservation>> {
  await expireStaleReservations();

  const where: string[] = [];
  const args: unknown[] = [];

  if (params.status && params.status !== 'all') {
    where.push('r.status = ?');
    args.push(params.status);
  }
  if (params.bookId) {
    where.push('r.book_id = ?');
    args.push(params.bookId);
  }
  if (params.userId) {
    where.push('r.user_id = ?');
    args.push(params.userId);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const listQuery = parseListQuery(
    { page: params.page, pageSize: params.pageSize, sort: 'created_at', direction: 'ASC' },
    ['created_at'],
    'created_at',
  );

  const countRows = await query<RowDataPacket & { total: number }>(
    `SELECT COUNT(*) AS total FROM reservations r ${whereSql}`,
    args,
  );
  const total = Number(countRows[0]?.total ?? 0);

  const rows = await query<ReservationRow>(
    `${RES_SELECT} ${whereSql}
      ORDER BY r.created_at ASC, r.id ASC
      LIMIT ? OFFSET ?`,
    [...args, listQuery.pageSize, listQuery.offset],
  );

  return paginate(await withPosition(rows), total, listQuery);
}

/**
 * A member's own queue is never long enough to page through, so this keeps the
 * simple array shape the UI already consumes.
 */
export async function listMyReservations(userId: number): Promise<Reservation[]> {
  const result = await listReservations({ userId, pageSize: MAX_PAGE_SIZE });
  return result.items;
}

/**
 * Member joins the queue for a title.
 *
 * Allowed even when a copy is on the shelf: the member may simply be planning
 * ahead. The queue only becomes meaningful once stock runs out.
 */
export async function createReservation(userId: number, bookId: number, note?: string): Promise<Reservation> {
  await expireStaleReservations();

  const book = await queryOne<RowDataPacket & { id: number; title: string; status: string }>(
    'SELECT id, title, status FROM books WHERE id = ?',
    [bookId],
  );
  if (!book) throw notFound('Buku tidak ditemukan.');
  if (book.status !== 'active') {
    throw new BusinessRuleError('Buku ini sedang dinonaktifkan sehingga tidak dapat dipesan.', 'BOOK_INACTIVE');
  }

  const duplicate = await queryOne<RowDataPacket & { id: number }>(
    `SELECT id FROM reservations
      WHERE user_id = ? AND book_id = ? AND status IN ('waiting','ready')
      LIMIT 1`,
    [userId, bookId],
  );
  if (duplicate) {
    throw new BusinessRuleError(
      'Anda sudah memiliki antrean aktif untuk buku ini.',
      'DUPLICATE_RESERVATION',
    );
  }

  // Without a cap, one member can queue for the entire catalogue and starve
  // everyone else. The limit is a setting because schools differ.
  const settings = await getSettings();
  const active = await queryOne<RowDataPacket & { total: number }>(
    `SELECT COUNT(*) AS total FROM reservations
      WHERE user_id = ? AND status IN ('waiting','ready')`,
    [userId],
  );
  if (Number(active?.total ?? 0) >= settings.maxReservationsPerUser) {
    throw new BusinessRuleError(
      `Antrean aktif Anda sudah mencapai batas ${settings.maxReservationsPerUser} judul. Selesaikan atau batalkan salah satu terlebih dahulu.`,
      'RESERVATION_LIMIT',
    );
  }

  // Holding a copy (or having a pending request) makes a reservation pointless.
  const activeLoan = await queryOne<RowDataPacket & { id: number }>(
    `SELECT id FROM loans
      WHERE user_id = ? AND book_id = ?
        AND status IN ('pending','approved','borrowed','return_requested')
      LIMIT 1`,
    [userId, bookId],
  );
  if (activeLoan) {
    throw new BusinessRuleError(
      'Anda sudah meminjam atau mengajukan buku ini.',
      'DUPLICATE_LOAN',
    );
  }

  const result = await execute(
    `INSERT INTO reservations (book_id, user_id, note) VALUES (?, ?, ?)`,
    [bookId, userId, note ?? null],
  );

  const row = await queryOne<ReservationRow>(`${RES_SELECT} WHERE r.id = ?`, [result.insertId]);
  if (!row) throw notFound('Reservasi gagal dibuat.');
  const [reservation] = await withPosition([row]);
  return reservation;
}

export async function cancelReservation(
  id: number,
  byUserId: number,
  isAdmin: boolean,
): Promise<Reservation> {
  const row = await queryOne<ReservationRow>(`${RES_SELECT} WHERE r.id = ?`, [id]);
  if (!row) throw notFound('Reservasi tidak ditemukan.');
  if (!isAdmin && row.user_id !== byUserId) throw notFound('Reservasi tidak ditemukan.');

  if (row.status !== 'waiting' && row.status !== 'ready') {
    throw new BusinessRuleError(
      `Reservasi berstatus "${row.status}" tidak dapat dibatalkan.`,
      'INVALID_STATE',
    );
  }

  await execute("UPDATE reservations SET status = 'cancelled' WHERE id = ?", [id]);

  const updated = await queryOne<ReservationRow>(`${RES_SELECT} WHERE r.id = ?`, [id]);
  if (!updated) throw notFound('Reservasi tidak ditemukan.');
  const [reservation] = await withPosition([updated]);
  return reservation;
}

/**
 * Called after a copy comes back on the shelf.
 *
 * Promotes the oldest waiting member to `ready`, gives them a hold window, and
 * notifies them. Runs inside the caller's transaction so the queue state and
 * the stock change commit together.
 */
export async function promoteNextInQueue(
  conn: PoolConnection,
  bookId: number,
  bookTitle: string,
): Promise<void> {
  const settings = await getSettings();

  const [stockRows] = await conn.query<RowDataPacket[]>(
    'SELECT available_copies FROM books WHERE id = ? FOR UPDATE',
    [bookId],
  );
  const available = Number(stockRows[0]?.available_copies ?? 0);
  if (available <= 0) return;

  const [readyRows] = await conn.query<RowDataPacket[]>(
    "SELECT id FROM reservations WHERE book_id = ? AND status = 'ready' LIMIT 1",
    [bookId],
  );
  // One ready hold at a time per title: the shelf copy is spoken for.
  if (readyRows.length > 0) return;

  const [nextRows] = await conn.query<RowDataPacket[]>(
    `SELECT id, user_id FROM reservations
      WHERE book_id = ? AND status = 'waiting'
      ORDER BY created_at ASC, id ASC
      LIMIT 1`,
    [bookId],
  );
  const next = nextRows[0];
  if (!next) return;

  await conn.execute(
    `UPDATE reservations
        SET status = 'ready', ready_at = NOW(),
            expires_at = DATE_ADD(NOW(), INTERVAL ? DAY)
      WHERE id = ?`,
    [settings.reservationHoldDays, next.id],
  );

  await notify({
    userId: Number(next.user_id),
    type: 'reservation.ready',
    title: 'Buku pesanan Anda tersedia',
    body: `"${bookTitle}" sudah tersedia. Ambil dalam ${settings.reservationHoldDays} hari sebelum pesanan dilepas.`,
    link: '/perpustakaan/reservasi',
    dedupeKey: `res-ready-${next.id}`,
  });
}

/** Count of people waiting for a title. Used to block renewals. */
export async function waitingCount(bookId: number): Promise<number> {
  const row = await queryOne<RowDataPacket & { n: number }>(
    "SELECT COUNT(*) AS n FROM reservations WHERE book_id = ? AND status IN ('waiting','ready')",
    [bookId],
  );
  return Number(row?.n ?? 0);
}

/** Closes the reservation once the member actually borrows the book. */
export async function fulfilReservation(
  conn: PoolConnection,
  bookId: number,
  userId: number,
): Promise<void> {
  await conn.execute(
    `UPDATE reservations
        SET status = 'fulfilled'
      WHERE book_id = ? AND user_id = ? AND status IN ('waiting','ready')`,
    [bookId, userId],
  );
}

/** Admin view: which titles have people waiting. */
export async function queueOverview(): Promise<
  Array<{ bookId: number; title: string; waiting: number; ready: number }>
> {
  await expireStaleReservations();

  const rows = await query<RowDataPacket & Record<string, any>>(
    `SELECT b.id AS bookId, b.title,
            SUM(r.status = 'waiting') AS waiting,
            SUM(r.status = 'ready') AS ready
       FROM reservations r
       JOIN books b ON b.id = r.book_id
      WHERE r.status IN ('waiting','ready')
      GROUP BY b.id, b.title
      ORDER BY waiting DESC, b.title ASC`,
  );

  return rows.map((r) => ({
    bookId: Number(r.bookId),
    title: r.title,
    waiting: Number(r.waiting ?? 0),
    ready: Number(r.ready ?? 0),
  }));
}

export { withTransaction };
