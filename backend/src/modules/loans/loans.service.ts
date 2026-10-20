import crypto from 'node:crypto';
import {
  execute,
  query,
  queryOne,
  withTransaction,
  type PoolConnection,
  type RowDataPacket,
} from '../../config/db';
import { BusinessRuleError, conflict, notFound } from '../../lib/errors';
import { escapeLike, paginate, parseListQuery, type Paginated } from '../../lib/pagination';
import { getSettings, type LibrarySettings } from '../settings/settings.service';
import { createFine, listFinesForLoan, unpaidTotalFor, type Fine } from '../fines/fines.service';
import { resolveDueDays } from '../holidays/holidays.service';
import { notify, notifyAdmins } from '../notifications/notifications.service';
import { promoteNextInQueue, waitingCount, fulfilReservation } from '../reservations/reservations.service';
import type {
  ConfirmReturnInput,
  CounterLoanInput,
  LoanQuery,
  RenewLoanInput,
  RejectLoanInput,
} from './loans.schema';
import {
  canTransition,
  OUT_WITH_MEMBER,
  type DisplayStatus,
  type LoanStatus,
} from './loans.types';

interface LoanRow extends RowDataPacket {
  id: number;
  loan_code: string;
  user_id: number;
  book_id: number;
  quantity: number;
  renew_count: number;
  status: LoanStatus;
  display_status: DisplayStatus;
  requested_at: string;
  approved_at: string | null;
  approved_by: number | null;
  pickup_deadline: string | null;
  rejected_at: string | null;
  rejected_reason: string | null;
  borrowed_at: string | null;
  due_at: string | null;
  return_requested_at: string | null;
  returned_at: string | null;
  return_condition: string | null;
  return_note: string | null;
  admin_note: string | null;
  created_at: string;
  title: string;
  author: string;
  isbn: string;
  cover_path: string | null;
  category_id: number | null;
  category_name: string | null;
  available_copies: number;
  full_name: string;
  member_code: string | null;
  username: string;
  days_late: number | null;
  late_fee: number | null;
  unpaid_total: number | null;
}

export interface Loan {
  id: number;
  loanCode: string;
  userId: number;
  bookId: number;
  quantity: number;
  renewCount: number;
  status: LoanStatus;
  displayStatus: DisplayStatus;
  requestedAt: string;
  approvedAt: string | null;
  pickupDeadline: string | null;
  borrowedAt: string | null;
  dueAt: string | null;
  returnRequestedAt: string | null;
  returnedAt: string | null;
  rejectedReason: string | null;
  returnCondition: string | null;
  returnNote: string | null;
  adminNote: string | null;
  daysLate: number | null;
  lateFee: number | null;
  /** Money the member still owes across all loans, fines included. */
  unpaidFines: number;
  book: {
    id: number;
    title: string;
    author: string;
    isbn: string;
    coverPath: string | null;
    categoryId: number | null;
    categoryName: string | null;
    availableCopies: number;
  };
  member: {
    id: number;
    fullName: string;
    username: string;
    memberCode: string | null;
  };
}

function toLoan(row: LoanRow, settings?: LibrarySettings): Loan {
  const daysLate =
    row.days_late !== null && row.days_late !== undefined
      ? Number(row.days_late)
      : computeDaysLate(row.due_at, row.returned_at, row.status);

  return {
    id: row.id,
    loanCode: row.loan_code,
    userId: row.user_id,
    bookId: row.book_id,
    quantity: row.quantity,
    renewCount: Number(row.renew_count ?? 0),
    status: row.status,
    displayStatus: row.display_status,
    requestedAt: row.requested_at,
    approvedAt: row.approved_at,
    pickupDeadline: row.pickup_deadline,
    borrowedAt: row.borrowed_at,
    dueAt: row.due_at,
    returnRequestedAt: row.return_requested_at,
    returnedAt: row.returned_at,
    rejectedReason: row.rejected_reason,
    returnCondition: row.return_condition,
    returnNote: row.return_note,
    adminNote: row.admin_note,
    daysLate,
    lateFee: settings && daysLate !== null && daysLate > 0 ? daysLate * settings.lateFeePerDay : null,
    unpaidFines: Number(row.unpaid_total ?? 0),
    book: {
      id: row.book_id,
      title: row.title,
      author: row.author,
      isbn: row.isbn,
      coverPath: row.cover_path,
      categoryId: row.category_id,
      categoryName: row.category_name ?? null,
      availableCopies: row.available_copies,
    },
    member: {
      id: row.user_id,
      fullName: row.full_name,
      username: row.username,
      memberCode: row.member_code,
    },
  };
}

function computeDaysLate(dueAt: string | null, returnedAt: string | null, status: LoanStatus): number | null {
  if (!dueAt) return null;
  if (!OUT_WITH_MEMBER.includes(status)) return null;
  const due = new Date(dueAt.replace(' ', 'T')).getTime();
  const end = returnedAt
    ? new Date(returnedAt.replace(' ', 'T')).getTime()
    : Date.now();
  const diffDays = Math.floor((end - due) / 86_400_000);
  return diffDays > 0 ? diffDays : 0;
}

