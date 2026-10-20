import type { Request, Response } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { logActivity } from '../activity/activity.service';
import { applyOpname, createOpname, listOpnames } from './opname.service';
import type { CreateOpnameInput, OpnameQuery } from './opname.schema';

export const list = asyncHandler(async (req: Request, res: Response) => {
  const result = await listOpnames(req.query as unknown as OpnameQuery);
  res.json({ success: true, data: result.items, meta: result.meta });
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const input = req.body as CreateOpnameInput;
  const opname = await createOpname(input, req.user!.id);

  await logActivity({
    userId: req.user!.id,
    actorName: req.user!.username,
    action: 'opname.create',
    entityType: 'stock_opname',
    entityId: opname.id,
    description: `Opname "${opname.bookTitle}": sistem ${opname.expected}, fisik ${opname.counted}.`,
    metadata: { difference: opname.difference },
    ipAddress: req.ip ?? undefined,
  });

  res.status(201).json({
    success: true,
    data: opname,
    message: 'Hasil hitung fisik disimpan. Stok belum berubah sampai disetujui.',
  });
});

export const apply = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const opname = await applyOpname(id, req.user!.id);

  await logActivity({
    userId: req.user!.id,
    actorName: req.user!.username,
    action: 'opname.apply',
    entityType: 'stock_opname',
    entityId: opname.id,
    description: `Opname "${opname.bookTitle}" diterapkan ke stok (selisih ${opname.difference}).`,
    metadata: { difference: opname.difference },
    ipAddress: req.ip ?? undefined,
  });

  res.json({
    success: true,
    data: opname,
    message: 'Selisih opname diterapkan ke stok.',
  });
});
