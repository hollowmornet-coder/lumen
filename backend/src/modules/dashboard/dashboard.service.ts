import { query, queryOne, type RowDataPacket } from '../../config/db';

const OVERDUE_EXPR =
  "(l.status IN ('borrowed','return_requested') AND l.due_at IS NOT NULL AND l.due_at < NOW())";

export interface AdminOverview {
  totalTitles: number;
  totalCopies: number;
  availableCopies: number;
  borrowedCopies: number;
  activeMembers: number;
  totalMembers: number;
  pendingApprovals: number;
  overdueLoans: number;
  returnRequests: number;
  activeLoans: number;
  totalLoans: number;
  returnedThisMonth: number;
  categories: number;
}

/**
 * Every number here is a real aggregate over the database.
 * Nothing is seeded, faked, or estimated on the client.
 */
export async function getAdminOverview(): Promise<AdminOverview> {
  const [bookRow, userRow, loanRow] = await Promise.all([
    queryOne<RowDataPacket & Record<string, number>>(
      `SELECT COUNT(*) AS total_titles,
              COALESCE(SUM(total_copies), 0) AS total_copies,
              COALESCE(SUM(available_copies), 0) AS available_copies,
              COALESCE(SUM(total_copies - available_copies), 0) AS borrowed_copies
         FROM books WHERE status = 'active'`,
    ),
    queryOne<RowDataPacket & Record<string, number>>(
      `SELECT COUNT(*) AS total_members,
              SUM(role = 'user' AND status = 'active') AS active_members
         FROM users`,
    ),
    queryOne<RowDataPacket & Record<string, number>>(
      `SELECT COUNT(*) AS total_loans,
              SUM(l.status = 'pending') AS pending_approvals,
              SUM(l.status = 'return_requested') AS return_requests,
              SUM(l.status IN ('approved','borrowed','return_requested')) AS active_loans,
              SUM(l.status = 'returned' AND l.returned_at >= DATE_FORMAT(NOW(), '%Y-%m-01')) AS returned_this_month,
              SUM(${OVERDUE_EXPR}) AS overdue_loans
         FROM loans l`,
    ),
  ]);

  const catRow = await queryOne<RowDataPacket & { total: number }>(
    "SELECT COUNT(*) AS total FROM categories",
  );

  const books: Record<string, number> = bookRow ?? {};
  const users: Record<string, number> = userRow ?? {};
  const loans: Record<string, number> = loanRow ?? {};

  return {
    totalTitles: Number(books.total_titles ?? 0),
    totalCopies: Number(books.total_copies ?? 0),
    availableCopies: Number(books.available_copies ?? 0),
    borrowedCopies: Number(books.borrowed_copies ?? 0),
    activeMembers: Number(users.active_members ?? 0),
    totalMembers: Number(users.total_members ?? 0),
    categories: Number(catRow?.total ?? 0),
    pendingApprovals: Number(loans.pending_approvals ?? 0),
    overdueLoans: Number(loans.overdue_loans ?? 0),
    returnRequests: Number(loans.return_requests ?? 0),
    activeLoans: Number(loans.active_loans ?? 0),
    totalLoans: Number(loans.total_loans ?? 0),
    returnedThisMonth: Number(loans.returned_this_month ?? 0),
  };
}

export type TrendBucket = 'day' | 'week' | 'month';

export interface TrendPoint {
  period: string;
  label: string;
  borrowed: number;
  returned: number;
}

/** Borrows vs returns over time. The date filter genuinely changes the query. */
export async function getTransactionTrend(
  from: string,
  to: string,
  bucket: TrendBucket = 'day',
): Promise<TrendPoint[]> {
  const fmt =
    bucket === 'month'
      ? "%Y-%m"
      : bucket === 'week'
        ? '%x-W%v'
        : '%Y-%m-%d';

  const [borrowedRows, returnedRows] = await Promise.all([
    query<RowDataPacket & { period: string; n: number }>(
      `SELECT DATE_FORMAT(DATE(l.borrowed_at), ?) AS period, COUNT(*) AS n
         FROM loans l
        WHERE l.borrowed_at IS NOT NULL
          AND DATE(l.borrowed_at) BETWEEN ? AND ?
        GROUP BY period
        ORDER BY period ASC`,
      [fmt, from, to],
    ),
    query<RowDataPacket & { period: string; n: number }>(
      `SELECT DATE_FORMAT(DATE(l.returned_at), ?) AS period, COUNT(*) AS n
         FROM loans l
        WHERE l.returned_at IS NOT NULL
          AND DATE(l.returned_at) BETWEEN ? AND ?
        GROUP BY period
        ORDER BY period ASC`,
      [fmt, from, to],
    ),
  ]);

  const merged = new Map<string, TrendPoint>();
  const ensure = (period: string): TrendPoint => {
    let point = merged.get(period);
    if (!point) {
      point = { period, label: formatBucketLabel(period, bucket), borrowed: 0, returned: 0 };
      merged.set(period, point);
    }
    return point;
  };

  for (const r of borrowedRows) ensure(String(r.period)).borrowed = Number(r.n);
  for (const r of returnedRows) ensure(String(r.period)).returned = Number(r.n);

  return [...merged.values()].sort((a, b) => a.period.localeCompare(b.period));
}