/** Shared FROM/JOIN tail, so the COUNT query can reuse it without nesting two SELECTs. */
const LOAN_FROM = `
  FROM loans l
  JOIN books b ON b.id = l.book_id
  JOIN users u ON u.id = l.user_id
  LEFT JOIN categories c ON c.id = b.category_id
`;

const LOAN_SELECT = `
  SELECT
    l.id, l.loan_code, l.user_id, l.book_id, l.quantity, l.renew_count, l.status,
    l.requested_at, l.approved_at, l.approved_by, l.pickup_deadline,
    l.rejected_at, l.rejected_reason,
    l.borrowed_at, l.due_at, l.return_requested_at, l.returned_at,
    l.return_condition, l.return_note, l.admin_note, l.created_at,
    CASE
      WHEN l.status IN ('borrowed','return_requested')
           AND l.due_at IS NOT NULL AND l.due_at < NOW()
      THEN 'overdue'
      WHEN l.status = 'approved'
           AND l.pickup_deadline IS NOT NULL AND l.pickup_deadline < NOW()
      THEN 'pickup_expired'
      ELSE l.status
    END AS display_status,
    b.title, b.author, b.isbn, b.cover_path, b.category_id, b.available_copies,
    c.name AS category_name,
    u.full_name, u.member_code, u.username,
    (SELECT COALESCE(SUM(f.amount), 0) FROM fines f
      WHERE f.user_id = l.user_id AND f.status = 'unpaid') AS unpaid_total
  ${LOAN_FROM}
`;

/**
 * A request that was approved but never collected.
 *
 * Derived, not stored - same reasoning as `overdue`. The pickup window is
 * fixed on the row at approval time, so changing the setting later does not
 * resurrect an expired hold.
 */
const PICKUP_EXPIRED_EXPR =
  "(l.status = 'approved' AND l.pickup_deadline IS NOT NULL AND l.pickup_deadline < NOW())";

function buildLoanFilters(q: LoanQuery, scopeUserId?: number) {
  const where: string[] = [];
  const args: unknown[] = [];

  // Ownership scoping: a non-admin can only ever see their own rows.
  if (scopeUserId) {
    where.push('l.user_id = ?');
    args.push(scopeUserId);
  } else if (q.userId) {
    where.push('l.user_id = ?');
    args.push(q.userId);
  }

  if (q.bookId) {
    where.push('l.book_id = ?');
    args.push(q.bookId);
  }
  if (q.categoryId) {
    where.push('b.category_id = ?');
    args.push(q.categoryId);
  }
  if (q.search) {
    where.push('(b.title LIKE ? OR u.full_name LIKE ? OR l.loan_code LIKE ?)');
    const like = `%${escapeLike(q.search)}%`;
    args.push(like, like, like);
  }

  const overdueExpr = "(l.status IN ('borrowed','return_requested') AND l.due_at IS NOT NULL AND l.due_at < NOW())";

  switch (q.status) {
    case 'pending':
      where.push("l.status = 'pending'");
      break;
    case 'approved':
      where.push("l.status = 'approved'");
      break;
    case 'rejected':
      where.push("l.status = 'rejected'");
      break;
    case 'borrowed':
      where.push("l.status = 'borrowed'");
      break;
    case 'return_requested':
      where.push("l.status = 'return_requested'");
      break;
    case 'returned':
      where.push("l.status = 'returned'");
      break;
    case 'cancelled':
      where.push("l.status = 'cancelled'");
      break;
    case 'overdue':
      where.push(overdueExpr);
      break;
    case 'pickup_expired':
      where.push(PICKUP_EXPIRED_EXPR);
      break;
    case 'active':
      where.push("l.status IN ('approved','borrowed','return_requested')");
      break;
    default:
      break;
  }

  if (q.from) {
    where.push('DATE(l.requested_at) >= ?');
    args.push(q.from);
  }
  if (q.to) {
    where.push('DATE(l.requested_at) <= ?');
    args.push(q.to);
  }

  return { whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '', args };
}

export async function listLoans(params: LoanQuery, scopeUserId?: number): Promise<Paginated<Loan>> {
  const { whereSql, args } = buildLoanFilters(params, scopeUserId);
  const settings = await getSettings();

  const listQuery = parseListQuery(
    {
      page: params.page,
      pageSize: params.pageSize,
      sort: params.sort,
      direction: params.direction,
    },
    ['requested_at', 'due_at', 'returned_at', 'title', 'full_name', 'status'],
    'requested_at',
  );

  const totalRow = await query<RowDataPacket & { total: number }>(
    `SELECT COUNT(*) AS total ${LOAN_FROM} ${whereSql}`,
    args,
  );
  const total = Number(totalRow[0]?.total ?? 0);

  // The ORDER BY key is whitelisted; user text is only ever passed as a bind param.
  const sortExpr: Record<string, string> = {
    requested_at: 'l.requested_at',
    due_at: 'l.due_at',
    returned_at: 'l.returned_at',
    title: 'b.title',
    full_name: 'u.full_name',
    status: 'l.status',
  };
  const orderBy = sortExpr[listQuery.sort] ?? 'l.requested_at';

  const rows = await query<LoanRow>(
    `${LOAN_SELECT} ${whereSql}
     ORDER BY ${orderBy} ${listQuery.direction}, l.id DESC
     LIMIT ? OFFSET ?`,
    [...args, listQuery.pageSize, listQuery.offset],
  );

  return paginate(rows.map((r) => toLoan(r, settings)), total, listQuery);
}

