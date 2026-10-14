import { z } from 'zod';

const usernamePattern = /^[a-zA-Z0-9._-]+$/;

export const memberQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  role: z.enum(['all', 'user']).optional().default('user'),
  status: z.enum(['all', 'active', 'inactive']).optional().default('all'),
  sort: z.enum(['full_name', 'username', 'member_code', 'created_at', 'last_login_at']).optional().default('created_at'),
  direction: z.enum(['ASC', 'DESC']).optional().default('DESC'),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(12),
});

export const createMemberSchema = z.object({
  username: z
    .string({ required_error: 'Username wajib diisi.' })
    .trim()
    .min(3, 'Username minimal 3 karakter.')
    .max(50)
    .regex(usernamePattern, 'Username hanya boleh berisi huruf, angka, titik, garis bawah, atau strip.'),
  email: z.string({ required_error: 'Email wajib diisi.' }).trim().toLowerCase().email('Format email tidak valid.'),
  fullName: z.string({ required_error: 'Nama lengkap wajib diisi.' }).trim().min(3, 'Nama lengkap minimal 3 karakter.').max(100),
  className: z.string().trim().max(50).optional().or(z.literal('')),
  phone: z.string().trim().regex(/^[0-9+\-\s()]{8,30}$/, 'Nomor telepon tidak valid.').optional().or(z.literal('')),
  address: z.string().trim().max(200).optional().or(z.literal('')),
  // Optional here because the library usually issues a temporary password.
  password: z
    .string()
    .min(8, 'Kata sandi minimal 8 karakter.')
    .max(72)
    .regex(/[A-Za-z]/, 'Kata sandi harus mengandung huruf.')
    .regex(/[0-9]/, 'Kata sandi harus mengandung angka.')
    .optional(),
  status: z.enum(['active', 'inactive']).optional().default('active'),
});

export const updateMemberSchema = z
  .object({
    fullName: z.string().trim().min(3, 'Nama lengkap minimal 3 karakter.').max(100).optional(),
    email: z.string().trim().toLowerCase().email('Format email tidak valid.').optional(),
    className: z.string().trim().max(50).optional().or(z.literal('')),
    phone: z.string().trim().regex(/^[0-9+\-\s()]{8,30}$/, 'Nomor telepon tidak valid.').optional().or(z.literal('')),
    address: z.string().trim().max(200).optional().or(z.literal('')),
    status: z.enum(['active', 'inactive']).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Tidak ada perubahan yang dikirim.',
  });

export const memberStatusSchema = z.object({
  status: z.enum(['active', 'inactive'], {
    errorMap: () => ({ message: 'Status harus berupa active atau inactive.' }),
  }),
});

/** Admin can reset a member's password without knowing the old one. */
export const resetPasswordSchema = z.object({
  newPassword: z
    .string({ required_error: 'Kata sandi baru wajib diisi.' })
    .min(8, 'Kata sandi minimal 8 karakter.')
    .max(72)
    .regex(/[A-Za-z]/, 'Kata sandi harus mengandung huruf.')
    .regex(/[0-9]/, 'Kata sandi harus mengandung angka.'),
});

export type MemberQuery = z.infer<typeof memberQuerySchema>;
export type CreateMemberInput = z.infer<typeof createMemberSchema>;
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
