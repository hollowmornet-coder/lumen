import type { Request, Response } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { logActivity } from '../activity/activity.service';
import {
  cancelReservation,
  createReservation,
  listMyReservations,
  listReservations,
  queueOverview,
} from './reservations.service';
import type { CreateReservationInput, ReservationQuery } from './reservations.schema';

export const mine = asyncHandler(async (req: Request, res: Response) => {
  const data = await listMyReservations(req.user!.id);
  res.json({ success: true, data });
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as CreateReservationInput;
  const reservation = await createReservation(req.user!.id, body.bookId, body.note);

  await logActivity({
    userId: req.user!.id,
    actorName: req.user!.fullName,
    action: 'reservation.create',
    entityType: 'reservation',
    entityId: reservation.id,
    description: `Mengantre untuk buku "${reservation.book.title}"`,
    ipAddress: req.ip ?? undefined,
  });

  res.status(201).json({
    success: true,
    data: reservation,
    message:
      reservation.queuePosition && reservation.queuePosition > 1
        ? `Anda masuk antrean nomor ${reservation.queuePosition}.`
        : 'Anda masuk antrean. Kami kabari begitu buku tersedia.',
  });
});

export const cancel = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const isAdmin = req.user!.role === 'admin';
  const reservation = await cancelReservation(id, req.user!.id, isAdmin);

  await logActivity({
    userId: req.user!.id,
    actorName: req.user!.fullName,
    action: 'reservation.cancel',
    entityType: 'reservation',
    entityId: id,
    description: `Membatalkan antrean buku "${reservation.book.title}"`,
    ipAddress: req.ip ?? undefined,
  });

  res.json({ success: true, data: reservation, message: 'Antrean dibatalkan.' });
});

// --- Admin ---

export const list = asyncHandler(async (req: Request, res: Response) => {
  const result = await listReservations(req.query as unknown as ReservationQuery);
  res.json({ success: true, data: result.items, meta: result.meta });
});

export const queue = asyncHandler(async (_req: Request, res: Response) => {
  const data = await queueOverview();
  res.json({ success: true, data });
});
