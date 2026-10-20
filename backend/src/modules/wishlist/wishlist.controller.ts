import type { Request, Response } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { logActivity } from '../activity/activity.service';
import {
  addToWishlist,
  listWishlist,
  removeFromWishlist,
  wishlistBookIds,
  wishlistDemand,
} from './wishlist.service';
import type { AddWishlistInput, WishlistQuery } from './wishlist.schema';

export const list = asyncHandler(async (req: Request, res: Response) => {
  const result = await listWishlist(req.user!.id, req.query as unknown as WishlistQuery);
  res.json({ success: true, data: result.items, meta: result.meta });
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const { bookId } = req.body as AddWishlistInput;
  const item = await addToWishlist(req.user!.id, bookId);

  await logActivity({
    userId: req.user!.id,
    actorName: req.user!.fullName,
    action: 'wishlist.add',
    entityType: 'book',
    entityId: bookId,
    description: `Menambahkan "${item.title}" ke daftar keinginan.`,
    ipAddress: req.ip ?? undefined,
  });

  res.status(201).json({
    success: true,
    data: item,
    message: 'Ditambahkan ke daftar keinginan.',
  });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const bookId = Number(req.params.bookId);
  await removeFromWishlist(req.user!.id, bookId);

  await logActivity({
    userId: req.user!.id,
    actorName: req.user!.fullName,
    action: 'wishlist.remove',
    entityType: 'book',
    entityId: bookId,
    description: 'Menghapus buku dari daftar keinginan.',
    ipAddress: req.ip ?? undefined,
  });

  res.json({ success: true, message: 'Dihapus dari daftar keinginan.' });
});

/** Batch lookup so a catalogue page can mark hearts without N requests. */
export const check = asyncHandler(async (req: Request, res: Response) => {
  const raw = String(req.query.bookIds ?? '');
  const ids = raw
    .split(',')
    .map((v) => Number(v.trim()))
    .filter((v) => Number.isInteger(v) && v > 0)
    .slice(0, 100);

  res.json({ success: true, data: await wishlistBookIds(req.user!.id, ids) });
});

/** Staff view: most-wanted titles, for purchasing decisions. */
export const demand = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ success: true, data: await wishlistDemand() });
});
