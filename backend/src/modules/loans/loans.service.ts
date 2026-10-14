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
import type {
  ConfirmReturnInput,
  LoanQuery,
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
  status: LoanStatus;
  display_status: DisplayStatus;
  requested_at: string;
  approved_at: string | null;
  approved_by: number | null;
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
}

export interface Loan {
  id: number;
  loanCode: string;
  userId: number;
  bookId: number;
  quantity: number;
  status: LoanStatus;
  displayStatus: DisplayStatus;
  requestedAt: string;
  approvedAt: string | null;
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
    status: row.status,
    displayStatus: row.display_status,
    requestedAt: row.requested_at,
    approvedAt: row.approved_at,
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
    l.id, l.loan_code, l.user_id, l.book_id, l.quantity, l.status,
    l.requested_at, l.approved_at, l.approved_by, l.rejected_at, l.rejected_reason,
    l.borrowed_at, l.due_at, l.return_requested_at, l.returned_at,
    l.return_condition, l.return_note, l.admin_note, l.created_at,
    CASE
      WHEN l.status IN ('borrowed','return_requested')
           AND l.due_at IS NOT NULL AND l.due_at < NOW()
      THEN 'overdue' ELSE l.status
    END AS display_status,
    b.title, b.author, b.isbn, b.cover_path, b.category_id, b.available_copies,
    c.name AS category_name,
    u.full_name, u.member_code, u.username
  ${LOAN_FROM}
`;

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

/** Throws unless the current user owns this loan. Used by every member action. */
async function loadOwnedLoan(id: number, userId: number): Promise<LoanRow> {
  const row = await queryOne<LoanRow>(`${LOAN_SELECT} WHERE l.id = ? LIMIT 1`, [id]);
  if (!row || row.user_id !== userId) throw notFound('Transaksi tidak ditemukan.');
  return row;
}

async function loadLoanForUpdate(conn: PoolConnection, id: number): Promise<LoanRow> {
  const [rows] = await conn.query<LoanRow[]>(`${LOAN_SELECT} WHERE l.id = ? FOR UPDATE`, [id]);
  const row = rows[0];
  if (!row) throw notFound('Transaksi tidak ditemukan.');
  return row;
}

async function nextLoanCode(conn: PoolConnection): Promise<string> {
  const prefix = `LN-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-`;
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
    if (user.status !== 'active') {
      throw new BusinessRuleError('Akun Anda dinonaktifkan sehingga tidak dapat meminjam.', 'ACCOUNT_INACTIVE');
    }
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

    const [bookRows] = await conn.query<
      (RowDataPacket & {
        id: number;
        status: string;
        available_copies: number;
        total_copies: number;
        title: string;
      })[]
    >(
      'SELECT id, status, available_copies, total_copies, title FROM books WHERE id = ? FOR UPDATE',
      [bookId],
    );
    const book = bookRows[0];
    if (!book) throw notFound('Buku tidak ditemukan.');
    if (book.status !== 'active') {
      throw new BusinessRuleError('Buku ini sedang dinonaktifkan dan tidak dapat dipinjam.', 'BOOK_INACTIVE');
    }
    if (book.available_copies < 1) {
      throw new BusinessRuleError('Stok buku sedang habis. Silakan coba lagi nanti.', 'NO_STOCK');
    }

    const held = await countHeldCopies(conn, userId);
    if (held >= settings.maxLoanPerUser) {
      throw new BusinessRuleError(
        `Anda sudah memiliki ${held} buku dipinjam. Maksimal ${settings.maxLoanPerUser} buku.`,
        'LOAN_LIMIT_REACHED',
      );
    }

    const loanCode = await nextLoanCode(conn);

    if (settings.requireApproval) {
      await conn.execute(
        `INSERT INTO loans (loan_code, user_id, book_id, quantity, status, requested_at, admin_note)
         VALUES (?, ?, ?, 1, 'pending', NOW(), ?)`,
        [loanCode, userId, bookId, note ?? null],
      );
    } else {
      // Walk-out flow: reserve the copy and hand it over immediately.
      await conn.execute(
        `INSERT INTO loans (loan_code, user_id, book_id, quantity, status, requested_at,
                            approved_at, borrowed_at, due_at, admin_note)
         VALUES (?, ?, ?, 1, 'borrowed', NOW(), NOW(), NOW(),
                 DATE_ADD(NOW(), INTERVAL ? DAY), ?)`,
        [loanCode, userId, bookId, settings.loanDurationDays, note ?? null],
      );
      await conn.execute(
        'UPDATE books SET available_copies = available_copies - 1 WHERE id = ?',
        [bookId],
      );
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
  return { loan, requiresApproval: settings.requireApproval };
}

/**
 * Admin approves a pending request.
 *
 * This is where the copy is RESERVED: `available_copies` is decremented now,
 * inside the same transaction that flips the status, with both rows locked
 * `FOR UPDATE`. That is what makes two simultaneous requests for the last copy
 * safe - the second one blocks, then sees `available_copies = 0`.
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

    const [userRows] = await conn.query<RowDataPacket[]>(
      'SELECT id, status FROM users WHERE id = ? FOR UPDATE',
      [loan.user_id],
    );
    const borrower = userRows[0];
    if (!borrower) throw notFound('Anggota tidak ditemukan.');
    if (borrower.status !== 'active') {
      throw new BusinessRuleError('Akun peminjam dinonaktifkan sehingga peminjaman tidak dapat disetujui.', 'ACCOUNT_INACTIVE');
    }

    const held = await countHeldCopies(conn, loan.user_id);
    if (held + loan.quantity > settings.maxLoanPerUser) {
      throw new BusinessRuleError(
        `Anggota sudah memiliki ${held} buku dipinjam. Maksimal ${settings.maxLoanPerUser} buku.`,
        'LOAN_LIMIT_REACHED',
      );
    }

    const [bookRows] = await conn.query<
      (RowDataPacket & { available_copies: number; status: string })[]
    >('SELECT available_copies, status FROM books WHERE id = ? FOR UPDATE', [loan.book_id]);
    const book = bookRows[0];
    if (!book) throw notFound('Buku tidak ditemukan.');
    if (book.status !== 'active') {
      throw new BusinessRuleError('Buku sedang dinonaktifkan sehingga peminjaman tidak dapat disetujui.', 'BOOK_INACTIVE');
    }
    if (book.available_copies < loan.quantity) {
      throw new BusinessRuleError(
        `Stok tidak mencukupi. Tersedia ${book.available_copies} eksemplar.`,
        'NO_STOCK',
      );
    }

    await conn.execute(
      'UPDATE books SET available_copies = available_copies - ? WHERE id = ?',
      [loan.quantity, loan.book_id],
    );

    await conn.execute(
      `UPDATE loans
          SET status = 'approved', approved_at = NOW(), approved_by = ?,
              due_at = DATE_ADD(NOW(), INTERVAL ? DAY),
              admin_note = COALESCE(?, admin_note)
        WHERE id = ?`,
      [adminId, settings.loanDurationDays, note ?? null, loanId],
    );

    return loanId;
  });

  return getLoanById(loanId);
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
    return loanId;
  });

  return getLoanById(loanId);
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

  return getLoanById(loanId);
}

/**
 * Member (or admin) cancels a request.
 *
 * pending  -> cancelled : nothing was reserved, nothing to release.
 * approved -> cancelled : a copy WAS reserved, so it goes back on the shelf.
 */
export async function cancelLoan(loanId: number, byUserId: number, isAdmin: boolean): Promise<Loan> {
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
      await conn.execute(
        'UPDATE books SET available_copies = LEAST(available_copies + ?, total_copies) WHERE id = ?',
        [loan.quantity, loan.book_id],
      );
    }

    await conn.execute("UPDATE loans SET status = 'cancelled' WHERE id = ?", [loanId]);
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

  return getLoanById(loanId);
}

/**
 * Librarian verifies the returned book and closes the loan.
 *
 * The copy is put back on the shelf in the SAME transaction that flips the
 * status. `LEAST(..., total_copies)` is a hard safety net so a double-click or
 * a retried request can never push `available_copies` above the total.
 */
export async function confirmReturn(
  loanId: number,
  adminId: number,
  input: ConfirmReturnInput,
): Promise<Loan> {
  await withTransaction(async (conn) => {
    const loan = await loadLoanForUpdate(conn, loanId);

    if (!canTransition(loan.status, 'returned')) {
      throw new BusinessRuleError(
        `Transaksi dengan status "${loan.status}" tidak dapat diselesaikan sebagai pengembalian.`,
        'INVALID_TRANSITION',
      );
    }

    await conn.execute(
      'UPDATE books SET available_copies = LEAST(available_copies + ?, total_copies) WHERE id = ?',
      [loan.quantity, loan.book_id],
    );

    await conn.execute(
      `UPDATE loans
          SET status = 'returned', returned_at = NOW(), returned_by = ?,
              return_condition = ?, return_note = ?
        WHERE id = ?`,
      [adminId, input.condition ?? 'good', input.note ?? null, loanId],
    );

    return loanId;
  });

  return getLoanById(loanId);
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

export { computeDaysLate };
