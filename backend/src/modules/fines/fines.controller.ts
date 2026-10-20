import type { Request, Response } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { logActivity } from '../activity/activity.service';
import { notify } from '../notifications/notifications.service';
import {
  getFineSummary,
  listFines,
  listMyFines,
  settleFine,
} from './fines.service';
import type { FineQuery, SettleFineInput } from './fines.schema';

const formatRupiah = (n: number) => `Rp${n.toLocaleString('id-ID')}`;

export const list = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as FineQuery;
  const result = await listFines(query);
  // The summary follows the same period filter, otherwise the totals would
  // describe a different set of rows than the table below them.
  const summary = await getFineSummary(undefined, { from: query.from, to: query.to });
  res.json({ success: true, data: result.items, meta: result.meta, summary });
});

export const mine = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as FineQuery;
  const result = await listMyFines(req.user!.id, query);
  const summary = await getFineSummary(req.user!.id, { from: query.from, to: query.to });
  res.json({ success: true, data: result.items, meta: result.meta, summary });
});

export const settle = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const body = req.body as SettleFineInput;
  const fine = await settleFine(id, req.user!.id, body.action, body.note);

  await logActivity({
    userId: req.user!.id,
    actorName: req.user!.fullName,
    action: 'fine.settle',
    entityType: 'fine',
    entityId: id,
    description: `${body.action === 'pay' ? 'Menerima pembayaran' : 'Membebaskan'} denda ${formatRupiah(fine.amount)} untuk ${fine.member.fullName}`,
    metadata: { kind: fine.kind, amount: fine.amount, action: body.action },
    ipAddress: req.ip ?? undefined,
  });

  if (body.action === 'pay') {
    await notify({
      userId: fine.userId,
      type: 'fine.created',
      title: 'Pembayaran denda diterima',
      body: `Denda ${formatRupiah(fine.amount)} untuk "${fine.book.title}" telah lunas.`,
      link: '/perpustakaan/denda',
      dedupeKey: `fine-paid-${fine.id}`,
    });
  }

  res.json({
    success: true,
    data: fine,
    message: body.action === 'pay' ? 'Pembayaran denda dicatat.' : 'Denda dibebaskan.',
  });
});
