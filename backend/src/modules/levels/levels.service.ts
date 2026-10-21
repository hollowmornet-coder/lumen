import { query, queryOne, type RowDataPacket } from '../../config/db';
import { resolveLevel, type MemberLevel } from './levels';

/**
 * A loan counts toward a level once a copy actually changed hands.
 *
 * Pending requests, rejected requests and cancelled holds are excluded: a
 * student who clicked "pinjam" and was refused has not borrowed anything.
 * `borrowed_at` is the single honest marker for "the book left the shelf",
 * and it survives every later status change (returned, damaged, lost).
 */
const BORROWED_EXPR = 'l.borrowed_at IS NOT NULL';

export async function countBorrowedLoans(userId: number): Promise<number> {
  const row = await queryOne<RowDataPacket & { total: number }>(
    `SELECT COUNT(*) AS total FROM loans l WHERE l.user_id = ? AND ${BORROWED_EXPR}`,
    [userId],
  );
  return Number(row?.total ?? 0);
}

/** Level for one member, computed from live loan history. */
export async function getMemberLevel(userId: number): Promise<MemberLevel> {
  return resolveLevel(await countBorrowedLoans(userId));
}

export interface LeaderboardEntry {
  rank: number;
  id: number;
  fullName: string;
  memberCode: string | null;
  className: string | null;
  avatarPath: string | null;
  totalBorrowed: number;
  level: MemberLevel;
}

/**
 * Papan peringkat pembaca.
 *
 * Members with zero loans are excluded: a leaderboard of people who never
 * borrowed says nothing, and it would push every new account into "rank 1".
 * Ranking is computed in SQL so the order is stable even when two members
 * share the same count (ties break on name, then id).
 */
export async function getLeaderboard(limit = 10): Promise<LeaderboardEntry[]> {
  const rows = await query<RowDataPacket & Record<string, any>>(
    `SELECT u.id, u.full_name AS fullName, u.member_code AS memberCode,
            u.class_name AS className, u.avatar_path AS avatarPath,
            COUNT(l.id) AS totalBorrowed
       FROM users u
       JOIN loans l ON l.user_id = u.id AND ${BORROWED_EXPR}
      WHERE u.role = 'user' AND u.status = 'active'
      GROUP BY u.id, u.full_name, u.member_code, u.class_name, u.avatar_path
      ORDER BY totalBorrowed DESC, u.full_name ASC, u.id ASC
      LIMIT ?`,
    [limit],
  );

  return rows.map((r, index) => {
    const totalBorrowed = Number(r.totalBorrowed ?? 0);
    return {
      rank: index + 1,
      id: Number(r.id),
      fullName: r.fullName,
      memberCode: r.memberCode ?? null,
      className: r.className ?? null,
      avatarPath: r.avatarPath ?? null,
      totalBorrowed,
      level: resolveLevel(totalBorrowed),
    };
  });
}

/**
 * Posisi seorang anggota pada papan peringkat.
 *
 * Dihitung dengan subquery yang sama seperti `getLeaderboard`, jadi angkanya
 * konsisten dengan daftar yang dilihat pengguna. `null` bila anggota belum
 * pernah meminjam (tidak muncul di papan).
 */
export async function getMemberRank(userId: number): Promise<number | null> {
  const row = await queryOne<RowDataPacket & { rank: number | null }>(
    `SELECT rank FROM (
       SELECT u.id,
              ROW_NUMBER() OVER (
                ORDER BY COUNT(l.id) DESC, u.full_name ASC, u.id ASC
              ) AS rank
         FROM users u
         JOIN loans l ON l.user_id = u.id AND ${BORROWED_EXPR}
        WHERE u.role = 'user' AND u.status = 'active'
        GROUP BY u.id, u.full_name
     ) ranked
     WHERE id = ?`,
    [userId],
  );
  return row?.rank != null ? Number(row.rank) : null;
}
