import * as React from 'react';
import { motion, useReducedMotion, type Variants } from 'framer-motion';
import { toast } from 'sonner';
import {
  ArrowUpDown,
  BookOpen,
  Download,
  FileSpreadsheet,
  ImagePlus,
  Pencil,
  Plus,
  Power,
  PowerOff,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Trash2,
  TriangleAlert,
  Upload,
  X,
} from 'lucide-react';
import { PageBody, PageHeader } from '@/components/layout/PageHeader';
import { BookCover, MiniCover } from '@/components/ui/book-cover';
import { Badge, BookStatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ConfirmContent,
  ConfirmDialog,
  ConfirmTrigger,
  Dialog,
  DialogClose,
  DialogContent,
} from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { TableSkeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState, NoResultsState } from '@/components/ui/states';
import { api, ApiError, downloadFile, type ApiFailure, type ApiSuccess } from '@/lib/api';
import {
  useApiMutation,
  useBooks,
  useCategories,
  useDebounced,
  useListParams,
} from '@/hooks/useApi';
import { formatNumber } from '@/lib/utils';
import { staggerContainer, staggerItem } from '@/lib/motion';
import type { Book, BookStatus, Category, ImportSummary } from '@/types';

/** Motion collapses to a static state when the OS asks for less movement. */
const STILL: Variants = { hidden: {}, show: {} };

/** Mirrors the `status` enum accepted by GET /api/books. */
const STATUS_OPTIONS = [
  { value: 'all', label: 'Semua status' },
  { value: 'active', label: 'Aktif' },
  { value: 'inactive', label: 'Nonaktif' },
] as const;

/** Mirrors the `sort` enum accepted by GET /api/books. */
const SORT_FIELDS = [
  { value: 'title', label: 'Judul buku' },
  { value: 'author', label: 'Penulis' },
  { value: 'publish_year', label: 'Tahun terbit' },
  { value: 'available_copies', label: 'Eksemplar tersedia' },
  { value: 'created_at', label: 'Tanggal ditambahkan' },
  { value: 'isbn', label: 'ISBN' },
] as const;

/** Everything that can shift once the catalogue changes. */
const INVALIDATE = [['books'], ['dashboard'], ['activity']] as const;

/**
 * POST /api/books and PATCH /api/books/:id both accept multipart/form-data with
 * the cover in the `cover` field. The shared `api` helper only knows how to
 * POST multipart, so the PATCH is issued directly. Content-Type is left to the
 * browser so the multipart boundary is set correctly.
 */
async function submitBook(
  method: 'POST' | 'PATCH',
  id: number | undefined,
  form: FormData,
): Promise<ApiSuccess<Book>> {
  const res = await fetch(id ? `/api/books/${id}` : '/api/books', {
    method,
    body: form,
    credentials: 'include',
  });

  if (!res.ok) {
    let failure: ApiFailure = {
      success: false,
      code: 'UNKNOWN',
      message: `Permintaan gagal (${res.status}).`,
    };
    try {
      failure = (await res.json()) as ApiFailure;
    } catch {
      /* keep the generic message */
    }
    throw new ApiError(res.status, failure);
  }

  return (await res.json()) as ApiSuccess<Book>;
}

function useBookMutations() {
  const save = useApiMutation<
    { id: number | undefined; form: FormData },
    ApiSuccess<Book>
  >({
    mutationFn: ({ id, form }) => submitBook(id ? 'PATCH' : 'POST', id, form),
    successMessage: (res) => res.message ?? 'Buku berhasil disimpan.',
    invalidate: INVALIDATE,
  });

  const setStatus = useApiMutation<{ id: number; status: BookStatus }, ApiSuccess<Book>>({
    mutationFn: async ({ id, status }) =>
      api.patch<Book>(`/books/${id}/status`, { status }),
    successMessage: (res) =>
      res.message ?? (res.data.status === 'active' ? 'Buku diaktifkan.' : 'Buku dinonaktifkan.'),
    invalidate: INVALIDATE,
  });

  const remove = useApiMutation<number, ApiSuccess<{ deleted: boolean; softDeleted: boolean }>>({
    mutationFn: async (id) =>
      api.delete<{ deleted: boolean; softDeleted: boolean }>(`/books/${id}`),
    successMessage: (res) => res.message ?? 'Buku berhasil dihapus.',
    invalidate: INVALIDATE,
  });

  return { save, setStatus, remove };
}

type BookMutations = ReturnType<typeof useBookMutations>;

