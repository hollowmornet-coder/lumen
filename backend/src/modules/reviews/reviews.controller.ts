import type { Request, Response } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { logActivity } from '../activity/activity.service';
import {
  deleteReview,
  getMyReview,
  listReviews,
  reviewStats,
  upsertReview,
} from './reviews.service';
import type { CreateReviewInput, ReviewQuery } from './reviews.schema';

export const list = asyncHandler(async (req: Request, res: Response) => {
  const result = await listReviews(req.query as unknown as ReviewQuery);
  res.json({ success: true, data: result.items, meta: result.meta });
});

export const stats = asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await reviewStats(Number(req.params.bookId)) });
});

export const mine = asyncHandler(async (req: Request, res: Response) => {
  const review = await getMyReview(req.user!.id, Number(req.params.bookId));
  res.json({ success: true, data: review });
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const bookId = Number(req.params.bookId);
  const review = await upsertReview(req.user!.id, bookId, req.body as CreateReviewInput);

  await logActivity({
    userId: req.user!.id,
    actorName: req.user!.username,
    action: 'review.create',
    entityType: 'book_review',
    entityId: review.id,
    description: `Menulis ulasan ${review.rating} bintang untuk "${review.bookTitle ?? bookId}".`,
    metadata: { rating: review.rating },
    ipAddress: req.ip ?? undefined,
  });

  res.status(201).json({
    success: true,
    data: review,
    message: 'Ulasan tersimpan.',
  });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  await deleteReview(id, { id: req.user!.id, role: req.user!.role });

  await logActivity({
    userId: req.user!.id,
    actorName: req.user!.username,
    action: 'review.delete',
    entityType: 'book_review',
    entityId: id,
    description: 'Menghapus ulasan buku.',
    ipAddress: req.ip ?? undefined,
  });

  res.json({ success: true, message: 'Ulasan dihapus.' });
});
