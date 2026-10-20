import { execute, query, queryOne, type PoolConnection, type RowDataPacket } from '../../config/db';
import { notFound } from '../../lib/errors';
import { escapeLike, paginate, parseListQuery, type Paginated } from '../../lib/pagination';

export type FineKind = 'late' | 'damaged' | 'lost';
export type FineStatus = 'unpaid' | 'paid' | 'waived';

interface FineRow extends RowDataPacket {
  id: number;
  loan_id: number;
  user_id: number;
  kind: FineKind;
  amount: number;
  status: FineStatus;
  settled_at: string | null;
  note: string | null;
  created_at: string;
  loan_code: string;
  book_title: string;
  book_id: number;
  full_name: string;
  member_code: string | null;
  class_name: string | null;
}

export interface Fine {
  id: number;
  loanId: number;
  loanCode: string;
  userId: number;
  kind: FineKind;
  amount: number;
  status: FineStatus;
  settledAt: string | null;
  note: string | null;
  createdAt: string;
  book: { id: number; title: string };
  member: { id: number; fullName: string; memberCode: string | null; className: string | null };
}

const FINE_SELECT = `
  SELECT f.id, f.loan_id, f.user_id, f.kind, f.amount, f.status,
         f.settled_at, f.note, f.created_at,
         l.loan_code, b.id AS book_id, b.title AS book_title,
         u.full_name, u.member_code, u.class_name
    FROM fines f
    JOIN loans l ON l.id = f.loan_id
    JOIN books b ON b.id = l.book_id
    JOIN users u ON u.id = f.user_id
`;

function toFine(row: FineRow): Fine {
  return {
    id: row.id,
    loanId: row.loan_id,
    loanCode: row.loan_code,
    userId: row.user_id,
    kind: row.kind,
    amount: Number(row.amount),
    status: row.status,
    settledAt: row.settled_at,
    note: row.note,
    createdAt: row.created_at,
    book: { id: row.book_id, title: row.book_title },
    member: {
      id: row.user_id,
      fullName: row.full_name,
      memberCode: row.member_code,
      className: row.class_name,
    },
  };
}

/**
 * Records a fine.
 *
 * `INSERT IGNORE` is deliberate: the unique key is (loan_id, kind), so a
 * double-clicked return or a retried request cannot bill the same thing twice.
 * Returns the amount actually charged (0 when the fine already existed).
 */
export async function createFine(
  conn: PoolConnection,
  input: {
    loanId: number;
    userId: number;
    kind: FineKind;
    amount: number;
    note?: string | null;
  },
): Promise<number> {
  if (input.amount <= 0) return 0;

  const [result] = await conn.execute(
    `INSERT IGNORE INTO fines (loan_id, user_id, kind, amount, note)
     VALUES (?, ?, ?, ?, ?)`,
    [input.loanId, input.userId, input.kind, Math.round(input.amount), input.note ?? null],
  );

  return (result as { affectedRows?: number }).affectedRows ? Math.round(input.amount) : 0;
}

