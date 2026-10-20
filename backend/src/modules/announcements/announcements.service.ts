import { execute, query, queryOne, type RowDataPacket } from '../../config/db';
import { notFound } from '../../lib/errors';
import { paginate, parseListQuery, type Paginated } from '../../lib/pagination';
import type {
  AnnouncementQuery,
  CreateAnnouncementInput,
  UpdateAnnouncementInput,
} from './announcements.schema';

export interface Announcement {
  id: number;
  title: string;
  body: string;
  audience: 'all' | 'user' | 'admin';
  pinned: boolean;
  expiresAt: string | null;
  /** Derived in SQL from NOW(), never stored — same rule as `overdue`. */
  expired: boolean;
  createdBy: number;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

interface AnnouncementRow extends RowDataPacket {
  id: number;
  title: string;
  body: string;
  audience: 'all' | 'user' | 'admin';
  pinned: number;
  expires_at: string | null;
  is_expired: number;
  created_by: number;
  created_by_name: string;
  created_at: string;
  updated_at: string;
}

function toAnnouncement(row: AnnouncementRow): Announcement {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    audience: row.audience,
    pinned: Boolean(row.pinned),
    expiresAt: row.expires_at,
    expired: Boolean(row.is_expired),
    createdBy: row.created_by,
    createdByName: row.created_by_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const ANNOUNCEMENT_SELECT = `
  SELECT a.id, a.title, a.body, a.audience, a.pinned, a.expires_at,
         (a.expires_at IS NOT NULL AND a.expires_at <= NOW()) AS is_expired,
         a.created_by, a.created_at, a.updated_at,
         u.full_name AS created_by_name
    FROM announcements a
    JOIN users u ON u.id = a.created_by
`;

/**
 * Lists announcements visible to `role`.
 *
 * Pinned items come first, then newest. The ORDER BY is written explicitly
 * rather than reusing the shared list helper because this endpoint has a
 * two-key ordering that the generic `sort`/`direction` pair cannot express.
 */
export async function listAnnouncements(
  params: AnnouncementQuery,
  role: 'admin' | 'user',
): Promise<Paginated<Announcement>> {
  const where: string[] = [];
  const args: unknown[] = [];

  if (role === 'user') {
    // A member must never see staff-only notes. This is enforced in SQL, not in
    // the UI, so a hand-crafted request cannot leak them.
    where.push("a.audience IN ('all','user')");
  } else if (params.audience) {
    where.push('a.audience = ?');
    args.push(params.audience);
  }

  if (params.activeOnly) {
    where.push('(a.expires_at IS NULL OR a.expires_at > NOW())');
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const listQuery = parseListQuery(
    { page: params.page, pageSize: params.pageSize },
    ['created_at'],
    'created_at',
  );

  const countRows = await query<RowDataPacket & { total: number }>(
    `SELECT COUNT(*) AS total FROM announcements a ${whereSql}`,
    args,
  );
  const total = Number(countRows[0]?.total ?? 0);

  const rows = await query<AnnouncementRow>(
    `${ANNOUNCEMENT_SELECT} ${whereSql}
      ORDER BY a.pinned DESC, a.created_at DESC
      LIMIT ? OFFSET ?`,
    [...args, listQuery.pageSize, listQuery.offset],
  );

  return paginate(rows.map(toAnnouncement), total, listQuery);
}

export async function getAnnouncement(id: number): Promise<Announcement> {
  const row = await queryOne<AnnouncementRow>(`${ANNOUNCEMENT_SELECT} WHERE a.id = ?`, [id]);
  if (!row) throw notFound('Pengumuman tidak ditemukan.');
  return toAnnouncement(row);
}

export async function createAnnouncement(
  input: CreateAnnouncementInput,
  createdBy: number,
): Promise<Announcement> {
  const result = await execute(
    `INSERT INTO announcements (title, body, audience, pinned, expires_at, created_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      input.title,
      input.body,
      input.audience ?? 'all',
      input.pinned ? 1 : 0,
      input.expiresAt ?? null,
      createdBy,
    ],
  );
  return getAnnouncement(result.insertId);
}

export async function updateAnnouncement(
  id: number,
  input: UpdateAnnouncementInput,
): Promise<Announcement> {
  const sets: string[] = [];
  const params: unknown[] = [];

  if (input.title !== undefined) {
    sets.push('title = ?');
    params.push(input.title);
  }
  if (input.body !== undefined) {
    sets.push('body = ?');
    params.push(input.body);
  }
  if (input.audience !== undefined) {
    sets.push('audience = ?');
    params.push(input.audience);
  }
  if (input.pinned !== undefined) {
    sets.push('pinned = ?');
    params.push(input.pinned ? 1 : 0);
  }
  if (input.expiresAt !== undefined) {
    sets.push('expires_at = ?');
    params.push(input.expiresAt);
  }

  if (sets.length === 0) return getAnnouncement(id);

  params.push(id);
  const result = await execute(`UPDATE announcements SET ${sets.join(', ')} WHERE id = ?`, params);
  if (result.affectedRows === 0) throw notFound('Pengumuman tidak ditemukan.');

  return getAnnouncement(id);
}

export async function deleteAnnouncement(id: number): Promise<void> {
  const result = await execute('DELETE FROM announcements WHERE id = ?', [id]);
  if (result.affectedRows === 0) throw notFound('Pengumuman tidak ditemukan.');
}

/** Count of live announcements a member should be badged about. */
export async function activeAnnouncementCount(role: 'admin' | 'user'): Promise<number> {
  const where = role === 'user' ? "AND audience IN ('all','user')" : '';
  const row = await queryOne<RowDataPacket & { total: number }>(
    `SELECT COUNT(*) AS total FROM announcements
      WHERE (expires_at IS NULL OR expires_at > NOW()) ${where}`,
  );
  return Number(row?.total ?? 0);
}
