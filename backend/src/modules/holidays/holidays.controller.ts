import type { Request, Response } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { logActivity } from '../activity/activity.service';
import { createHoliday, deleteHoliday, listHolidays } from './holidays.service';
import type { CreateHolidayInput, HolidayQuery } from './holidays.schema';

export const list = asyncHandler(async (req: Request, res: Response) => {
  const items = await listHolidays(req.query as unknown as HolidayQuery);
  res.json({ success: true, data: items });
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const input = req.body as CreateHolidayInput;
  const holiday = await createHoliday(input);

  await logActivity({
    userId: req.user!.id,
    actorName: req.user!.username,
    action: 'holiday.create',
    entityType: 'holiday',
    entityId: holiday.id,
    description: `Menambah hari libur ${holiday.date} (${holiday.name}).`,
    ipAddress: req.ip ?? undefined,
  });

  res.status(201).json({
    success: true,
    data: holiday,
    message: 'Hari libur berhasil ditambahkan.',
  });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  await deleteHoliday(id);

  await logActivity({
    userId: req.user!.id,
    actorName: req.user!.username,
    action: 'holiday.delete',
    entityType: 'holiday',
    entityId: id,
    description: 'Menghapus hari libur.',
    ipAddress: req.ip ?? undefined,
  });

  res.json({ success: true, message: 'Hari libur dihapus.' });
});
