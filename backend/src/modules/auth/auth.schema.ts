import { z } from 'zod';

const password = z
  .string()
  .min(8, 'Kata sandi minimal 8 karakter.')
  .max(72, 'Kata sandi maksimal 72 karakter.')
  .regex(/[A-Za-z]/, 'Kata sandi harus mengandung huruf.')
  .regex(/[0-9]/, 'Kata sandi harus mengandung angka.');

export const loginSchema = z.object({
  identifier: z
    .string({ required_error: 'Username atau email wajib diisi.' })
    .trim()
    .min(1, 'Username atau email wajib diisi.')
    .max(120, 'Username atau email terlalu panjang.'),
  password: z.string({ required_error: 'Kata sandi wajib diisi.' }).min(1, 'Kata sandi wajib diisi.'),
});

/**
 * Public self-registration.
 *
 * NOTE: `role` is intentionally NOT part of this schema. Public registration
 * can only ever create a `user` (student) account; the service hard-codes it.
 */
export const registerSchema = z
  .object({
    username: z
      .string({ required_error: 'Username wajib diisi.' })
      .trim()
      .min(3, 'Username minimal 3 karakter.')
      .max(50, 'Username maksimal 50 karakter.')
      .regex(/^[a-zA-Z0-9._-]+$/, 'Username hanya boleh berisi huruf, angka, titik, garis bawah, atau strip.'),
    email: z
      .string({ required_error: 'Email wajib diisi.' })
      .trim()
      .toLowerCase()
      .email('Format email tidak valid.'),
    fullName: z
      .string({ required_error: 'Nama lengkap wajib diisi.' })
      .trim()
      .min(3, 'Nama lengkap minimal 3 karakter.')
      .max(100, 'Nama lengkap maksimal 100 karakter.'),
    className: z.string().trim().max(50, 'Kelas maksimal 50 karakter.').optional().or(z.literal('')),
    phone: z
      .string()
      .trim()
      .regex(/^[0-9+\-\s()]{8,30}$/, 'Nomor telepon tidak valid.')
      .optional()
      .or(z.literal('')),
    password,
    confirmPassword: z.string({ required_error: 'Konfirmasi kata sandi wajib diisi.' }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Konfirmasi kata sandi tidak cocok.',
    path: ['confirmPassword'],
  });

export const updateProfileSchema = z
  .object({
    fullName: z.string().trim().min(3, 'Nama lengkap minimal 3 karakter.').max(100).optional(),
    className: z.string().trim().max(50).optional().or(z.literal('')),
    phone: z
      .string()
      .trim()
      .regex(/^[0-9+\-\s()]{8,30}$/, 'Nomor telepon tidak valid.')
      .optional()
      .or(z.literal('')),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Tidak ada perubahan yang dikirim.',
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string({ required_error: 'Kata sandi saat ini wajib diisi.' }).min(1, 'Kata sandi saat ini wajib diisi.'),
    newPassword: password,
    confirmPassword: z.string({ required_error: 'Konfirmasi kata sandi wajib diisi.' }),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Konfirmasi kata sandi tidak cocok.',
    path: ['confirmPassword'],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'Kata sandi baru harus berbeda dari kata sandi saat ini.',
    path: ['newPassword'],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
