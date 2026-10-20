import { z } from 'zod';

export const reservationQuerySchema = z.object({
  status: z.enum(['all', 'waiting', 'ready', 'fulfilled', 'expired', 'cancelled']).optional().default('all'),
  bookId: z.coerce.number().int().positive().optional(),
  userId: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(20),
});

export const createReservationSchema = z.object({
  bookId: z.coerce
    .number({ invalid_type_error: 'Buku tidak valid.' })
    .int('Buku tidak valid.')
    .positive('Buku tidak valid.'),
  note: z.string().trim().max(255, 'Catatan maksimal 255 karakter.').optional(),
});

export type ReservationQuery = z.infer<typeof reservationQuerySchema>;
export type CreateReservationInput = z.infer<typeof createReservationSchema>;