export async function getLoanById(id: number, scopeUserId?: number): Promise<Loan> {
  const row = await queryOne<LoanRow>(`${LOAN_SELECT} WHERE l.id = ? LIMIT 1`, [id]);
  if (!row) throw notFound('Transaksi tidak ditemukan.');
  if (scopeUserId && row.user_id !== scopeUserId) {
    // 404, not 403: a member must not be able to probe whether another
    // member's transaction id exists.
    throw notFound('Transaksi tidak ditemukan.');
  }
  return toLoan(row, await getSettings());
}

/** Loan detail plus the fines attached to it. */
export async function getLoanDetail(
  id: number,
  scopeUserId?: number,
): Promise<{ loan: Loan; fines: Fine[] }> {
  const loan = await getLoanById(id, scopeUserId);
  return { loan, fines: await listFinesForLoan(id) };
}

async function loadLoanForUpdate(conn: PoolConnection, id: number): Promise<LoanRow> {
  const [rows] = await conn.query<LoanRow[]>(`${LOAN_SELECT} WHERE l.id = ? FOR UPDATE`, [id]);
  const row = rows[0];
  if (!row) throw notFound('Transaksi tidak ditemukan.');
  return row;
}

async function nextLoanCode(conn: PoolConnection): Promise<string> {
  // The date segment comes from MySQL, not `new Date().toISOString()`: the
  // latter is UTC, so every loan created before 07:00 local time would be
  // stamped with yesterday's date.
  const [stampRows] = await conn.query<RowDataPacket[]>(
    "SELECT DATE_FORMAT(NOW(), '%Y%m%d') AS stamp",
  );
  const stamp = String(stampRows[0]?.stamp ?? '');
  const prefix = `LN-${stamp}-`;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const candidate = `${prefix}${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const [rows] = await conn.query<RowDataPacket[]>(
      'SELECT id FROM loans WHERE loan_code = ? LIMIT 1',
      [candidate],
    );
    if (rows.length === 0) return candidate;
  }
  throw conflict('Gagal membuat kode transaksi. Silakan coba lagi.');
}

/** Counts how many copies this member currently holds (reserved or out). */
async function countHeldCopies(conn: PoolConnection, userId: number): Promise<number> {
  const [rows] = await conn.query<RowDataPacket[]>(
    `SELECT COALESCE(SUM(quantity), 0) AS held
       FROM loans
      WHERE user_id = ? AND status IN ('approved','borrowed','return_requested')`,
    [userId],
  );
  return Number(rows[0]?.held ?? 0);
}

/**
 * Shared guard for "may this member borrow right now?".
 *
 * Kept in one place because three entry points (member request, admin approval,
 * counter loan) must all enforce the same rules; duplicating them is how the
 * three drift apart.
 */
async function assertBorrowAllowed(
  conn: PoolConnection,
  userId: number,
  settings: LibrarySettings,
  additionalCopies = 1,
): Promise<void> {
  const [userRows] = await conn.query<RowDataPacket[]>(
    'SELECT id, status, role FROM users WHERE id = ? FOR UPDATE',
    [userId],
  );
  const user = userRows[0];
  if (!user) throw notFound('Anggota tidak ditemukan.');
  if (user.status !== 'active') {
    throw new BusinessRuleError('Akun Anda dinonaktifkan sehingga tidak dapat meminjam.', 'ACCOUNT_INACTIVE');
  }

  const held = await countHeldCopies(conn, userId);
  if (held + additionalCopies > settings.maxLoanPerUser) {
    throw new BusinessRuleError(
      `Anggota sudah memegang ${held} buku. Maksimal ${settings.maxLoanPerUser} buku.`,
      'LOAN_LIMIT_REACHED',
    );
  }

  if (settings.fineBlockBorrow) {
    const owed = await unpaidTotalFor(userId);
    if (owed > 0) {
      throw new BusinessRuleError(
        `Masih ada denda belum lunas sebesar Rp${owed.toLocaleString('id-ID')}. Lunasi dulu di meja petugas.`,
        'UNPAID_FINES',
      );
    }
  }
}

/** Decrements stock, refusing to go negative even if the caller is wrong. */
async function reserveCopy(conn: PoolConnection, bookId: number, quantity = 1): Promise<void> {
  const [bookRows] = await conn.query<
    (RowDataPacket & { available_copies: number; status: string; title: string })[]
  >('SELECT available_copies, status, title FROM books WHERE id = ? FOR UPDATE', [bookId]);

  const book = bookRows[0];
  if (!book) throw notFound('Buku tidak ditemukan.');
  if (book.status !== 'active') {
    throw new BusinessRuleError('Buku ini sedang dinonaktifkan dan tidak dapat dipinjam.', 'BOOK_INACTIVE');
  }
  if (book.available_copies < quantity) {
    throw new BusinessRuleError('Stok buku sedang habis. Silakan coba lagi nanti.', 'NO_STOCK');
  }

  await conn.execute(
    'UPDATE books SET available_copies = available_copies - ? WHERE id = ?',
    [quantity, bookId],
  );
}

/** Puts copies back on the shelf, never above the total. */
async function releaseCopy(conn: PoolConnection, bookId: number, quantity = 1): Promise<void> {
  await conn.execute(
    'UPDATE books SET available_copies = LEAST(available_copies + ?, total_copies) WHERE id = ?',
    [quantity, bookId],
  );
}

export interface RequestResult {
  loan: Loan;
  requiresApproval: boolean;
}

/**
 * Student submits a borrow request.
 *
 * When `require_approval` is off the copy is reserved and the loan goes
 * straight to `borrowed` in one transaction. Otherwise it is stored as
 * `pending` and an admin decides later.
 */
export async function requestLoan(
  userId: number,
  bookId: number,
  note?: string,
): Promise<RequestResult> {
  const settings = await getSettings();
  let loanId = 0;

  await withTransaction(async (conn) => {
    const [userRows] = await conn.query<RowDataPacket[]>(
      "SELECT id, status, role FROM users WHERE id = ? FOR UPDATE",
      [userId],
    );
    const user = userRows[0];
    if (!user) throw notFound('Anggota tidak ditemukan.');
    if (user.role !== 'user') {
      throw new BusinessRuleError(
        'Fitur peminjaman hanya untuk akun siswa. Petugas memproses peminjaman dari menu transaksi.',
        'ROLE_NOT_ALLOWED',
      );
    }

    // Duplicate guard: one open request per member per title.
    const [dupes] = await conn.query<RowDataPacket[]>(
      `SELECT id, status FROM loans
        WHERE user_id = ? AND book_id = ?
          AND status IN ('pending','approved','borrowed','return_requested')
        LIMIT 1`,
      [userId, bookId],
    );
    if (dupes.length > 0) {
      throw new BusinessRuleError(
        'Anda sudah memiliki peminjaman aktif untuk buku ini.',
        'DUPLICATE_LOAN',
      );
    }

    await assertBorrowAllowed(conn, userId, settings, 1);

    const loanCode = await nextLoanCode(conn);

    if (settings.requireApproval) {
      await conn.execute(
        `INSERT INTO loans (loan_code, user_id, book_id, quantity, status, requested_at, admin_note)
         VALUES (?, ?, ?, 1, 'pending', NOW(), ?)`,
        [loanCode, userId, bookId, note ?? null],
      );
    } else {
      // Walk-out flow: reserve the copy and hand it over immediately.
      await reserveCopy(conn, bookId, 1);
      // Due dates are pushed past Sundays and holidays so a member is never
      // marked late for a day the library was closed.
      const dueDays = await resolveDueDays(
        settings.loanDurationDays,
        { skipHolidays: settings.dueDateSkipHolidays },
        conn,
      );
      await conn.execute(
        `INSERT INTO loans (loan_code, user_id, book_id, quantity, status, requested_at,
                            approved_at, borrowed_at, due_at, admin_note)
         VALUES (?, ?, ?, 1, 'borrowed', NOW(), NOW(), NOW(),
                 DATE_ADD(NOW(), INTERVAL ? DAY), ?)`,
        [loanCode, userId, bookId, dueDays, note ?? null],
      );
      await fulfilReservation(conn, bookId, userId);
    }

    const [idRows] = await conn.query<RowDataPacket[]>(
      'SELECT id FROM loans WHERE loan_code = ? LIMIT 1',
      [loanCode],
    );
    loanId = Number(idRows[0].id);
  });

  // Read the row AFTER the transaction commits. Inside `withTransaction` the
  // row is still uncommitted, and `getLoanById` uses a different pooled
  // connection that cannot see it.
  const loan = await getLoanById(loanId);

  if (settings.requireApproval) {
    await notifyAdmins({
      type: 'loan.requested',
      title: 'Permohonan peminjaman baru',
      body: `${loan.member.fullName} mengajukan "${loan.book.title}". Menunggu persetujuan.`,
      link: '/admin/transaksi',
      dedupeKey: `loan-request-${loan.id}`,
    });
  }

  return { loan, requiresApproval: settings.requireApproval };
}

/**
 * Librarian lends a book straight from the desk.
 *
 * This is the everyday counter flow: the student is standing there, so there
 * is nothing to approve. The copy is reserved and the loan is `borrowed` in a
 * single transaction, exactly like the walk-out branch above, but with no
 * self-service role check.
 */
export async function counterLoan(
  adminId: number,
  input: CounterLoanInput,
): Promise<Loan> {
  const settings = await getSettings();
  const days = input.days ?? settings.loanDurationDays;
  let loanId = 0;

  await withTransaction(async (conn) => {
    await assertBorrowAllowed(conn, input.userId, settings, 1);

    const [userRows] = await conn.query<RowDataPacket[]>(
      'SELECT id, role FROM users WHERE id = ? FOR UPDATE',
      [input.userId],
    );
    if (!userRows[0]) throw notFound('Anggota tidak ditemukan.');
    if (userRows[0].role !== 'user') {
      throw new BusinessRuleError('Peminjaman hanya dapat dibuat untuk akun siswa.', 'ROLE_NOT_ALLOWED');
    }

    const [dupes] = await conn.query<RowDataPacket[]>(
      `SELECT id FROM loans
        WHERE user_id = ? AND book_id = ?
          AND status IN ('pending','approved','borrowed','return_requested')
        LIMIT 1`,
      [input.userId, input.bookId],
    );
    if (dupes.length > 0) {
      throw new BusinessRuleError(
        'Anggota ini sudah meminjam atau mengajukan buku tersebut.',
        'DUPLICATE_LOAN',
      );
    }

    await reserveCopy(conn, input.bookId, 1);

    const dueDays = await resolveDueDays(
      days,
      { skipHolidays: settings.dueDateSkipHolidays },
      conn,
    );

    const loanCode = await nextLoanCode(conn);
    await conn.execute(
      `INSERT INTO loans (loan_code, user_id, book_id, quantity, status, requested_at,
                          approved_at, approved_by, borrowed_at, due_at, admin_note)
       VALUES (?, ?, ?, 1, 'borrowed', NOW(), NOW(), ?, NOW(),
               DATE_ADD(NOW(), INTERVAL ? DAY), ?)`,
      [loanCode, input.userId, input.bookId, adminId, dueDays, input.note ?? null],
    );

    await fulfilReservation(conn, input.bookId, input.userId);

    const [idRows] = await conn.query<RowDataPacket[]>(
      'SELECT id FROM loans WHERE loan_code = ? LIMIT 1',
      [loanCode],
    );
    loanId = Number(idRows[0].id);
  });

  const loan = await getLoanById(loanId);

  await notify({
    userId: loan.userId,
    type: 'loan.approved',
    title: 'Buku dipinjamkan',
    body: `"${loan.book.title}" dipinjamkan oleh petugas. Jatuh tempo ${loan.dueAt}.`,
    link: '/perpustakaan/pinjaman',
    dedupeKey: `loan-counter-${loan.id}`,
  });

  return loan;
}

/**
 * Admin approves a pending request.
 *
 * This is where the copy is RESERVED: `available_copies` is decremented now,
 * inside the same transaction that flips the status, with both rows locked
 * `FOR UPDATE`. That is what makes two simultaneous requests for the last copy
 * safe - the second one blocks, then sees `available_copies = 0`.
 *
 * A pickup deadline is stamped here so a hold cannot sit on the shelf forever.
 */
export async function approveLoan(loanId: number, adminId: number, note?: string): Promise<Loan> {
  const settings = await getSettings();

  await withTransaction(async (conn) => {
    const loan = await loadLoanForUpdate(conn, loanId);

    if (!canTransition(loan.status, 'approved')) {
      throw new BusinessRuleError(
        `Permohonan dengan status "${loan.status}" tidak dapat disetujui.`,
        'INVALID_TRANSITION',
      );
    }

    await assertBorrowAllowed(conn, loan.user_id, settings, loan.quantity);
    await reserveCopy(conn, loan.book_id, loan.quantity);

    // Both the reading period and the collection window skip closed days:
    // a pickup deadline on a Sunday is not a deadline the member can meet.
    const dueDays = await resolveDueDays(
      settings.loanDurationDays,
      { skipHolidays: settings.dueDateSkipHolidays },
      conn,
    );
    const pickupDays = await resolveDueDays(
      settings.pickupWindowDays,
      { skipHolidays: settings.dueDateSkipHolidays },
      conn,
    );

    await conn.execute(
      `UPDATE loans
          SET status = 'approved', approved_at = NOW(), approved_by = ?,
              due_at = DATE_ADD(NOW(), INTERVAL ? DAY),
              pickup_deadline = DATE_ADD(NOW(), INTERVAL ? DAY),
              admin_note = COALESCE(?, admin_note)
        WHERE id = ?`,
      [adminId, dueDays, pickupDays, note ?? null, loanId],
    );

    return loanId;
  });

  const loan = await getLoanById(loanId);

  await notify({
    userId: loan.userId,
    type: 'loan.approved',
    title: 'Peminjaman disetujui',
    body: `"${loan.book.title}" siap diambil dalam ${settings.pickupWindowDays} hari. Batas ambil: ${loan.pickupDeadline}.`,
    link: '/perpustakaan/pinjaman',
    dedupeKey: `loan-approved-${loan.id}`,
  });

  return loan;
}

/** approved -> borrowed: the physical handover of the book to the member. */
export async function confirmBorrow(loanId: number): Promise<Loan> {
  await withTransaction(async (conn) => {
    const loan = await loadLoanForUpdate(conn, loanId);
    if (!canTransition(loan.status, 'borrowed')) {
      throw new BusinessRuleError(
        `Transaksi dengan status "${loan.status}" tidak dapat ditandai dipinjam.`,
        'INVALID_TRANSITION',
      );
    }
    await conn.execute(
      "UPDATE loans SET status = 'borrowed', borrowed_at = NOW() WHERE id = ?",
      [loanId],
    );
    await fulfilReservation(conn, loan.book_id, loan.user_id);
    return loanId;
  });

  return getLoanById(loanId);
}

/**
 * Renews a loan.
 *
 * Four things must hold: the book is actually out, it is not already overdue
 * (a late book should be returned, not extended), the renewal cap is not
 * reached, and nobody is waiting for the title - the queue outranks the
 * current holder's convenience.
 */
export async function renewLoan(
  loanId: number,
  byUserId: number,
  isAdmin: boolean,
  input: RenewLoanInput,
): Promise<Loan> {
  const settings = await getSettings();

  if (settings.maxRenewals <= 0) {
    throw new BusinessRuleError(
      'Perpanjangan sedang dinonaktifkan oleh petugas.',
      'RENEWAL_DISABLED',
    );
  }

  await withTransaction(async (conn) => {
    const loan = await loadLoanForUpdate(conn, loanId);
    if (!isAdmin && loan.user_id !== byUserId) throw notFound('Transaksi tidak ditemukan.');

    if (loan.status !== 'borrowed') {
      throw new BusinessRuleError(
        'Hanya peminjaman yang sedang berjalan dapat diperpanjang.',
        'INVALID_TRANSITION',
      );
    }
    if (loan.due_at && new Date(loan.due_at.replace(' ', 'T')).getTime() < Date.now()) {
      throw new BusinessRuleError(
        'Buku sudah melewati jatuh tempo. Kembalikan dulu sebelum memperpanjang.',
        'LOAN_OVERDUE',
      );
    }
    if (Number(loan.renew_count) >= settings.maxRenewals) {
      throw new BusinessRuleError(
        `Perpanjangan sudah mencapai batas (${settings.maxRenewals}x).`,
        'RENEWAL_LIMIT',
      );
    }

    const waiting = await waitingCount(loan.book_id);
    if (waiting > 0) {
      throw new BusinessRuleError(
        `Ada ${waiting} anggota mengantre buku ini. Silakan kembalikan agar antrean berjalan.`,
        'QUEUE_WAITING',
      );
    }

    const extraDays = input.days ?? settings.loanDurationDays;

    await conn.execute(
      `UPDATE loans
          SET due_at = DATE_ADD(COALESCE(due_at, NOW()), INTERVAL ? DAY),
              renew_count = renew_count + 1,
              admin_note = COALESCE(?, admin_note)
        WHERE id = ?`,
      [extraDays, input.note ?? null, loanId],
    );

    return loanId;
  });

  const loan = await getLoanById(loanId);

  await notify({
    userId: loan.userId,
    type: 'loan.renewed',
    title: 'Peminjaman diperpanjang',
    body: `"${loan.book.title}" diperpanjang. Jatuh tempo baru: ${loan.dueAt}.`,
    link: '/perpustakaan/pinjaman',
    dedupeKey: `loan-renewed-${loan.id}-${loan.renewCount}`,
  });

  return loan;
}

export async function rejectLoan(
  loanId: number,
  adminId: number,
  input: RejectLoanInput,
): Promise<Loan> {
  void adminId;
  await withTransaction(async (conn) => {
    const loan = await loadLoanForUpdate(conn, loanId);
    if (!canTransition(loan.status, 'rejected')) {
      throw new BusinessRuleError(
        `Permohonan dengan status "${loan.status}" tidak dapat ditolak.`,
        'INVALID_TRANSITION',
      );
    }
    await conn.execute(
      `UPDATE loans SET status = 'rejected', rejected_at = NOW(), rejected_reason = ? WHERE id = ?`,
      [input.reason, loanId],
    );
    return loanId;
  });

  const loan = await getLoanById(loanId);

  await notify({
    userId: loan.userId,
    type: 'loan.rejected',
    title: 'Peminjaman ditolak',
    body: `Permohonan "${loan.book.title}" ditolak. Alasan: ${loan.rejectedReason ?? '-'}`,
    link: '/perpustakaan/pinjaman',
    dedupeKey: `loan-rejected-${loan.id}`,
  });

  return loan;
}

/**
 * Member (or admin) cancels a request.
 *
 * pending  -> cancelled : nothing was reserved, nothing to release.
 * approved -> cancelled : a copy WAS reserved, so it goes back on the shelf
 *                         and the queue gets a chance at it.
 */
export async function cancelLoan(loanId: number, byUserId: number, isAdmin: boolean): Promise<Loan> {
  let releasedBookId: number | null = null;
  let releasedTitle = '';

  await withTransaction(async (conn) => {
    const loan = await loadLoanForUpdate(conn, loanId);
    if (!isAdmin && loan.user_id !== byUserId) throw notFound('Transaksi tidak ditemukan.');

    if (!canTransition(loan.status, 'cancelled')) {
      throw new BusinessRuleError(
        `Transaksi dengan status "${loan.status}" tidak dapat dibatalkan.`,
        'INVALID_TRANSITION',
      );
    }

    if (loan.status === 'approved') {
      await releaseCopy(conn, loan.book_id, loan.quantity);
      releasedBookId = loan.book_id;
      releasedTitle = loan.title;
    }

    await conn.execute("UPDATE loans SET status = 'cancelled' WHERE id = ?", [loanId]);

    // Promote the next person in the queue inside the same transaction, so the
    // shelf never shows a copy that is already promised to someone else.
    if (releasedBookId) {
      await promoteNextInQueue(conn, releasedBookId, releasedTitle);
    }

    return loanId;
  });

  return getLoanById(loanId);
}

/** borrowed -> return_requested: the member says "I want to give this back". */
export async function requestReturn(loanId: number, byUserId: number, isAdmin: boolean): Promise<Loan> {
  const settings = await getSettings();
  if (!isAdmin && !settings.allowSelfReturn) {
    throw new BusinessRuleError(
      'Pengembalian mandiri sedang dinonaktifkan. Silakan serahkan buku ke petugas.',
      'SELF_RETURN_DISABLED',
    );
  }

  await withTransaction(async (conn) => {
    const loan = await loadLoanForUpdate(conn, loanId);
    if (!isAdmin && loan.user_id !== byUserId) throw notFound('Transaksi tidak ditemukan.');

    if (!canTransition(loan.status, 'return_requested')) {
      throw new BusinessRuleError(
        `Transaksi dengan status "${loan.status}" tidak dapat mengajukan pengembalian.`,
        'INVALID_TRANSITION',
      );
    }

    await conn.execute(
      "UPDATE loans SET status = 'return_requested', return_requested_at = NOW() WHERE id = ?",
      [loanId],
    );
    return loanId;
  });

  const loan = await getLoanById(loanId);

  await notifyAdmins({
    type: 'loan.return_requested',
    title: 'Pengembalian menunggu verifikasi',
    body: `${loan.member.fullName} mengembalikan "${loan.book.title}". Periksa kondisi buku lalu konfirmasi.`,
    link: '/admin/transaksi',
    dedupeKey: `loan-return-request-${loan.id}`,
  });

  return loan;
}

/**
 * Librarian verifies the returned book and closes the loan.
 *
 * The copy goes back on the shelf in the SAME transaction that flips the
 * status, and any money owed is written down NOW as a `fines` row. Snapshotting
 * matters: the late fee is frozen at today's rate, so changing the rate next
 * month cannot rewrite history.
 */
export async function confirmReturn(
  loanId: number,
  adminId: number,
  input: ConfirmReturnInput,
): Promise<Loan> {
  const settings = await getSettings();
  const condition = input.condition ?? 'good';
  let charged = 0;
  let releasedBookId: number | null = null;
  let releasedTitle = '';

  await withTransaction(async (conn) => {
    const loan = await loadLoanForUpdate(conn, loanId);

    if (!canTransition(loan.status, 'returned')) {
      throw new BusinessRuleError(
        `Transaksi dengan status "${loan.status}" tidak dapat diselesaikan sebagai pengembalian.`,
        'INVALID_TRANSITION',
      );
    }

    // Copies only return to the shelf if they are still usable.
    if (condition === 'lost') {
      // A lost book leaves the collection: total and (implicitly) the copy are
      // both gone. available_copies was already decremented when it went out.
      await conn.execute(
        'UPDATE books SET total_copies = GREATEST(total_copies - ?, 0) WHERE id = ?',
        [loan.quantity, loan.book_id],
      );
    } else if (condition === 'damaged') {
      // Damaged: the copy moves from the shelf to the damaged pile. It is still
      // owned, so total_copies is untouched.
      await conn.execute(
        `UPDATE books
            SET damaged_copies = LEAST(damaged_copies + ?, total_copies)
          WHERE id = ?`,
        [loan.quantity, loan.book_id],
      );
      releasedBookId = loan.book_id;
      releasedTitle = loan.title;
    } else {
      await releaseCopy(conn, loan.book_id, loan.quantity);
      releasedBookId = loan.book_id;
      releasedTitle = loan.title;
    }

    const daysLate = computeDaysLate(loan.due_at, null, loan.status) ?? 0;

    if (daysLate > 0) {
      charged += await createFine(conn, {
        loanId: loan.id,
        userId: loan.user_id,
        kind: 'late',
        amount: daysLate * settings.lateFeePerDay,
        note: `Terlambat ${daysLate} hari`,
      });
    }
    if (condition === 'damaged') {
      charged += await createFine(conn, {
        loanId: loan.id,
        userId: loan.user_id,
        kind: 'damaged',
        amount: settings.damagedFee,
        note: input.note ?? 'Buku dikembalikan dalam kondisi rusak',
      });
    }
    if (condition === 'lost') {
      charged += await createFine(conn, {
        loanId: loan.id,
        userId: loan.user_id,
        kind: 'lost',
        amount: settings.lostFee,
        note: input.note ?? 'Buku dinyatakan hilang',
      });
    }

    await conn.execute(
      `UPDATE loans
          SET status = 'returned', returned_at = NOW(), returned_by = ?,
              return_condition = ?, return_note = ?
        WHERE id = ?`,
      [adminId, condition, input.note ?? null, loanId],
    );

    if (releasedBookId && condition !== 'lost') {
      await promoteNextInQueue(conn, releasedBookId, releasedTitle);
    }

    return loanId;
  });

  const loan = await getLoanById(loanId);

  if (charged > 0) {
    await notify({
      userId: loan.userId,
      type: 'fine.created',
      title: 'Denda baru tercatat',
      body: `Denda Rp${charged.toLocaleString('id-ID')} untuk "${loan.book.title}". Bayar di meja petugas.`,
      link: '/perpustakaan/denda',
      dedupeKey: `fine-created-${loan.id}`,
    });
  }

  return loan;
}

/**
 * Releases an `approved` hold whose pickup window has passed.
 *
 * Admin-triggered rather than scheduled: the shelf state is recomputed on
 * demand, and a manual "lepas" button is easier to explain than a silent job.
 */
export async function releaseExpiredPickup(loanId: number, adminId: number): Promise<Loan> {
  let releasedBookId: number | null = null;
  let releasedTitle = '';

  await withTransaction(async (conn) => {
    const loan = await loadLoanForUpdate(conn, loanId);

    if (loan.status !== 'approved') {
      throw new BusinessRuleError(
        'Hanya peminjaman berstatus "disetujui" yang dapat dilepas.',
        'INVALID_TRANSITION',
      );
    }

    await releaseCopy(conn, loan.book_id, loan.quantity);
    releasedBookId = loan.book_id;
    releasedTitle = loan.title;

    await conn.execute(
      `UPDATE loans
          SET status = 'cancelled',
              admin_note = CONCAT(COALESCE(admin_note, ''), ' [Dilepas: batas ambil lewat]')
        WHERE id = ?`,
      [loanId],
    );

    await promoteNextInQueue(conn, releasedBookId, releasedTitle);

    return loanId;
  });

  const loan = await getLoanById(loanId);

  await notify({
    userId: loan.userId,
    type: 'loan.pickup_expired',
    title: 'Batas pengambilan lewat',
    body: `Peminjaman "${loan.book.title}" dilepas karena tidak diambil. Silakan ajukan lagi bila masih ingin meminjam.`,
    link: '/perpustakaan/pinjaman',
    dedupeKey: `loan-pickup-expired-${loan.id}`,
  });

  void adminId;
  return loan;
}

export async function adminUpdateNote(loanId: number, note: string): Promise<Loan> {
  await execute('UPDATE loans SET admin_note = ? WHERE id = ?', [note, loanId]);
  return getLoanById(loanId);
}

/** Loans for the signed-in member, newest first. */
export async function listMyLoans(userId: number, params: LoanQuery): Promise<Paginated<Loan>> {
  return listLoans(params, userId);
}

export async function listPendingApprovals(limit = 50): Promise<Loan[]> {
  const settings = await getSettings();
  const rows = await query<LoanRow>(
    `${LOAN_SELECT} WHERE l.status = 'pending' ORDER BY l.requested_at ASC LIMIT ?`,
    [limit],
  );
  return rows.map((r) => toLoan(r, settings));
}

export interface BulkApproveResult {
  approved: Loan[];
  failed: Array<{ id: number; reason: string }>;
}

/**
 * Approves several requests in one click.
 *
 * Each loan is approved in its OWN transaction rather than one transaction for
 * the batch. A batch transaction would mean a single book with no stock left
 * silently rolls back the other nineteen approvals — the librarian would click
 * once and see nothing change. Partial success with a per-item reason is the
 * behaviour a real desk needs.
 */
export async function bulkApproveLoans(
  loanIds: number[],
  adminId: number,
  note?: string,
): Promise<BulkApproveResult> {
  const approved: Loan[] = [];
  const failed: Array<{ id: number; reason: string }> = [];

  // Sequential on purpose: two approvals touching the same book must not race
  // for the last copy.
  for (const id of loanIds) {
    try {
      approved.push(await approveLoan(id, adminId, note));
    } catch (err) {
      failed.push({
        id,
        reason: err instanceof Error ? err.message : 'Gagal menyetujui peminjaman.',
      });
    }
  }

  return { approved, failed };
}

export { computeDaysLate };
