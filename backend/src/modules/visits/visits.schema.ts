import { z } from 'zod';

const dateOnly = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD.');

export const createVisitSchema = z
  .object({
    /** Either a known member, or a free-text name for a guest. */
    userId: z.coerce.number().int().positive().optional(),
    guestName: z.string().trim().min(2, 'Nama tamu minimal 2 karakter.').max(100).optional(),
    purpose: z.enum(['read', 'borrow', 'return', 'study', 'other']).optional().default('read'),
  })
  .refine((d) => d.userId !== undefined || (d.guestName !== undefined && d.guestName.length > 0), {
    message: 'Pilih anggota atau isi nama tamu.',
    path: ['userId'],
  });

export const visitQuerySchema = z.object({
  from: dateOnly.optional(),
  to: dateOnly.optional(),
  userId: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(20),
});

export type CreateVisitInput = z.infer<typeof createVisitSchema>;
export type VisitQuery = z.infer<typeof visitQuerySchema>;
