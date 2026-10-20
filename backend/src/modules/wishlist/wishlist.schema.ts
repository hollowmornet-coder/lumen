import { z } from 'zod';

export const addWishlistSchema = z.object({
  bookId: z.coerce
    .number({ required_error: 'Buku wajib dipilih.' })
    .int('Buku tidak valid.')
    .positive('Buku tidak valid.'),
});

export const wishlistQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(12),
});

export type AddWishlistInput = z.infer<typeof addWishlistSchema>;
export type WishlistQuery = z.infer<typeof wishlistQuerySchema>;