export async function listFines(params: {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: 'all' | FineStatus;
  kind?: 'all' | FineKind;
  userId?: number;
  from?: string;
  to?: string;
}): Promise<Paginated<Fine>> {
  const q = parseListQuery(
    { page: params.page, pageSize: params.pageSize, sort: 'created_at', direction: 'DESC' },
    ['created_at', 'amount'],
    'created_at',
  );

  const where: string[] = [];
  const args: unknown[] = [];

  if (params.status && params.status !== 'all') {
    where.push('f.status = ?');
    args.push(params.status);
  }
  if (params.kind && params.kind !== 'all') {
    where.push('f.kind = ?');
    args.push(params.kind);
  }
  if (params.userId) {
    where.push('f.user_id = ?');
    args.push(params.userId);
  }
  if (params.search) {
    where.push('(u.full_name LIKE ? OR l.loan_code LIKE ? OR b.title LIKE ?)');
    const like = `%${escapeLike(params.search)}%`;
    args.push(like, like, like);
  }
  if (params.from) {
    where.push('f.created_at >= ?');
    args.push(params.from);
  }
  if (params.to) {
    // `< to + 1 day` rather than `<= to`: `to` is a date, and comparing a DATE
    // against a DATETIME column would silently drop everything recorded after
    // midnight on the final day.
    where.push('f.created_at < DATE_ADD(?, INTERVAL 1 DAY)');
    args.push(params.to);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const totalRow = await query<RowDataPacket & { total: number }>(
    `SELECT COUNT(*) AS total FROM fines f
       JOIN loans l ON l.id = f.loan_id
       JOIN books b ON b.id = l.book_id
       JOIN users u ON u.id = f.user_id
     ${whereSql}`,
    args,
  );
  const total = Number(totalRow[0]?.total ?? 0);

  const rows = await query<FineRow>(
    `${FINE_SELECT} ${whereSql}
      ORDER BY f.created_at DESC, f.id DESC
      LIMIT ? OFFSET ?`,
    [...args, q.pageSize, q.offset],
  );

  return paginate(rows.map(toFine), total, q);
}

/** Fines belonging to one member, newest first. */
export async function listMyFines(
  userId: number,
  params: { page?: number; pageSize?: number; status?: 'all' | FineStatus },
): Promise<Paginated<Fine>> {
  return listFines({ ...params, userId });
}

export interface FineSummary {
  unpaidCount: number;
  unpaidTotal: number;
  paidTotal: number;
  waivedTotal: number;
}

export async function getFineSummary(
  userId?: number,
  range?: { from?: string; to?: string },
): Promise<FineSummary> {
  const where: string[] = [];
  const args: unknown[] = [];

  if (userId) {
    where.push('user_id = ?');
    args.push(userId);
  }
  if (range?.from) {
    where.push('created_at >= ?');
    args.push(range.from);
  }
  if (range?.to) {
    where.push('created_at < DATE_ADD(?, INTERVAL 1 DAY)');
    args.push(range.to);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const row = await queryOne<RowDataPacket & Record<string, number>>(
    `SELECT
       COALESCE(SUM(status = 'unpaid'), 0) AS unpaid_count,
       COALESCE(SUM(CASE WHEN status = 'unpaid' THEN amount ELSE 0 END), 0) AS unpaid_total,
       COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) AS paid_total,
       COALESCE(SUM(CASE WHEN status = 'waived' THEN amount ELSE 0 END), 0) AS waived_total
     FROM fines ${whereSql}`,
    args,
  );

  return {
    unpaidCount: Number(row?.unpaid_count ?? 0),
    unpaidTotal: Number(row?.unpaid_total ?? 0),
    paidTotal: Number(row?.paid_total ?? 0),
    waivedTotal: Number(row?.waived_total ?? 0),
  };
}

/** Total the member still owes. Used to gate borrowing when the rule is on. */
export async function unpaidTotalFor(userId: number): Promise<number> {
  const row = await queryOne<RowDataPacket & { total: number }>(
    `SELECT COALESCE(SUM(amount), 0) AS total
       FROM fines WHERE user_id = ? AND status = 'unpaid'`,
    [userId],
  );
  return Number(row?.total ?? 0);
}

export async function settleFine(
  fineId: number,
  adminId: number,
  action: 'pay' | 'waive',
  note?: string,
): Promise<Fine> {
  const existing = await queryOne<RowDataPacket & { id: number; status: FineStatus }>(
    'SELECT id, status FROM fines WHERE id = ?',
    [fineId],
  );
  if (!existing) throw notFound('Denda tidak ditemukan.');

  // Settling an already-settled fine is a no-op rather than an error: the
  // cashier may click twice, and the outcome they wanted is already true.
  if (existing.status === 'unpaid') {
    await execute(
      `UPDATE fines
          SET status = ?, settled_at = NOW(), settled_by = ?, note = COALESCE(?, note)
        WHERE id = ?`,
      [action === 'pay' ? 'paid' : 'waived', adminId, note ?? null, fineId],
    );
  }

  const row = await queryOne<FineRow>(`${FINE_SELECT} WHERE f.id = ?`, [fineId]);
  if (!row) throw notFound('Denda tidak ditemukan.');
  return toFine(row);
}

export async function getFineById(fineId: number): Promise<Fine> {
  const row = await queryOne<FineRow>(`${FINE_SELECT} WHERE f.id = ?`, [fineId]);
  if (!row) throw notFound('Denda tidak ditemukan.');
  return toFine(row);
}

/** Fines attached to one loan, so the loan detail can show its bill. */
export async function listFinesForLoan(loanId: number): Promise<Fine[]> {
  const rows = await query<FineRow>(`${FINE_SELECT} WHERE f.loan_id = ? ORDER BY f.id ASC`, [loanId]);
  return rows.map(toFine);
}
