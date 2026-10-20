import type { Request, Response } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { logActivity } from '../activity/activity.service';
import {
  createAnnouncement,
  deleteAnnouncement,
  getAnnouncement,
  listAnnouncements,
  updateAnnouncement,
} from './announcements.service';
import type {
  AnnouncementQuery,
  CreateAnnouncementInput,
  UpdateAnnouncementInput,
} from './announcements.schema';

export const list = asyncHandler(async (req: Request, res: Response) => {
  const result = await listAnnouncements(
    req.query as unknown as AnnouncementQuery,
    req.user!.role,
  );
  res.json({ success: true, data: result.items, meta: result.meta });
});

export const detail = asyncHandler(async (req: Request, res: Response) => {
  const announcement = await getAnnouncement(Number(req.params.id));
  // A member must not read a staff-only announcement by guessing its id.
  if (req.user!.role === 'user' && announcement.audience === 'admin') {
    res.status(404).json({ success: false, error: { message: 'Pengumuman tidak ditemukan.' } });
    return;
  }
  res.json({ success: true, data: announcement });
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const announcement = await createAnnouncement(
    req.body as CreateAnnouncementInput,
    req.user!.id,
  );

  await logActivity({
    userId: req.user!.id,
    actorName: req.user!.username,
    action: 'announcement.create',
    entityType: 'announcement',
    entityId: announcement.id,
    description: `Membuat pengumuman "${announcement.title}".`,
    ipAddress: req.ip ?? undefined,
  });

  res.status(201).json({
    success: true,
    data: announcement,
    message: 'Pengumuman diterbitkan.',
  });
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const announcement = await updateAnnouncement(
    Number(req.params.id),
    req.body as UpdateAnnouncementInput,
  );

  await logActivity({
    userId: req.user!.id,
    actorName: req.user!.username,
    action: 'announcement.update',
    entityType: 'announcement',
    entityId: announcement.id,
    description: `Mengubah pengumuman "${announcement.title}".`,
    ipAddress: req.ip ?? undefined,
  });

  res.json({ success: true, data: announcement, message: 'Pengumuman diperbarui.' });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  await deleteAnnouncement(id);

  await logActivity({
    userId: req.user!.id,
    actorName: req.user!.username,
    action: 'announcement.delete',
    entityType: 'announcement',
    entityId: id,
    description: 'Menghapus pengumuman.',
    ipAddress: req.ip ?? undefined,
  });

  res.json({ success: true, message: 'Pengumuman dihapus.' });
});
