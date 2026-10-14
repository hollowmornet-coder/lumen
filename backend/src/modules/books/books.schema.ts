import { z } from 'zod';

/**
 * ISBN format check (ISBN-10 or ISBN-13, hyphens/spaces allowed).
 *
 * NOTE: we validate *format* only, not the mod-10/11 checksum. Real-world
 * catalogues in Indonesian schools frequently contain locally-printed ISBNs
 * that fail a strict checksum, and rejecting those would block legitimate
 * data entry. Documented as a known limitation in docs/DESKRIPSI_PROGRAM.md.
 */
const isbnPattern = /^(?:\d[-\s]?){9}[\dXx]$|^(?:\d[-\s]?){13}$/;

export const isbnSchema = z
  .string({ required_error: 'ISBN wajib diisi.' })
  .trim()
  .min(10, 'ISBN minimal 10 karakter.')
  .max(20, 'ISBN maksimal 20 karakter.')
  .regex(isbnPattern, 'Format ISBN tidak valid. Gunakan ISBN-10 atau ISBN-13.');

const bookBase = {
  isbn: isbnSchema,
  title: z
    .string({ required_error: 'Judul wajib diisi.' })
    .trim()
    .min(2, 'Judul minimal 2 karakter.')
    .max(200, 'Judul maksimal 200 karakter.'),
  author: z
    .string({ required_error: 'Penulis wajib diisi.' })
    .trim()
    .min(2, 'Penulis minimal 2 karakter.')
    .max(150, 'Penulis maksimal 150 karakter.'),
  publisher: z.string().trim().max(120, 'Penerbit maksimal 120 karakter.').optional().nullable(),
  publishYear: z.coerce
    .number({ invalid_type_error: 'Tahun terbit harus berupa angka.' })
    .int('Tahun terbit harus bilangan bulat.')
    .min(1000, 'Tahun terbit tidak valid.')
    .max(new Date().getFullYear() + 1, 'Tahun terbit tidak valid.')
    .optional()
    .nullable(),
  categoryId: z.coerce.number({ invalid_type_error: 'Kategori tidak valid.' }).int().positive().optional().nullable(),
  description: z.string().trim().max(2000, 'Deskripsi maksimal 2000 karakter.').optional().nullable(),
  shelfLocation: z.string().trim().max(50, 'Lokasi rak maksimal 50 karakter.').optional().nullable(),
  totalCopies: z.coerce
    .number({ invalid_type_error: 'Jumlah eksemplar harus berupa angka.' })
    .int('Jumlah eksemplar harus bilangan bulat.')
    .min(1, 'Jumlah eksemplar minimal 1.')
    .max(999, 'Jumlah eksemplar maksimal 999.')
    .default(1),
  status: z.enum(['active', 'inactive']).optional().default('active'),
};

export const createBookSchema = z.object(bookBase);

export const updateBookSchema = z
  .object({
    ...bookBase,
    totalCopies: bookBase.totalCopies.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Tidak ada perubahan yang dikirim.',
  });

export const bookQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  availability: z.enum(['all', 'available', 'unavailable']).optional().default('all'),
  status: z.enum(['all', 'active', 'inactive']).optional().default('all'),
  sort: z
    .enum(['title', 'author', 'publish_year', 'available_copies', 'created_at', 'isbn'])
    .optional()
    .default('title'),
  direction: z.enum(['ASC', 'DESC']).optional().default('ASC'),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(12),
});

export const bookStatusSchema = z.object({
  status: z.enum(['active', 'inactive'], {
    errorMap: () => ({ message: 'Status harus berupa active atau inactive.' }),
  }),
});

export const categorySchema = z.object({
  name: z
    .string({ required_error: 'Nama kategori wajib diisi.' })
    .trim()
    .min(2, 'Nama kategori minimal 2 karakter.')
    .max(80, 'Nama kategori maksimal 80 karakter.'),
  description: z.string().trim().max(255).optional().nullable(),
});

export const updateCategorySchema = categorySchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: 'Tidak ada perubahan yang dikirim.' },
);

export type CreateBookInput = z.infer<typeof createBookSchema>;
export type UpdateBookInput = z.infer<typeof updateBookSchema>;
export type BookQuery = z.infer<typeof bookQuerySchema>;
export type CategoryInput = z.infer<typeof categorySchema>;
