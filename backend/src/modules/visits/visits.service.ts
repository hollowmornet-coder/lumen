import { execute, query, queryOne, type RowDataPacket } from '../../config/db';
import { paginate, parseListQuery, type Paginated } from '../../lib/pagination';
import { notFound } from '../../lib/errors';
import type { CreateVisitInput, VisitQuery } from './visits.schema';

export interface Visit {
  id: number;
  userId: number | null;
  memberName: string;
  memberCode: string | null;
  className: string | null;
  guestName: string | null;
  purpose: string;
  visitDate: string;
  createdAt: string;
}

interface VisitRow extends RowDataPacket {
  id: number;
  user_id: number | null;
  full_name: string | null;
  member_code: string | null;
  class_name: string | null;
  guest_name: string | null;
  purpose: string;
  visit_date: string;
  created_at: string;
}

function toVisit(row: VisitRow): Visit {
  return {
    id: row.id,
    userId: row.user_id,
    memberName: row.full_name ?? row.guest_name ?? 'Tamu',
    memberCode: row.member_code,
    className: row.class_name,
    guestName: row.guest_name,
    purpose: row.purpose,
    visitDate: String(row.visit_date).slice(0, 10),
    createdAt: row.created_at,
  };
}

const VISIT_SELECT = `
  SELECT v.id, v.user_id, v.guest_name, v.purpose, v.visit_date, v.created_at,
         u.full_name, u.member_code, u.class_name
    FROM library_visits v
    LEFT JOIN users u ON u.id = v.user_id
`;

export async function listVisits(params: VisitQuery): Promise<Paginated<Visit>> {
  const where: string[] = [];
  const args: unknown[] = [];

  if (params.from) {
    where.push('v.visit_date >= ?');
    args.push(params.from);
  }
  if (params.to) {
    where.push('v.visit_date <= ?');
    args.push(params.to);
  }
  if (params.userId) {
    where.push('v.user_id = ?');
    args.push(params.userId);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const listQuery = parseListQuery(
    { page: params.page, pageSize: params.pageSize, sort: 'created_at', direction: 'DESC' },
    ['created_at', 'visit_date'],
    'created_at',
  );

  const countRows = await query<RowDataPacket & { total: number }>(
    `SELECT COUNT(*) AS total FROM library_visits v ${whereSql}`,
    args,
  );
  const total = Number(countRows[0]?.total ?? 0);

  const rows = await query<VisitRow>(
    `${VISIT_SELECT} ${whereSql}
      ORDER BY v.${listQuery.sort} ${listQuery.direction}
      LIMIT ? OFFSET ?`,
    [...args, listQuery.pageSize, listQuery.offset],
  );

  return paginate(rows.map(toVisit), total, listQuery);
}

/**
 * Records one visit.
 *
 * `visit_date` is filled by SQL (`CURDATE()`), not by Node: the application
 * clock and the database clock are not guaranteed to agree, and a visit logged
 * at 00:30 must belong to the day the library actually opened.
 *
 * Scanning the same card twice in one day is expected (someone leaves and comes
 * back), so a duplicate is treated as "already recorded" rather than an error.
 */
export async function recordVisit(
  input: CreateVisitInput,
  createdBy: number,
): Promise<{ visit: Visit; alreadyRecorded: boolean }> {
  if (input.userId) {
    const existing = await queryOne<VisitRow>(
      `${VISIT_SELECT} WHERE v.user_id = ? AND v.visit_date = CURDATE() LIMIT 1`,
      [input.userId],
    );
    if (existing) return { visit: toVisit(existing), alreadyRecorded: true };

    const member = await queryOne<RowDataPacket & { id: number }>(
      "SELECT id FROM users WHERE id = ? AND role = 'user'",
      [input.userId],
    );
    if (!member) throw notFound('Anggota tidak ditemukan.');

    const result = await execute(
      `INSERT INTO library_visits (user_id, purpose, visit_date, created_by)
       VALUES (?, ?, CURDATE(), ?)`,
      [input.userId, input.purpose ?? 'read', createdBy],
    );

    const row = await queryOne<VisitRow>(`${VISIT_SELECT} WHERE v.id = ?`, [result.insertId]);
    if (!row) throw notFound('Kunjungan tidak ditemukan.');
    return { visit: toVisit(row), alreadyRecorded: false };
  }

  // Guest: no user_id, so the UNIQUE index cannot deduplicate. That is
  // intentional — two different guests can share a name.
  const result = await execute(
    `INSERT INTO library_visits (guest_name, purpose, visit_date, created_by)
     VALUES (?, ?, CURDATE(), ?)`,
    [input.guestName ?? 'Tamu', input.purpose ?? 'read', createdBy],
  );

  const row = await queryOne<VisitRow>(`${VISIT_SELECT} WHERE v.id = ?`, [result.insertId]);
  if (!row) throw notFound('Kunjungan tidak ditemukan.');
  return { visit: toVisit(row), alreadyRecorded: false };
}

export interface VisitSummary {
  today: number;
  thisMonth: number;
  uniqueToday: number;
  byPurpose: Array<{ purpose: string; total: number }>;
}

/** Numbers for the dashboard card. All counting happens in SQL. */
export async function visitSummary(): Promise<VisitSummary> {
  const totals = await queryOne<
    RowDataPacket & { today: number; this_month: number; unique_today: number }
  >(
    `SELECT
       COALESCE(SUM(visit_date = CURDATE()), 0) AS today,
       COALESCE(SUM(YEAR(visit_date) = YEAR(CURDATE())
                AND MONTH(visit_date) = MONTH(CURDATE())), 0) AS this_month,
       COUNT(DISTINCT CASE WHEN visit_date = CURDATE() THEN user_id END) AS unique_today
     FROM library_visits`,
  );

  const byPurpose = await query<RowDataPacket & { purpose: string; total: number }>(
    `SELECT purpose, COUNT(*) AS total
       FROM library_visits
      WHERE visit_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      GROUP BY purpose
      ORDER BY total DESC`,
  );

  return {
    today: Number(totals?.today ?? 0),
    thisMonth: Number(totals?.this_month ?? 0),
    uniqueToday: Number(totals?.unique_today ?? 0),
    byPurpose: byPurpose.map((r) => ({ purpose: r.purpose, total: Number(r.total) })),
  };
}