export default function AdminBooksPage() {
  const defaults = React.useMemo(() => ({}), []);
  const { params, get, set, setMany, reset } = useListParams(defaults);

  const [term, setTerm] = React.useState(() => get('search'));
  const debouncedTerm = useDebounced(term, 350);

  const categoryId = get('categoryId');
  const status = get('status', 'all');
  const sort = get('sort', 'title');
  const direction = get('direction', 'ASC');
  const page = Number(get('page', '1')) || 1;
  const pageSize = Number(get('pageSize', '12')) || 12;

  // Mirror the debounced box into the address bar, but only when it differs,
  // so the effect can never fight itself into a loop.
  React.useEffect(() => {
    if ((params.get('search') ?? '') === debouncedTerm) return;
    setMany({ search: debouncedTerm || undefined, page: undefined });
  }, [debouncedTerm, params, setMany]);

  const query = React.useMemo(
    () => ({
      search: debouncedTerm || undefined,
      categoryId: categoryId || undefined,
      status,
      sort,
      direction,
      page,
      pageSize,
    }),
    [debouncedTerm, categoryId, status, sort, direction, page, pageSize],
  );

  const books = useBooks(query);
  const categories = useCategories();
  const mutations = useBookMutations();

  const reduce = useReducedMotion();
  const containerVariants = reduce ? STILL : staggerContainer(0.035);
  const rowVariants = reduce ? STILL : staggerItem;

  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Book | null>(null);
  const [importOpen, setImportOpen] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);

  const items = books.data?.items ?? [];
  const meta = books.data?.meta;
  const hasFilters = Boolean(debouncedTerm) || Boolean(categoryId) || status !== 'all';
  const activeStatusLabel = STATUS_OPTIONS.find((o) => o.value === status)?.label ?? 'Semua status';
  const activeCategoryLabel =
    categories.data?.find((c) => String(c.id) === categoryId)?.name ?? categoryId;

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (book: Book) => {
    setEditing(book);
    setFormOpen(true);
  };

  const clearFilters = () => {
    setTerm('');
    reset();
  };

  const toggleDirection = () => set('direction', direction === 'ASC' ? 'DESC' : 'ASC');

  const handleExport = async () => {
    setExporting(true);
    try {
      await downloadFile('/excel/export/books', {
        search: debouncedTerm || undefined,
        categoryId: categoryId || undefined,
        status: status === 'all' ? undefined : status,
      });
      toast.success('Berkas Excel buku berhasil diunduh.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Gagal mengunduh berkas Excel.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Koleksi"
        title="Kelola Buku"
        description="Tambah, ubah, aktifkan, dan hapus judul pada katalog. Data yang tampil sudah dibaca langsung dari database."
        breadcrumb={[
          { label: 'Dasbor', to: '/admin' },
          { label: 'Buku' },
        ]}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleExport()}
              loading={exporting}
            >
              <Download className="size-3.5" aria-hidden />
              Ekspor Excel
            </Button>
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <Upload className="size-3.5" aria-hidden />
              Impor Excel
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus className="size-3.5" aria-hidden />
              Tambah Buku
            </Button>
          </>
        }
        meta={
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {books.isLoading
              ? 'Memuat katalog...'
              : `${formatNumber(meta?.total ?? 0)} judul tercatat`}
            {meta && meta.total > 0 ? (
              <>
                {' · halaman '}
                <span className="font-medium text-foreground">{meta.page}</span> dari{' '}
                <span className="font-medium text-foreground">{meta.totalPages}</span>
              </>
            ) : null}
          </p>
        }
      />

      <PageBody className="space-y-4">
        {/* ---------- Filter bar ---------- */}
        <div className="panel p-4">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto_auto] md:items-end">
            <Field label="Cari buku" htmlFor="book-search">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  id="book-search"
                  type="search"
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  placeholder="Cari judul, penulis, atau ISBN..."
                  className="pl-9"
                />
                {term ? (
                  <button
                    type="button"
                    onClick={() => setTerm('')}
                    aria-label="Bersihkan pencarian"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <X className="size-3.5" aria-hidden />
                  </button>
                ) : null}
              </div>
            </Field>

            <Field label="Kategori" htmlFor="book-category" className="md:w-52">
              <Select
                id="book-category"
                value={categoryId}
                onChange={(e) => setMany({ categoryId: e.target.value || undefined, page: undefined })}
              >
                <option value="">Semua kategori</option>
                {(categories.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.bookCount})
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Status" htmlFor="book-status" className="md:w-44">
              <Select
                id="book-status"
                value={status}
                onChange={(e) => setMany({ status: e.target.value, page: undefined })}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Urutkan" htmlFor="book-sort" className="md:w-52">
              <Select
                id="book-sort"
                value={sort}
                onChange={(e) => setMany({ sort: e.target.value, page: undefined })}
              >
                {SORT_FIELDS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="flex items-end pb-0.5">
              <Button
                variant="outline"
                size="md"
                onClick={toggleDirection}
                aria-label={`Urutkan ${direction === 'ASC' ? 'menaik' : 'menurun'}`}
                className="w-full md:w-auto"
              >
                <ArrowUpDown className="size-4" aria-hidden />
                {direction === 'ASC' ? 'Naik' : 'Turun'}
              </Button>
            </div>
          </div>

          {hasFilters ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                <SlidersHorizontal className="size-3" aria-hidden />
                Filter aktif
              </span>
              {debouncedTerm ? <Badge tone="info">Kata kunci: {debouncedTerm}</Badge> : null}
              {categoryId ? <Badge tone="violet">Kategori: {activeCategoryLabel}</Badge> : null}
              {status !== 'all' ? <Badge tone="cyan">{activeStatusLabel}</Badge> : null}
              <button
                type="button"
                onClick={clearFilters}
                className="rounded text-2xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Atur ulang semua
              </button>
            </div>
          ) : null}
        </div>

        {/* ---------- Table ---------- */}
        <section className="panel overflow-hidden" aria-label="Daftar buku">
          {books.isFetching && !books.isLoading ? (
            <div className="pointer-events-none h-0.5 overflow-hidden bg-border" aria-hidden>
              <div className="h-full w-1/3 animate-shimmer bg-primary" />
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] border-collapse text-sm">
              <caption className="sr-only">
                Daftar buku beserta kategori, stok, status, dan tindakan petugas
              </caption>
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th
                    scope="col"
                    className="px-4 py-3 text-left text-2xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    Judul
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left text-2xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    Penulis
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left text-2xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    Kategori
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left text-2xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    ISBN
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left text-2xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    Rak
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left text-2xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    Stok
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left text-2xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    Status
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-right text-2xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    Aksi
                  </th>
                </tr>
              </thead>

              {books.isLoading ? (
                <tbody>
                  <tr>
                    <td colSpan={8} className="px-4 py-4">
                      <TableSkeleton rows={6} columns={4} />
                    </td>
                  </tr>
                </tbody>
              ) : books.isError ? (
                <tbody>
                  <tr>
                    <td colSpan={8}>
                      <ErrorState
                        title="Gagal memuat daftar buku"
                        message={books.error?.message}
                        onRetry={() => void books.refetch()}
                      />
                    </td>
                  </tr>
                </tbody>
              ) : items.length === 0 ? (
                <tbody>
                  <tr>
                    <td colSpan={8}>
                      {hasFilters ? (
                        <NoResultsState
                          onReset={clearFilters}
                          description="Tidak ada buku yang cocok dengan filter atau kata kunci pencarian."
                        />
                      ) : (
                        <EmptyState
                          icon={BookOpen}
                          title="Katalog masih kosong"
                          description="Tambahkan buku pertama, atau impor daftar buku dari berkas Excel."
                          action={
                            <div className="flex flex-wrap justify-center gap-2">
                              <Button size="sm" onClick={openCreate}>
                                <Plus className="size-3.5" aria-hidden />
                                Tambah Buku
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
                                <Upload className="size-3.5" aria-hidden />
                                Impor Excel
                              </Button>
                            </div>
                          }
                        />
                      )}
                    </td>
                  </tr>
                </tbody>
              ) : (
                <motion.tbody
                  key={`${categoryId}-${status}-${sort}-${direction}-${page}-${pageSize}-${debouncedTerm}`}
                  variants={containerVariants}
                  initial="hidden"
                  animate="show"
                >
                  {items.map((book) => (
                    <motion.tr
                      key={book.id}
                      variants={rowVariants}
                      className="border-b border-border transition-colors last:border-0 hover:bg-muted/40"
                    >
                      <td className="px-4 py-3 align-top">
                        <div className="flex items-start gap-3">
                          <MiniCover title={book.title} author={book.author} src={book.coverPath} />
                          <div className="min-w-0 max-w-[16rem]">
                            <p className="truncate font-display text-sm font-semibold text-foreground">
                              {book.title}
                            </p>
                            <p className="mt-0.5 text-2xs text-muted-foreground">
                              {book.publishYear ? `Tahun ${book.publishYear}` : 'Tahun belum diisi'}
                              {book.publisher ? ` · ${book.publisher}` : ''}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3 align-top">
                        <p className="max-w-[12rem] truncate text-sm text-foreground">
                          {book.author}
                        </p>
                      </td>

                      <td className="px-4 py-3 align-top">
                        {book.categoryName ? (
                          <Badge tone="violet">{book.categoryName}</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">Tanpa kategori</span>
                        )}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 align-top">
                        <span className="font-mono text-xs text-foreground">{book.isbn}</span>
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 align-top">
                        {book.shelfLocation ? (
                          <span className="font-mono text-xs text-foreground">
                            {book.shelfLocation}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 align-top">
                        <p className="text-sm font-semibold tabular-nums text-foreground">
                          {book.availableCopies}
                          <span className="font-normal text-muted-foreground">
                            /{book.totalCopies}
                          </span>
                        </p>
                        <p className="text-2xs text-muted-foreground">tersedia</p>
                      </td>

                      <td className="px-4 py-3 align-top">
                        <BookStatusBadge status={book.status} />
                      </td>

                      <td className="px-4 py-3 text-right align-top">
                        <BookActions book={book} actions={mutations} onEdit={openEdit} />
                      </td>
                    </motion.tr>
                  ))}
                </motion.tbody>
              )}
            </table>
          </div>

          {meta && items.length > 0 ? (
            <Pagination
              page={meta.page}
              totalPages={meta.totalPages}
              total={meta.total}
              pageSize={meta.pageSize}
              onPageChange={(p) => {
                set('page', p);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onPageSizeChange={(s) => setMany({ pageSize: s, page: undefined })}
            />
          ) : null}
        </section>
      </PageBody>

      <BookFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        book={editing}
        categories={categories.data ?? []}
        save={mutations.save}
      />

      <ImportBooksDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={() => void books.refetch()}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */

function BookActions({
  book,
  actions,
  onEdit,
}: {
  book: Book;
  actions: BookMutations;
  onEdit: (book: Book) => void;
}) {
  const isActive = book.status === 'active';
  const busy = actions.setStatus.isPending || actions.remove.isPending;

  return (
    <div className="flex items-center justify-end gap-1">
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => onEdit(book)}
        aria-label={`Ubah buku ${book.title}`}
        title="Ubah buku"
      >
        <Pencil className="size-3.5" aria-hidden />
      </Button>

      <Button
        variant="ghost"
        size="icon-sm"
        disabled={busy}
        onClick={() => {
          void actions.setStatus.mutateAsync({
            id: book.id,
            status: isActive ? 'inactive' : 'active',
          }).catch(() => {
            // The toast already carries the server message.
          });
        }}
        aria-label={
          isActive ? `Nonaktifkan buku ${book.title}` : `Aktifkan buku ${book.title}`
        }
        title={isActive ? 'Nonaktifkan buku' : 'Aktifkan buku'}
      >
        {isActive ? (
          <PowerOff className="size-3.5" aria-hidden />
        ) : (
          <Power className="size-3.5" aria-hidden />
        )}
      </Button>

      <ConfirmDialog>
        <ConfirmTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-destructive hover:bg-destructive-soft hover:text-destructive"
            aria-label={`Hapus buku ${book.title}`}
            title="Hapus buku"
          >
            <Trash2 className="size-3.5" aria-hidden />
          </Button>
        </ConfirmTrigger>
        <ConfirmContent
          title="Hapus buku ini?"
          confirmLabel="Ya, hapus"
          cancelLabel="Batal"
          onConfirm={async () => {
            try {
              await actions.remove.mutateAsync(book.id);
            } catch {
              // The toast already carries the server message.
            }
          }}
          description={
            <>
              <strong>{book.title}</strong> akan dihapus dari katalog. Buku yang sudah pernah
              dipinjam tidak dapat dihapus permanen karena riwayat transaksinya harus disimpan.
              Pada kasus tersebut, server akan menonaktifkan buku tersebut dan mengembalikan
              pesan hasilnya.
            </>
          }
        >
          <p className="font-mono text-xs text-muted-foreground">
            ISBN: {book.isbn} · {book.availableCopies}/{book.totalCopies} eksemplar tersedia
          </p>
        </ConfirmContent>
      </ConfirmDialog>
    </div>
  );
}

/* ------------------------------------------------------------------ */

interface BookForm {
  isbn: string;
  title: string;
  author: string;
  publisher: string;
  publishYear: string;
  categoryId: string;
  shelfLocation: string;
  totalCopies: string;
  description: string;
}

type BookFormErrors = Partial<Record<keyof BookForm, string>>;

const EMPTY_FORM: BookForm = {
  isbn: '',
  title: '',
  author: '',
  publisher: '',
  publishYear: '',
  categoryId: '',
  shelfLocation: '',
  totalCopies: '1',
  description: '',
};

function formFromBook(book: Book): BookForm {
  return {
    isbn: book.isbn,
    title: book.title,
    author: book.author,
    publisher: book.publisher ?? '',
    publishYear: book.publishYear ? String(book.publishYear) : '',
    categoryId: book.categoryId ? String(book.categoryId) : '',
    shelfLocation: book.shelfLocation ?? '',
    totalCopies: String(book.totalCopies),
    description: book.description ?? '',
  };
}

/** Mirrors createBookSchema on the server so the officer gets feedback first. */
function validateForm(form: BookForm): BookFormErrors {
  const errors: BookFormErrors = {};
  const isbn = form.isbn.trim();
  const title = form.title.trim();
  const author = form.author.trim();

  if (isbn.length < 10) {
    errors.isbn = 'ISBN minimal 10 karakter.';
  } else if (!/^(?:\d[-\s]?){9}[\dXx]$|^(?:\d[-\s]?){13}$/.test(isbn)) {
    errors.isbn = 'Format ISBN tidak valid. Gunakan ISBN-10 atau ISBN-13.';
  }

  if (title.length < 2) errors.title = 'Judul minimal 2 karakter.';
  if (author.length < 2) errors.author = 'Penulis minimal 2 karakter.';

  if (form.publishYear.trim()) {
    const year = Number(form.publishYear);
    if (!Number.isInteger(year) || year < 1000 || year > new Date().getFullYear() + 1) {
      errors.publishYear = 'Tahun terbit tidak valid.';
    }
  }

  const copies = Number(form.totalCopies);
  if (!Number.isInteger(copies) || copies < 1 || copies > 999) {
    errors.totalCopies = 'Jumlah eksemplar harus antara 1 dan 999.';
  }

  if (form.description.trim().length > 2000) {
    errors.description = 'Deskripsi maksimal 2000 karakter.';
  }

  return errors;
}

function BookFormDialog({
  open,
  onOpenChange,
  book,
  categories,
  save,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  book: Book | null;
  categories: Category[];
  save: BookMutations['save'];
}) {
  const [form, setForm] = React.useState<BookForm>(EMPTY_FORM);
  const [errors, setErrors] = React.useState<BookFormErrors>({});
  const [coverFile, setCoverFile] = React.useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);

  // Object URL lifecycle: a new file revokes the previous one, and unmounting
  // revokes whatever is still held.
  React.useEffect(() => {
    if (!coverFile) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(coverFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [coverFile]);

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
    if (next) return;
    setForm(book ? formFromBook(book) : EMPTY_FORM);
    setErrors({});
    setCoverFile(null);
  };

  // Seed the form each time the dialog opens for a given book.
  React.useEffect(() => {
    if (!open) return;
    setForm(book ? formFromBook(book) : EMPTY_FORM);
    setErrors({});
    setCoverFile(null);
  }, [open, book]);

  const setField = <K extends keyof BookForm>(key: K, value: BookForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  };

  const handleSubmit = async () => {
    const found = validateForm(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const payload = new FormData();
    payload.append('isbn', form.isbn.trim());
    payload.append('title', form.title.trim());
    payload.append('author', form.author.trim());
    if (form.publisher.trim()) payload.append('publisher', form.publisher.trim());
    if (form.publishYear.trim()) payload.append('publishYear', form.publishYear.trim());
    if (form.categoryId) payload.append('categoryId', form.categoryId);
    if (form.shelfLocation.trim()) payload.append('shelfLocation', form.shelfLocation.trim());
    payload.append('totalCopies', String(Number(form.totalCopies)));
    if (form.description.trim()) payload.append('description', form.description.trim());
    if (coverFile) payload.append('cover', coverFile);

    try {
      await save.mutateAsync({ id: book?.id, form: payload });
      handleOpenChange(false);
    } catch (err) {
      // Keep the dialog open with the typed values; the toast carries the reason.
      if (err instanceof ApiError) {
        setErrors(fieldErrorsFrom(err));
      }
    }
  };

  const previewSrc = previewUrl ?? book?.coverPath ?? null;
  const pending = save.isPending;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        title={book ? 'Ubah Buku' : 'Tambah Buku'}
        description={
          book
            ? `Perbarui data "${book.title}". Sampul lama dipertahankan selama tidak ada berkas baru.`
            : 'Lengkapi data buku. Sampul bersifat opsional; tanpa sampul, katalog memakai sampul generik.'
        }
        size="lg"
        footer={
          <>
            <DialogClose asChild>
              <Button variant="outline" disabled={pending}>
                Batal
              </Button>
            </DialogClose>
            <Button
              onClick={() => {
                void handleSubmit();
              }}
              loading={pending}
            >
              {book ? 'Simpan perubahan' : 'Tambah buku'}
            </Button>
          </>
        }
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void handleSubmit();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="ISBN"
              htmlFor="book-form-isbn"
              required
              error={errors.isbn}
              hint="ISBN-10 atau ISBN-13, tanda hubung boleh."
            >
              <Input
                id="book-form-isbn"
                value={form.isbn}
                onChange={(e) => setField('isbn', e.target.value)}
                placeholder="978-602-03-0001-1"
                className="font-mono"
                aria-invalid={errors.isbn ? true : undefined}
                aria-describedby={
                  errors.isbn ? 'book-form-isbn-error' : 'book-form-isbn-hint'
                }
              />
            </Field>

            <Field
              label="Tahun Terbit"
              htmlFor="book-form-year"
              error={errors.publishYear}
              hint="Opsional. Angka antara 1000 dan tahun depan."
            >
              <Input
                id="book-form-year"
                type="number"
                inputMode="numeric"
                value={form.publishYear}
                onChange={(e) => setField('publishYear', e.target.value)}
                placeholder="2024"
                aria-invalid={errors.publishYear ? true : undefined}
                aria-describedby={
                  errors.publishYear ? 'book-form-year-error' : 'book-form-year-hint'
                }
              />
            </Field>
          </div>

          <Field
            label="Judul"
            htmlFor="book-form-title"
            required
            error={errors.title}
          >
            <Input
              id="book-form-title"
              value={form.title}
              onChange={(e) => setField('title', e.target.value)}
              placeholder="Contoh: Laskar Pelangi"
              aria-invalid={errors.title ? true : undefined}
              aria-describedby={errors.title ? 'book-form-title-error' : undefined}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Penulis" htmlFor="book-form-author" required error={errors.author}>
              <Input
                id="book-form-author"
                value={form.author}
                onChange={(e) => setField('author', e.target.value)}
                placeholder="Contoh: Andrea Hirata"
                aria-invalid={errors.author ? true : undefined}
                aria-describedby={errors.author ? 'book-form-author-error' : undefined}
              />
            </Field>

            <Field label="Penerbit" htmlFor="book-form-publisher" hint="Opsional.">
              <Input
                id="book-form-publisher"
                value={form.publisher}
                onChange={(e) => setField('publisher', e.target.value)}
                placeholder="Contoh: Kompas Books"
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Kategori" htmlFor="book-form-category" hint="Opsional.">
              <Select
                id="book-form-category"
                value={form.categoryId}
                onChange={(e) => setField('categoryId', e.target.value)}
              >
                <option value="">Tanpa kategori</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Lokasi Rak" htmlFor="book-form-shelf" hint="Contoh: F-01-01.">
              <Input
                id="book-form-shelf"
                value={form.shelfLocation}
                onChange={(e) => setField('shelfLocation', e.target.value)}
                placeholder="F-01-01"
                className="font-mono"
              />
            </Field>

            <Field
              label="Jumlah Eksemplar"
              htmlFor="book-form-copies"
              required
              error={errors.totalCopies}
            >
              <Input
                id="book-form-copies"
                type="number"
                inputMode="numeric"
                min={1}
                max={999}
                value={form.totalCopies}
                onChange={(e) => setField('totalCopies', e.target.value)}
                aria-invalid={errors.totalCopies ? true : undefined}
                aria-describedby={errors.totalCopies ? 'book-form-copies-error' : undefined}
              />
            </Field>
          </div>

          <Field
            label="Deskripsi"
            htmlFor="book-form-description"
            error={errors.description}
            hint="Opsional, maksimal 2000 karakter."
          >
            <Textarea
              id="book-form-description"
              rows={4}
              value={form.description}
              onChange={(e) => setField('description', e.target.value)}
              placeholder="Ringkasan singkat isi buku untuk membantu anggota mencari."
              aria-invalid={errors.description ? true : undefined}
              aria-describedby={
                errors.description ? 'book-form-description-error' : 'book-form-description-hint'
              }
            />
          </Field>

          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="shrink-0">
                <div className="h-36 w-[108px] overflow-hidden rounded-lg border border-border">
                  <BookCover
                    title={form.title.trim() || 'Judul buku'}
                    author={form.author.trim() || undefined}
                    src={previewSrc}
                    className="size-full"
                    rounded="rounded-none"
                  />
                </div>
                <p className="mt-1.5 text-center text-2xs text-muted-foreground">
                  {coverFile ? 'Pratinjau sampul baru' : book?.coverPath ? 'Sampul saat ini' : 'Sampul generik'}
                </p>
              </div>

              <div className="min-w-0 flex-1 space-y-2">
                <Field
                  label="Sampul (cover)"
                  htmlFor="book-form-cover"
                  hint="PNG, JPG, atau WEBP. Mengunggah sampul baru akan menggantikan sampul lama."
                >
                  <Input
                    id="book-form-cover"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)}
                    className="file:mr-3 file:rounded-md file:border-0 file:bg-card file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-foreground"
                  />
                </Field>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setCoverFile(null)}
                    disabled={!coverFile}
                  >
                    <ImagePlus className="size-3.5" aria-hidden />
                    Pakai sampul bawaan
                  </Button>
                  {coverFile ? (
                    <span className="truncate text-2xs text-muted-foreground">
                      {coverFile.name} · {formatNumber(coverFile.size)} byte
                    </span>
                  ) : null}
                </div>

                <p className="flex items-start gap-1.5 text-2xs leading-relaxed text-muted-foreground">
                  <TriangleAlert className="mt-0.5 size-3 shrink-0" aria-hidden />
                  Berkas dikirim sebagai multipart bersama data buku. Ukuran maksimum mengikuti
                  batas unggahan server.
                </p>
              </div>
            </div>
          </div>

          <button type="submit" className="sr-only">
            Simpan buku
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Maps the server's per-field messages onto the form. */
function fieldErrorsFrom(err: ApiError): BookFormErrors {
  const map: Record<string, keyof BookForm> = {
    isbn: 'isbn',
    title: 'title',
    author: 'author',
    publisher: 'publisher',
    publishYear: 'publishYear',
    categoryId: 'categoryId',
    shelfLocation: 'shelfLocation',
    totalCopies: 'totalCopies',
    description: 'description',
  };
  const out: BookFormErrors = {};
  for (const [key, message] of Object.entries(err.fields ?? {})) {
    const target = map[key];
    if (target) out[target] = message;
  }
  return out;
}

/* ------------------------------------------------------------------ */

function ImportBooksDialog({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  onImported: () => void;
}) {
  const [file, setFile] = React.useState<File | null>(null);
  const [summary, setSummary] = React.useState<ImportSummary | null>(null);
  const [result, setResult] = React.useState<ImportSummary | null>(null);
  const [busy, setBusy] = React.useState<'validate' | 'commit' | 'template' | null>(null);
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const reset = () => {
    setFile(null);
    setSummary(null);
    setResult(null);
    setBusy(null);
    setConfirmOpen(false);
  };

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
    if (!next) reset();
  };

  const send = async (target: File, mode: 'validate' | 'commit') => {
    const payload = new FormData();
    payload.append('file', target);
    return api.upload<ImportSummary>('/excel/import/books', payload, { mode });
  };

  const runValidate = async () => {
    if (!file) {
      toast.error('Pilih berkas .xlsx terlebih dahulu.');
      return;
    }
    setBusy('validate');
    setResult(null);
    try {
      const res = await send(file, 'validate');
      setSummary(res.data);
      toast.success(res.message ?? 'Validasi selesai. Tidak ada data yang disimpan.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Validasi gagal dijalankan.');
    } finally {
      setBusy(null);
    }
  };

  const runCommit = async () => {
    if (!file) return;
    setBusy('commit');
    try {
      const res = await send(file, 'commit');
      setSummary(res.data);
      setResult(res.data);
      setConfirmOpen(false);
      onImported();
      toast.success(res.message ?? 'Impor selesai.');
    } catch (err) {
      setConfirmOpen(false);
      toast.error(err instanceof ApiError ? err.message : 'Impor gagal dijalankan.');
    } finally {
      setBusy(null);
    }
  };

  const downloadTemplate = async () => {
    setBusy('template');
    try {
      await downloadFile('/excel/template', undefined, 'lumen-template-impor-buku.xlsx');
      toast.success('Template impor berhasil diunduh.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Gagal mengunduh template.');
    } finally {
      setBusy(null);
    }
  };

  const shown = result ?? summary;
  const skipped = shown ? shown.errorRows + shown.duplicateRows : 0;

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          title="Impor Buku dari Excel"
          description="Gunakan template resmi agar seluruh kolom terbaca. Validasi tidak menulis apa pun ke database."
          size="lg"
          footer={
            <>
              <DialogClose asChild>
                <Button variant="outline" disabled={busy !== null}>
                  Tutup
                </Button>
              </DialogClose>
              <Button
                variant="outline"
                onClick={() => {
                  void runValidate();
                }}
                loading={busy === 'validate'}
                disabled={!file || busy !== null}
              >
                <FileSpreadsheet className="size-4" aria-hidden />
                Validasi
              </Button>
              <Button
                onClick={() => setConfirmOpen(true)}
                disabled={!file || busy !== null}
              >
                <Upload className="size-4" aria-hidden />
                Impor
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <Field
              label="Berkas Excel"
              htmlFor="import-file"
              required
              hint="Format .xlsx atau .xls, maksimal 5 MB. Kolom mengikuti template resmi."
            >
              <Input
                id="import-file"
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  setSummary(null);
                  setResult(null);
                }}
                className="file:mr-3 file:rounded-md file:border-0 file:bg-card file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-foreground"
              />
            </Field>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                void downloadTemplate();
              }}
              loading={busy === 'template'}
            >
              <Download className="size-3.5" aria-hidden />
              Unduh template impor
            </Button>

            <p className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
              <RefreshCw className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              Impor berjalan per baris: baris yang valid disimpan, sedangkan baris bermasalah dan
              baris duplikat dilewati tanpa disimpan.
            </p>

            {shown ? (
              <section className="space-y-3" aria-label="Ringkasan hasil">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <SummaryStat label="Total baris" value={shown.totalRows} tone="neutral" />
                  <SummaryStat
                    label={result ? 'Tersimpan' : 'Baris valid'}
                    value={result ? (shown.inserted ?? shown.validRows) : shown.validRows}
                    tone="success"
                  />
                  <SummaryStat label="Baris bermasalah" value={shown.errorRows} tone="danger" />
                  <SummaryStat label="Duplikat" value={shown.duplicateRows} tone="warning" />
                </div>

                {result ? (
                  <p className="flex items-start gap-2 rounded-lg border border-success/25 bg-success-soft px-3 py-2.5 text-xs leading-relaxed text-success">
                    <BookOpen className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                    {formatNumber(result.inserted ?? 0)} buku tersimpan. {skipped > 0 ? (
                      <>
                        {formatNumber(skipped)} baris dilewati dan
                        <strong> tidak tersimpan</strong> karena bermasalah atau duplikat.
                      </>
                    ) : (
                      'Tidak ada baris yang dilewati.'
                    )}
                  </p>
                ) : (
                  <p className="flex items-start gap-2 rounded-lg border border-warning/25 bg-warning-soft px-3 py-2.5 text-xs leading-relaxed text-warning">
                    <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                    Ini hanya laporan validasi. Belum ada satu pun buku yang disimpan.
                  </p>
                )}

                {shown.errors.length > 0 ? (
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-foreground">
                      Detail baris bermasalah ({formatNumber(shown.errors.length)})
                    </p>
                    <ul className="scrollbar-thin max-h-56 space-y-1 overflow-y-auto rounded-lg border border-border bg-muted/30 p-3">
                      {shown.errors.map((e, i) => (
                        <li key={`${e.row}-${e.field}-${i}`} className="text-xs leading-relaxed">
                          <span className="font-semibold text-foreground">Baris {e.row}</span>
                          <span className="text-muted-foreground"> · {e.field}: {e.message}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </section>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <ConfirmContent
          title="Impor buku sekarang?"
          confirmLabel="Ya, impor"
          cancelLabel="Batal"
          onConfirm={async () => {
            await runCommit();
          }}
          description={
            <>
              Baris yang valid akan ditambahkan ke katalog. Baris bermasalah dan baris duplikat
              <strong> tidak akan disimpan</strong> dan hanya muncul di laporan.
            </>
          }
        >
          {summary ? (
            <p className="text-xs text-muted-foreground">
              Validasi terakhir: {formatNumber(summary.validRows)} baris valid,{' '}
              {formatNumber(summary.errorRows)} bermasalah, {formatNumber(summary.duplicateRows)}{' '}
              duplikat.
            </p>
          ) : null}
        </ConfirmContent>
      </ConfirmDialog>
    </>
  );
}

function SummaryStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'neutral' | 'success' | 'warning' | 'danger';
}) {
  const color =
    tone === 'success'
      ? 'text-success'
      : tone === 'warning'
        ? 'text-warning'
        : tone === 'danger'
          ? 'text-destructive'
          : 'text-foreground';
  return (
    <div className="panel px-3 py-2.5">
      <p className="text-2xs text-muted-foreground">{label}</p>
      <p className={`mt-0.5 font-display text-lg font-semibold tabular-nums ${color}`}>
        {formatNumber(value)}
      </p>
    </div>
  );
}
