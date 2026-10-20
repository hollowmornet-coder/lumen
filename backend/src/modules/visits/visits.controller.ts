import type { Request, Response } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { logActivity } from '../activity/activity.service';
import { listVisits, recordVisit, visitSummary } from './visits.service';
import type { CreateVisitInput, VisitQuery } from './visits.schema';

export const list = asyncHandler(async (req: Request, res: Response) => {
  const result = await listVisits(req.query as unknown as VisitQuery);
  res.json({ success: true, data: result.items, meta: result.meta });
});

export const summary = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ success: true, data: await visitSummary() });
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const input = req.body as CreateVisitInput;
  const { visit, alreadyRecorded } = await recordVisit(input, req.user!.id);

  // Only a genuinely new visit is audited; otherwise every rescan of the same
  // card would fill the activity log with noise.
  if (!alreadyRecorded) {
    await logActivity({
      userId: req.user!.id,
      actorName: req.user!.username,
      action: 'visit.create',
      entityType: 'visit',
      entityId: visit.id,
      description: `Kunjungan dicatat: ${visit.memberName}.`,
      metadata: { purpose: visit.purpose },
      ipAddress: req.ip ?? undefined,
    });
  }

  res.status(alreadyRecorded ? 200 : 201).json({
    success: true,
    data: visit,
    message: alreadyRecorded
      ? `${visit.memberName} sudah tercatat berkunjung hari ini.`
      : 'Kunjungan berhasil dicatat.',
  });
});
