import { execute, query, queryOne, type RowDataPacket } from '../../config/db';
import { escapeLike, paginate, parseListQuery, type Paginated } from '../../lib/pagination';
import { logger } from '../../lib/logger';

export type NotificationType =
  | 'loan.approved'
  | 'loan.rejected'
  | 'loan.cancelled'
  | 'loan.due_soon'
  | 'loan.overdue'
  | 'loan.returned'
  | 'loan.renewed'
  | 'loan.pickup_expired'
  | 'loan.requested'
  | 'loan.return_requested'
  | 'fine.created'
  | 'fine.paid'
  | 'reservation.ready'
  | 'reservation.expired'
  | 'reservation.created'
  | 'member.welcome'
  | 'stock.low';

export interface NotifyInput {
  userId: number;
  type: NotificationType;
  title: string;
  body?: string | null;
  link?: string | null;
  /**
   * Idempotency key. When the same key is written twice for the same user the
   * second insert is silently ignored, so a reminder that is evaluated on every
   * dashboard poll cannot spam the member.
   */
  dedupeKey?: string | null;
}

/**
 * Writes one notification.
 *
 * Never throws, for the same reason `logActivity` never throws: a failed
 * notification must not undo a loan that was already committed.
 */
export async function notify(input: NotifyInput): Promise<void> {
  try {
    await execute(
      `INSERT INTO notifications (user_id, type, title, body, link, dedupe_key)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE id = id`,
      [
        input.userId,
        input.type,
        input.title.slice(0, 150),
        input.body?.slice(0, 500) ?? null,
        input.link?.slice(0, 200) ?? null,
        input.dedupeKey ?? null,
      ],
    );
  } catch (err) {
    logger.error('Failed to write notification', err);
  }
}

/** Writes the same notification to several members at once. */
export async function notifyMany(
  userIds: number[],
  build: (userId: number) => Omit<NotifyInput, 'userId'>,
): Promise<void> {
  await Promise.all(userIds.map((id) => notify({ ...build(id), userId: id })));
}

/**
 * Fans one event out to every active admin.
 *
 * Members already got their own notifications, but staff had no inbox at all:
 * a new request or a return waiting for verification only appeared if someone
 * happened to open the transactions page. The actor is excluded so an admin
 * never gets a notification about their own click.
 */
export async function notifyAdmins(
  build: Omit<NotifyInput, 'userId'>,
  excludeUserId?: number,
): Promise<void> {
  try {
    const rows = await query<RowDataPacket & { id: number }>(
      "SELECT id FROM users WHERE role = 'admin' AND status = 'active'",
    );
    const targets = rows.map((r) => Number(r.id)).filter((id) => id !== excludeUserId);
    await Promise.all(targets.map((id) => notify({ ...build, userId: id })));
  } catch (err) {
    // Same rule as `notify`: never let a notification break the transaction
    // that already succeeded.
    logger.error('Failed to notify admins', err);
  }
}

interface NotificationRow extends RowDataPacket {
  id: number;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

export interface Notification {
  id: number;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

function toNotification(row: NotificationRow): Notification {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    link: row.link,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

export async function listNotifications(
  userId: number,
  params: { page?: number; pageSize?: number; search?: string; unreadOnly?: boolean },
): Promise<Paginated<Notification>> {
  const q = parseListQuery(
    { page: params.page, pageSize: params.pageSize ?? 20, sort: 'created_at' },
    ['created_at'],
    'created_at',
  );

  const where: string[] = ['user_id = ?'];
  const args: unknown[] = [userId];

  if (params.unreadOnly) where.push('read_at IS NULL');
  if (params.search) {
    where.push('(title LIKE ? OR body LIKE ?)');
    const like = `%${escapeLike(params.search)}%`;
    args.push(like, like);
  }

  const whereSql = `WHERE ${where.join(' AND ')}`;

  const totalRow = await query<RowDataPacket & { total: number }>(
    `SELECT COUNT(*) AS total FROM notifications ${whereSql}`,
    args,
  );
  const total = Number(totalRow[0]?.total ?? 0);

  const rows = await query<NotificationRow>(
    `SELECT id, type, title, body, link, read_at, created_at
       FROM notifications ${whereSql}
      ORDER BY created_at DESC, id DESC
      LIMIT ? OFFSET ?`,
    [...args, q.pageSize, q.offset],
  );

  return paginate(rows.map(toNotification), total, q);
}

export async function unreadCount(userId: number): Promise<number> {
  const row = await queryOne<RowDataPacket & { total: number }>(
    'SELECT COUNT(*) AS total FROM notifications WHERE user_id = ? AND read_at IS NULL',
    [userId],
  );
  return Number(row?.total ?? 0);
}

export async function markRead(userId: number, id: number): Promise<void> {
  await execute(
    'UPDATE notifications SET read_at = NOW() WHERE id = ? AND user_id = ? AND read_at IS NULL',
    [id, userId],
  );
}

export async function markAllRead(userId: number): Promise<void> {
  await execute(
    'UPDATE notifications SET read_at = NOW() WHERE user_id = ? AND read_at IS NULL',
    [userId],
  );
}

export async function removeNotification(userId: number, id: number): Promise<void> {
  await execute('DELETE FROM notifications WHERE id = ? AND user_id = ?', [id, userId]);
}
