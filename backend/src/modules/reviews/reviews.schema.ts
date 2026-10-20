import { z } from 'zod';

export const createReviewSchema = z.object({
  rating: z.coerce
    .number({ required_error: 'Rating wajib diisi.' })
    .int('Rating harus bilangan bulat.')
    .min(1, 'Rating minimal 1 bintang.')
    .max(5, 'Rating maksimal 5 bintang.'),
  comment: z.string().trim().max(1000, 'Ulasan maksimal 1000 karakter.').optional(),
});

export const reviewQuerySchema = z.object({
  bookId: z.coerce.number().int().positive().optional(),
  userId: z.coerce.number().int().positive().optional(),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(10),
  sort: z.enum(['created_at', 'rating']).optional().default('created_at'),
  direction: z.enum(['ASC', 'DESC']).optional().default('DESC'),
});

export const reviewIdSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export type CreateReviewInput = z.infer<typeof createReviewSchema>;
export type ReviewQuery = z.infer<typeof reviewQuerySchema>;
