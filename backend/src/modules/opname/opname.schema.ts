import { z } from 'zod';

export const createOpnameSchema = z.object({
  bookId: z.coerce.number({ required_error: 'Buku wajib dipilih.' }).int().positive(),
  counted: z.coerce
    .number({ required_error: 'Jumlah fisik wajib diisi.' })
    .int()
    .min(0, 'Jumlah fisik tidak boleh negatif.')
    .max(10_000, 'Jumlah fisik tidak wajar.'),
  note: z.string().trim().max(255).optional(),
});

export const opnameQuerySchema = z.object({
  /** `pending` = not yet applied to stock. */
  status: z.enum(['all', 'pending', 'applied']).optional().default('all'),
  bookId: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(20),
});

export type CreateOpnameInput = z.infer<typeof createOpnameSchema>;
export type OpnameQuery = z.infer<typeof opnameQuerySchema>;
