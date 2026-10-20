import type { Request, Response } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import {
  listNotifications,
  markAllRead,
  markRead,
  removeNotification,
  unreadCount,
} from './notifications.service';
import { generateReminders } from './notifications.reminders';
import type { NotificationQuery } from './notifications.schema';

/**
 * Every notification endpoint is scoped to the signed-in user. There is
 * deliberately no admin view: notifications are personal, and an admin reading
 * someone else's inbox would be a privacy leak with no operational value.
 */
export const list = asyncHandler(async (req: Request, res: Response) => {
  // Reminders are materialised on read, so a member sees a due-date warning the
  // first time they open the app after crossing the threshold.
  await generateReminders(req.user!.id);

  const result = await listNotifications(req.user!.id, req.query as unknown as NotificationQuery);
  res.json({ success: true, data: result.items, meta: result.meta });
});

export const unread = asyncHandler(async (req: Request, res: Response) => {
  const total = await unreadCount(req.user!.id);
  res.json({ success: true, data: { unread: total } });
});

export const read = asyncHandler(async (req: Request, res: Response) => {
  await markRead(req.user!.id, Number(req.params.id));
  res.json({ success: true, data: { unread: await unreadCount(req.user!.id) } });
});

export const readAll = asyncHandler(async (req: Request, res: Response) => {
  await markAllRead(req.user!.id);
  res.json({ success: true, data: { unread: 0 }, message: 'Semua notifikasi ditandai terbaca.' });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await removeNotification(req.user!.id, Number(req.params.id));
  res.json({ success: true, data: { unread: await unreadCount(req.user!.id) } });
});
