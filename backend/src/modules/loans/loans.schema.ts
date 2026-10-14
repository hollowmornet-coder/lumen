import { z } from 'zod';

export const loanQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  status: z
    .enum([
      'all',
      'pending',
      'approved',
      'rejected',
      'borrowed',
      'return_requested',
      'returned',
      'cancelled',
      'overdue',
      'active',
    ])
    .optional()
    .default('all'),
  userId: z.coerce.number().int().positive().optional(),
  bookId: z.coerce.number().int().positive().optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  /** Inclusive YYYY-MM-DD bounds. Used by the dashboard date-range filter. */
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD.')
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD.')
    .optional(),
  sort: z
    .enum(['requested_at', 'due_at', 'returned_at', 'title', 'full_name', 'status'])
    .optional()
    .default('requested_at'),
  direction: z.enum(['ASC', 'DESC']).optional().default('DESC'),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(12),
});

export const requestLoanSchema = z.object({
  bookId: z.coerce
    .number({ invalid_type_error: 'Buku tidak valid.' })
    .int('Buku tidak valid.')
    .positive('Buku tidak valid.'),
  note: z.string().trim().max(255, 'Catatan maksimal 255 karakter.').optional(),
});

export const rejectLoanSchema = z.object({
  reason: z
    .string({ required_error: 'Alasan penolakan wajib diisi.' })
    .trim()
    .min(3, 'Alasan penolakan minimal 3 karakter.')
    .max(255, 'Alasan penolakan maksimal 255 karakter.'),
});

export const confirmReturnSchema = z
  .object({
    condition: z.enum(['good', 'damaged', 'lost']).optional().default('good'),
    note: z.string().trim().max(255, 'Catatan maksimal 255 karakter.').optional(),
  })
  .refine(
    (data) => data.condition === 'good' || (data.note && data.note.length >= 3),
    {
      message: 'Catatan wajib diisi jika buku rusak atau hilang.',
      path: ['note'],
    },
  );

export type LoanQuery = z.infer<typeof loanQuerySchema>;
export type RequestLoanInput = z.infer<typeof requestLoanSchema>;
export type RejectLoanInput = z.infer<typeof rejectLoanSchema>;
export type ConfirmReturnInput = z.infer<typeof confirmReturnSchema>;