function formatBucketLabel(period: string, bucket: TrendBucket): string {
  if (bucket === 'month') {
    const [y, m] = period.split('-');
    const monthNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
      'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
    ];
    return `${monthNames[Number(m) - 1] ?? m} ${y}`;
  }
  if (bucket === 'week') return `Minggu ${period.split('-W')[1] ?? period}`;
  const d = new Date(`${period}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? period
    : `${d.getDate()} ${d.toLocaleString('id-ID', { month: 'short' })}`;
}

export interface CategorySlice {
  name: string;
  value: number;
  totalCopies: number;
}

export async function getCategoryDistribution(): Promise<CategorySlice[]> {
  const rows = await query<RowDataPacket & { name: string; value: number; total_copies: number }>(
    `SELECT COALESCE(c.name, 'Tanpa Kategori') AS name,
            COUNT(b.id) AS value,
            COALESCE(SUM(b.total_copies), 0) AS total_copies
       FROM books b
       LEFT JOIN categories c ON c.id = b.category_id
      WHERE b.status = 'active'
      GROUP BY c.id, c.name
      ORDER BY value DESC`,
  );
  return rows.map((r) => ({
    name: r.name,
    value: Number(r.value),
    totalCopies: Number(r.total_copies),
  }));
}

export interface StatusSlice {
  status: string;
  value: number;
}

export async function getStatusDistribution(from?: string, to?: string): Promise<StatusSlice[]> {
  const args: unknown[] = [];
  let dateFilter = '';
  if (from && to) {
    dateFilter = ' AND DATE(l.requested_at) BETWEEN ? AND ?';
    args.push(from, to);
  }

  const rows = await query<RowDataPacket & { status: string; value: number }>(
    `SELECT
       CASE WHEN ${OVERDUE_EXPR} THEN 'overdue' ELSE l.status END AS status,
       COUNT(*) AS value
     FROM loans l
     WHERE 1 = 1 ${dateFilter}
     GROUP BY status
     ORDER BY value DESC`,
    args,
  );
  return rows.map((r) => ({ status: r.status, value: Number(r.value) }));
}

export interface TopBook {
  id: number;
  title: string;
  author: string;
  coverPath: string | null;
  borrowCount: number;
}

export async function getTopBorrowedBooks(limit = 8, from?: string, to?: string): Promise<TopBook[]> {
  const args: unknown[] = [];
  let dateFilter = '';
  if (from && to) {
    dateFilter = ' AND DATE(l.borrowed_at) BETWEEN ? AND ?';
    args.push(from, to);
  }

  const rows = await query<RowDataPacket & Record<string, any>>(
    `SELECT b.id, b.title, b.author, b.cover_path AS coverPath, COUNT(l.id) AS borrowCount
       FROM loans l
       JOIN books b ON b.id = l.book_id
      WHERE l.borrowed_at IS NOT NULL ${dateFilter}
      GROUP BY b.id, b.title, b.author, b.cover_path
      ORDER BY borrowCount DESC, b.title ASC
      LIMIT ?`,
    [...args, limit],
  );
  return rows.map((r) => ({
    id: Number(r.id),
    title: r.title,
    author: r.author,
    coverPath: r.coverPath,
    borrowCount: Number(r.borrowCount),
  }));
}

export interface MemberActivity {
  id: number;
  fullName: string;
  memberCode: string | null;
  borrowCount: number;
  activeCount: number;
  overdueCount: number;
}

export async function getTopMembers(limit = 8): Promise<MemberActivity[]> {
  const rows = await query<RowDataPacket & Record<string, any>>(
    `SELECT u.id, u.full_name AS fullName, u.member_code AS memberCode,
            COUNT(l.id) AS borrowCount,
            SUM(l.status IN ('borrowed','return_requested')) AS activeCount,
            SUM(${OVERDUE_EXPR}) AS overdueCount
       FROM users u
       LEFT JOIN loans l ON l.user_id = u.id
      WHERE u.role = 'user'
      GROUP BY u.id, u.full_name, u.member_code
      ORDER BY borrowCount DESC, u.full_name ASC
      LIMIT ?`,
    [limit],
  );
  return rows.map((r) => ({
    id: Number(r.id),
    fullName: r.fullName,
    memberCode: r.memberCode ?? null,
    borrowCount: Number(r.borrowCount ?? 0),
    activeCount: Number(r.activeCount ?? 0),
    overdueCount: Number(r.overdueCount ?? 0),
  }));
}

export interface MemberOverview {
  activeLoans: number;
  pendingRequests: number;
  overdueLoans: number;
  totalBorrowed: number;
  returnRequested: number;
  maxLoanPerUser: number;
  remainingQuota: number;
}

export async function getMemberOverview(
  userId: number,
  maxLoanPerUser: number,
): Promise<MemberOverview> {
  const row = await queryOne<RowDataPacket & Record<string, number>>(
    `SELECT
       SUM(l.status IN ('approved','borrowed','return_requested')) AS active_loans,
       SUM(l.status = 'pending') AS pending_requests,
       SUM(l.status = 'return_requested') AS return_requested,
       SUM(l.status IN ('borrowed','return_requested')) AS total_borrowed,
       SUM(${OVERDUE_EXPR}) AS overdue_loans
     FROM loans l WHERE l.user_id = ?`,
    [userId],
  );

  const active = Number(row?.active_loans ?? 0);
  return {
    activeLoans: active,
    pendingRequests: Number(row?.pending_requests ?? 0),
    overdueLoans: Number(row?.overdue_loans ?? 0),
    totalBorrowed: Number(row?.total_borrowed ?? 0),
    returnRequested: Number(row?.return_requested ?? 0),
    maxLoanPerUser,
    remainingQuota: Math.max(0, maxLoanPerUser - active),
  };
}
