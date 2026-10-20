import * as React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Heart, HeartOff, Library } from 'lucide-react';
import { PageBody, PageHeader } from '@/components/layout/PageHeader';
import { BookCover } from '@/components/ui/book-cover';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import { CardSkeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { api } from '@/lib/api';
import { useApiMutation, useListParams, useWishlist } from '@/hooks/useApi';
import { formatDate, formatNumber } from '@/lib/utils';

/**
 * A member's saved titles.
 *
 * Deliberately distinct from the reservation list: nothing here holds a copy.
 * The copy is a bookmark, and the page says so, because members who expect a
 * hold are disappointed when the book is gone.
 */
export default function MyWishlistPage() {
  const { get, set } = useListParams();
  const page = Number(get('page', '1')) || 1;
  const pageSize = Number(get('pageSize', '12')) || 12;

  const query = React.useMemo(() => ({ page, pageSize }), [page, pageSize]);
  const wishlist = useWishlist(query);

  const items = wishlist.data?.items ?? [];
  const meta = wishlist.data?.meta;

  const remove = useApiMutation<number, unknown>({
    mutationFn: async (bookId) => (await api.delete(`/wishlist/${bookId}`)).data,
    successMessage: 'Dihapus dari daftar keinginan.',
    invalidate: [['wishlist']],
  });

  return (
    <>
      <PageHeader
        eyebrow="Koleksi Pribadi"
        title="Daftar Keinginan"
        description="Judul yang ingin Anda baca nanti. Daftar ini tidak memesan buku — gunakan tombol antrean pada halaman buku bila ingin benar-benar mengamankan satu eksemplar."
        breadcrumb={[
          { label: 'Beranda', to: '/perpustakaan' },
          { label: 'Daftar Keinginan' },
        ]}
        meta={
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {wishlist.isLoading
              ? 'Memuat daftar...'
              : `${formatNumber(meta?.total ?? 0)} judul disimpan`}
          </p>
        }
      />

      <PageBody>
        {wishlist.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : wishlist.isError ? (
          <div className="panel">
            <ErrorState
              message={wishlist.error instanceof Error ? wishlist.error.message : undefined}
              onRetry={() => void wishlist.refetch()}
            />
          </div>
        ) : items.length === 0 ? (
          <div className="panel">
            <EmptyState
              icon={HeartOff}
              title="Daftar keinginan masih kosong"
              description="Tekan ikon hati pada halaman buku untuk menyimpannya di sini."
              action={
                <Button asChild size="sm">
                  <Link to="/perpustakaan/katalog">Jelajahi katalog</Link>
                </Button>
              }
            />
          </div>
        ) : (
          <>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {items.map((item) => (
                <li key={item.id} className="panel group flex flex-col overflow-hidden">
                  <Link
                    to={`/katalog/${item.bookId}`}
                    className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  >
                    <BookCover
                      title={item.title}
                      author={item.author}
                      src={item.coverPath}
                      className="aspect-[3/4] w-full"
                      rounded="rounded-none"
                    />
                  </Link>

                  <div className="flex flex-1 flex-col gap-2 p-3">
                    <div className="min-w-0">
                      <Link
                        to={`/katalog/${item.bookId}`}
                        className="line-clamp-2 font-display text-sm font-semibold hover:text-primary"
                      >
                        {item.title}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">{item.author}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {item.categoryName ? (
                        <Badge tone="violet" className="text-2xs">
                          {item.categoryName}
                        </Badge>
                      ) : null}
                      <Badge tone={item.availableCopies > 0 ? 'success' : 'neutral'} className="text-2xs">
                        {item.availableCopies > 0
                          ? `${formatNumber(item.availableCopies)} tersedia`
                          : 'Sedang habis'}
                      </Badge>
                    </div>

                    <p className="text-2xs text-muted-foreground">
                      Disimpan {formatDate(item.createdAt)}
                    </p>

                    <div className="mt-auto flex items-center gap-1.5 pt-1">
                      <Button asChild size="sm" variant="outline" className="flex-1">
                        <Link to={`/katalog/${item.bookId}`}>
                          Lihat buku
                          <ArrowRight className="size-3" aria-hidden />
                        </Link>
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Hapus ${item.title} dari daftar keinginan`}
                        onClick={() => remove.mutate(item.bookId)}
                        disabled={remove.isPending}
                      >
                        <Heart className="size-3.5 fill-current text-destructive" aria-hidden />
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            {meta && meta.totalPages > 1 ? (
              <div className="mt-4">
                <Pagination
                  page={meta.page}
                  totalPages={meta.totalPages}
                  total={meta.total}
                  pageSize={meta.pageSize}
                  onPageChange={(p) => set('page', p)}
                />
              </div>
            ) : null}
          </>
        )}

        <div className="panel mt-4 flex items-start gap-3 p-4">
          <Library className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          <p className="text-xs leading-relaxed text-muted-foreground">
            Petugas memakai daftar keinginan seluruh anggota sebagai pertimbangan pembelian judul
            baru. Menyimpan buku di sini benar-benar berpengaruh pada koleksi berikutnya.
          </p>
        </div>
      </PageBody>
    </>
  );
}
