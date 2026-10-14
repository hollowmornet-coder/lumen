import * as React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { BookOpen, LayoutGrid, Library, List, Search, SlidersHorizontal, X } from 'lucide-react';
import { PageBody, PageHeader } from '@/components/layout/PageHeader';
import { BookCover } from '@/components/ui/book-cover';
import { Badge, StockBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { CardSkeleton } from '@/components/ui/skeleton';
import { EmptyState, NoResultsState } from '@/components/ui/states';
import { Pagination } from '@/components/ui/pagination';
import { useBooks, useCategories, useDebounced, useListParams, useMemberOverview } from '@/hooks/useApi';
import { useAuth } from '@/features/auth/AuthContext';
import { cn, formatNumber } from '@/lib/utils';
import { staggerContainer, staggerItem } from '@/lib/motion';
import type { Book } from '@/types';

const SORTS = [
  { value: 'title:ASC', label: 'Judul (A-Z)' },
  { value: 'title:DESC', label: 'Judul (Z-A)' },
  { value: 'author:ASC', label: 'Penulis (A-Z)' },
  { value: 'publish_year:DESC', label: 'Tahun terbaru' },
  { value: 'available_copies:DESC', label: 'Stok terbanyak' },
  { value: 'created_at:DESC', label: 'Terakhir ditambah' },
];

type ViewMode = 'grid' | 'list';

export default function CatalogPage() {
  const { isAdmin } = useAuth();
  const { get, set, setMany, reset } = useListParams();
  const [, setSearchParams] = useSearchParams();

  const [term, setTerm] = React.useState(get('q'));
  const debouncedTerm = useDebounced(term, 350);

  React.useEffect(() => {
    set('q', debouncedTerm || undefined);
  }, [debouncedTerm, set]);

  const categoryId = get('categoryId');
  const availability = get('availability', 'all');
  const sortRaw = get('sort', 'title:ASC');
  const [sort, direction] = sortRaw.split(':');
  const page = Number(get('page', '1'));
  const pageSize = Number(get('pageSize', '12'));
  const view = (get('view', 'grid') as ViewMode) ?? 'grid';

  const categories = useCategories();
  const overview = useMemberOverview();

  const query = {
    search: debouncedTerm || undefined,
    categoryId: categoryId || undefined,
    availability,
    sort,
    direction,
    page,
    pageSize,
  };

  const { data, isLoading, isFetching, isError, error, refetch } = useBooks(query, {
    enabled: !isAdmin || true,
  });

  const hasFilters = Boolean(debouncedTerm || categoryId || availability !== 'all');

  const clearFilters = () => {
    setTerm('');
    reset();
    setSearchParams(new URLSearchParams(), { replace: true });
  };

  const toggleSort = (value: string) => set('sort', value);

  return (
    <>
      <PageHeader
        eyebrow="Koleksi"
        title="Katalog Buku"
        description="Telusuri seluruh koleksi perpustakaan. Pencarian dan filter berjalan langsung terhadap database."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/katalog/seri">
                <Library className="size-3.5" aria-hidden />
                Katalog Seri
              </Link>
            </Button>
            <div className="flex items-center gap-1 rounded-lg border border-input bg-card p-0.5">
              {(['grid', 'list'] as ViewMode[]).map((v) => {
                const Icon = v === 'grid' ? LayoutGrid : List;
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => set('view', v)}
                    aria-pressed={view === v}
                    aria-label={v === 'grid' ? 'Tampilan kisi' : 'Tampilan daftar'}
                    className={cn(
                      'flex size-8 items-center justify-center rounded-md transition-colors',
                      view === v
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted',
                    )}
                  >
                    <Icon className="size-4" />
                  </button>
                );
              })}
            </div>
          </div>
        }
      />

      <PageBody className="space-y-5">
        {/* ---------- Filter bar ---------- */}
        <div className="panel p-4">
          <div className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto]">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                type="search"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Cari judul, penulis, atau ISBN..."
                aria-label="Cari buku"
                className="pl-9"
              />
              {term ? (
                <button
                  type="button"
                  onClick={() => setTerm('')}
                  aria-label="Bersihkan pencarian"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="size-3.5" />
                </button>
              ) : null}
            </div>

            <Select
              value={categoryId}
              onChange={(e) => setMany({ categoryId: e.target.value || undefined, page: undefined })}
              aria-label="Filter kategori"
              className="md:w-52"
            >
              <option value="">Semua kategori</option>
              {categories.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.bookCount})
                </option>
              ))}
            </Select>

            <Select
              value={availability}
              onChange={(e) => setMany({ availability: e.target.value, page: undefined })}
              aria-label="Filter ketersediaan"
              className="md:w-40"
            >
              <option value="all">Semua status</option>
              <option value="available">Tersedia</option>
              <option value="unavailable">Stok habis</option>
            </Select>

            <Select
              value={sortRaw}
              onChange={(e) => toggleSort(e.target.value)}
              aria-label="Urutkan"
              className="md:w-48"
            >
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </div>

          {/* Active filter chips */}
          <AnimatePresence>
            {hasFilters ? (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3 flex flex-wrap items-center gap-2 overflow-hidden"
              >
                <span className="flex items-center gap-1 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <SlidersHorizontal className="size-3" aria-hidden />
                  Filter aktif
                </span>
                {debouncedTerm ? (
                  <Badge tone="info">
                    Kata kunci: {debouncedTerm}
                    <button
                      type="button"
                      onClick={() => setTerm('')}
                      aria-label="Hapus filter kata kunci"
                      className="ml-0.5 rounded hover:bg-primary/20"
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                ) : null}
                {categoryId ? (
                  <Badge tone="violet">
                    Kategori: {categories.data?.find((c) => String(c.id) === categoryId)?.name ?? categoryId}
                    <button
                      type="button"
                      onClick={() => setMany({ categoryId: undefined, page: undefined })}
                      aria-label="Hapus filter kategori"
                      className="ml-0.5 rounded hover:bg-secondary/20"
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                ) : null}
                {availability !== 'all' ? (
                  <Badge tone="cyan">
                    {availability === 'available' ? 'Tersedia' : 'Stok habis'}
                    <button
                      type="button"
                      onClick={() => setMany({ availability: undefined, page: undefined })}
                      aria-label="Hapus filter ketersediaan"
                      className="ml-0.5 rounded hover:bg-cyan/20"
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                ) : null}
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-2xs font-medium text-muted-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                >
                  Atur ulang semua
                </button>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        {/* ---------- Result count ---------- */}
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {isLoading ? (
              'Memuat katalog...'
            ) : (
              <>
                Menampilkan{' '}
                <span className="font-medium text-foreground">
                  {formatNumber(data?.meta.total ?? 0)}
                </span>{' '}
                judul
                {debouncedTerm ? (
                  <>
                    {' '}untuk &ldquo;<span className="font-medium text-foreground">{debouncedTerm}</span>&rdquo;
                  </>
                ) : null}
              </>
            )}
          </p>
          {!isAdmin && overview.data ? (
            <p className="text-xs text-muted-foreground">
              Sisa kuota:{' '}
              <span className="font-semibold text-foreground">
                {overview.data.remainingQuota} dari {overview.data.maxLoanPerUser}
              </span>
            </p>
          ) : null}
        </div>

        {/* ---------- Results ---------- */}
        {isError ? (
          <div className="panel p-6">
            <p className="text-center text-sm text-destructive">
              {error?.message ?? 'Gagal memuat katalog.'}
            </p>
            <div className="mt-3 flex justify-center">
              <Button variant="outline" size="sm" onClick={() => void refetch()}>
                Coba lagi
              </Button>
            </div>
          </div>
        ) : isLoading ? (
          <div
            className={
              view === 'grid'
                ? 'grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                : 'space-y-3'
            }
          >
            {Array.from({ length: view === 'grid' ? 8 : 5 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : !data || data.items.length === 0 ? (
          <div className="panel">
            {hasFilters ? (
              <NoResultsState onReset={clearFilters} />
            ) : (
              <EmptyState
                icon={BookOpen}
                title="Katalog masih kosong"
                description={
                  isAdmin
                    ? 'Tambahkan buku pertama melalui menu Kelola Buku untuk mulai mengisi koleksi.'
                    : 'Belum ada buku yang tersedia di perpustakaan saat ini.'
                }
                action={
                  isAdmin ? (
                    <Button asChild size="sm">
                      <Link to="/admin/buku">Tambah buku</Link>
                    </Button>
                  ) : undefined
                }
              />
            )}
          </div>
        ) : view === 'grid' ? (
          <motion.div
            key="grid"
            variants={staggerContainer(0.035)}
            initial="hidden"
            animate="show"
            className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          >
            {data.items.map((book) => (
              <motion.div key={book.id} variants={staggerItem}>
                <BookGridCard book={book} isAdmin={isAdmin} />
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <motion.ul
            key="list"
            variants={staggerContainer(0.03)}
            initial="hidden"
            animate="show"
            className="panel divide-y divide-border overflow-hidden"
          >
            {data.items.map((book) => (
              <motion.li key={book.id} variants={staggerItem}>
                <BookListRow book={book} />
              </motion.li>
            ))}
          </motion.ul>
        )}

        {data && data.items.length > 0 ? (
          <div className="panel overflow-hidden">
            <Pagination
              page={data.meta.page}
              totalPages={data.meta.totalPages}
              total={data.meta.total}
              pageSize={data.meta.pageSize}
              onPageChange={(p) => {
                set('page', p);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onPageSizeChange={(s) => setMany({ pageSize: s, page: undefined })}
            />
          </div>
        ) : null}

        {isFetching && !isLoading ? (
          <div
            className="pointer-events-none fixed inset-x-0 top-16 z-40 h-0.5 overflow-hidden"
            aria-hidden
          >
            <div className="h-full w-1/3 animate-shimmer bg-primary" />
          </div>
        ) : null}
      </PageBody>
    </>
  );
}

/* ------------------------------------------------------------------ */

function BookGridCard({ book, isAdmin }: { book: Book; isAdmin: boolean }) {
  return (
    <article
      className="group h-full transition-transform duration-150 hover:-translate-y-0.5 motion-reduce:transition-none"
    >
      <Link
        to={`/katalog/${book.id}`}
        className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-soft transition-[box-shadow,border-color] duration-200 hover:border-primary/30 hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="relative">
          <BookCover
            title={book.title}
            author={book.author}
            src={book.coverPath}
            className="aspect-[3/4] w-full"
            rounded="rounded-none"
          />
          <div className="absolute left-3 top-3">
            <StockBadge available={book.availableCopies} total={book.totalCopies} />
          </div>
          {book.status === 'inactive' ? (
            <div className="absolute right-3 top-3">
              <Badge tone="neutral">Nonaktif</Badge>
            </div>
          ) : null}
        </div>

        <div className="flex flex-1 flex-col gap-1.5 p-4">
          {book.categoryName ? (
            <p className="eyebrow truncate text-primary/80">{book.categoryName}</p>
          ) : null}
          <h3 className="line-clamp-2 font-display text-[15px] font-semibold leading-snug text-foreground">
            {book.title}
          </h3>
          <p className="line-clamp-1 text-xs text-muted-foreground">{book.author}</p>

          <div className="mt-auto flex items-center justify-between gap-2 pt-3 text-2xs text-muted-foreground">
            <span className="truncate font-mono">{book.isbn}</span>
            {book.shelfLocation ? <span className="shrink-0">{book.shelfLocation}</span> : null}
          </div>

          {isAdmin && book.borrowedCopies > 0 ? (
            <p className="text-2xs font-medium text-violet">
              {book.borrowedCopies} sedang dipinjam
            </p>
          ) : null}
        </div>
      </Link>
    </article>
  );
}

function BookListRow({ book }: { book: Book }) {
  return (
    <Link
      to={`/katalog/${book.id}`}
      className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
    >
      <BookCover
        title={book.title}
        author={book.author}
        src={book.coverPath}
        className="h-20 w-14 shrink-0"
      />
      <div className="min-w-0 flex-1">
        <h3 className="truncate font-display text-sm font-semibold">{book.title}</h3>
        <p className="truncate text-xs text-muted-foreground">
          {book.author}
          {book.publishYear ? ` · ${book.publishYear}` : ''}
        </p>
        <p className="mt-0.5 truncate font-mono text-2xs text-muted-foreground">{book.isbn}</p>
      </div>
      <div className="hidden shrink-0 text-right text-xs sm:block">
        {book.categoryName ? <p className="font-medium">{book.categoryName}</p> : null}
        {book.shelfLocation ? <p className="text-muted-foreground">{book.shelfLocation}</p> : null}
      </div>
      <div className="shrink-0 text-right text-xs">
        <p className="font-semibold tabular-nums">{book.availableCopies}</p>
        <p className="text-2xs text-muted-foreground">tersedia</p>
      </div>
      <StockBadge available={book.availableCopies} total={book.totalCopies} />
    </Link>
  );
}
