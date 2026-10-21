import { execute, query, type RowDataPacket } from '../../config/db';
import { escapeLike, paginate, parseListQuery, type Paginated } from '../../lib/pagination';
import { logger } from '../../lib/logger';

export type ActivityAction =
  | 'auth.login'
  | 'auth.login_failed'
  | 'auth.logout'
  | 'auth.register'
  | 'profile.update'
  | 'profile.avatar'
  | 'password.change'
  | 'book.create'
  | 'book.update'
  | 'book.delete'
  | 'book.status'
  | 'book.import'
  | 'member.create'
  | 'member.update'
  | 'member.status'
  | 'member.delete'
  | 'loan.request'
  | 'loan.counter'
  | 'loan.approve'
  | 'loan.reject'
  | 'loan.cancel'
  | 'loan.renew'
  | 'loan.return_request'
  | 'loan.return_confirm'
  | 'fine.settle'
  | 'reservation.create'
  | 'reservation.cancel'
  | 'password.reset_request'
  | 'password.reset'
  | 'settings.update'
  | 'data.export'
  | 'data.backup'
  | 'data.restore'
  | 'holiday.create'
  | 'holiday.delete'
  | 'visit.create'
  | 'opname.create'
  | 'opname.apply'
  | 'review.create'
  | 'review.delete'
  | 'announcement.create'
  | 'announcement.update'
  | 'announcement.delete'
  | 'wishlist.add'
  | 'wishlist.remove'
  | 'member.import';

export interface LogInput {
  userId?: number | null;
  actorName: string;
  action: ActivityAction;
  entityType?: string;
  entityId?: number;
  description?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}

/**
 * Writes an audit row.
 *
 * Never throws: a failure to record an audit entry must not roll back or
 * break the business operation that already succeeded. Failures are logged.
 */
export async function logActivity(input: LogInput): Promise<void> {
  try {
    await execute(
      `INSERT INTO activity_logs
         (user_id, actor_name, action, entity_type, entity_id, description, metadata, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.userId ?? null,
        input.actorName.slice(0, 100),
        input.action,
        input.entityType ?? null,
        input.entityId ?? null,
        input.description?.slice(0, 255) ?? null,
        input.metadata ? JSON.stringify(input.metadata) : null,
        input.ipAddress?.slice(0, 45) ?? null,
      ],
    );
  } catch (err) {
    logger.error('Failed to write activity log', err);
  }
}

interface ActivityRow extends RowDataPacket {
  id: number;
  actor_name: string;
  action: string;
  entity_type: string | null;
  entity_id: number | null;
  description: string | null;
  metadata: string | null;
  created_at: string;
}

export interface ActivityItem {
  id: number;
  actorName: string;
  action: string;
  entityType: string | null;
  entityId: number | null;
  description: string | null;
  metadata: unknown;
  createdAt: string;
}

export async function listActivity(params: {
  page?: number;
  pageSize?: number;
  search?: string;
  action?: string;
}): Promise<Paginated<ActivityItem>> {
  const q = parseListQuery(
    {
      page: params.page,
      pageSize: params.pageSize ?? 15,
      sort: 'created_at',
    },
    ['created_at', 'action', 'actor_name'],
    'created_at',
  );

  const where: string[] = [];
  const args: unknown[] = [];

  if (params.search) {
    where.push('(actor_name LIKE ? OR description LIKE ?)');
    const like = `%${escapeLike(params.search)}%`;
    args.push(like, like);
  }
  if (params.action) {
    where.push('action = ?');
    args.push(params.action);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const totalRow = await query<RowDataPacket & { total: number }>(
    `SELECT COUNT(*) AS total FROM activity_logs ${whereSql}`,
    args,
  );
  const total = Number(totalRow[0]?.total ?? 0);

  const rows = await query<ActivityRow>(
    `SELECT id, actor_name, action, entity_type, entity_id, description, metadata, created_at
       FROM activity_logs
       ${whereSql}
      ORDER BY created_at DESC, id DESC
      LIMIT ? OFFSET ?`,
    [...args, q.pageSize, q.offset],
  );

  const items: ActivityItem[] = rows.map((r) => ({
    id: r.id,
    actorName: r.actor_name,
    action: r.action,
    entityType: r.entity_type,
    entityId: r.entity_id,
    description: r.description,
    metadata: r.metadata ? safeParse(r.metadata) : null,
    createdAt: r.created_at,
  }));

  return paginate(items, total, q);
}

function safeParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
