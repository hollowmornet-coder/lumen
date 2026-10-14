import * as React from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, BookMarked, Layers, ListOrdered, Sparkles } from 'lucide-react';
import { PageBody, PageHeader } from '@/components/layout/PageHeader';
import { WorksWheel, type WorksWheelItem } from '@/components/ui/works-wheel';
import { Badge, StockBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton, TableSkeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { useSeries } from '@/hooks/useApi';
import { ApiError } from '@/lib/api';
import { formatNumber } from '@/lib/utils';
import { staggerContainer, staggerItem } from '@/lib/motion';
import type { SeriesBookItem } from '@/types';

/**
 * A bibliography note often reads "Selena, 2020". The year is useful in the
 * table but not in a title, so it is stripped - never replaced by anything the
 * backend did not send.
 */
function noteTitle(note: string | null): string | null {
  if (!note) return null;
  const trimmed = note.trim();
  if (!trimmed) return null;
  const stripped = trimmed.replace(/,\s*(?:19|20)\d{2}\s*$/, '').trim();
  return stripped || trimmed;
}

/**
 * Maps one bibliography position onto one wheel card.
 *
 * Identity is the book id: a title can legitimately appear twice in a series,
 * so keying by title would collapse two entries into one. Positions we do not
 * own get no href at all, which renders a plain card - it is not in the
 * catalogue, so it must not look like something you can borrow.
 */
function toWheelItem(item: SeriesBookItem): WorksWheelItem {
  const book = item.book;
  const card: WorksWheelItem = {
    id: book ? book.id : `pos-${item.position}`,
    title: book?.title ?? noteTitle(item.note) ?? `Judul ${item.position}`,
    image: book?.coverPath ?? null,
    meta: book ? `${formatNumber(book.availableCopies)} tersedia` : 'Belum ada di koleksi',
  };
  return book ? { ...card, href: `/katalog/${book.id}` } : card;
}

export default function SeriesDetailPage() {
  const { id } = useParams();
  const rawId = Number(id);
  const seriesId = Number.isFinite(rawId) && rawId > 0 ? rawId : null;

  const { data, isLoading, isError, error, refetch } = useSeries(seriesId);

  const series = data?.series;
  const items = data?.items;

  const wheelItems = React.useMemo(() => (items ?? []).map(toWheelItem), [items]);

  if (!seriesId) {
    return (
      <PageBody>
        <div className="panel">
          <ErrorState
            title="Seri tidak ditemukan"
            message="Alamat seri tidak valid. Kembali ke katalog untuk memilih seri yang tersedia."
          />
        </div>
      </PageBody>
    );
  }

  if (isLoading) {
    return (
      <PageBody className="space-y-6">
        <Skeleton className="h-4 w-56" />
        <Skeleton className="h-8 w-80" />
        <Skeleton className="h-[520px] w-full rounded-xl" />
        <div className="panel p-4">
          <TableSkeleton rows={5} columns={4} />
        </div>
      </PageBody>
    );
  }

  if (isError || !series) {
    // `error` arrives as a plain Error, so narrow before reading the status.
    const status = error instanceof ApiError ? error.status : null;
    const notFound = status === 404;
    return (
      <PageBody>
        <div className="panel">
          <ErrorState
            title={notFound ? 'Seri tidak ditemukan' : 'Gagal memuat detail seri'}
            message={
              notFound
                ? 'Seri ini tidak ada dalam katalog kami. Periksa kembali tautannya.'
                : error?.message
            }
            onRetry={() => void refetch()}
          />
        </div>
      </PageBody>
    );
  }

  const rows = items ?? [];

  return (
    <>
      <PageHeader
        breadcrumb={[
          { label: 'Katalog', to: '/katalog' },
          { label: series.authorName, to: `/katalog/penulis/${series.authorSlug}` },
          { label: series.name },
        ]}
        eyebrow="Seri karya"
        title={series.name}
        // Only the original description. No description on record, no sentence.
        description={series.description ?? undefined}
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={series.verification === 'verified' ? 'success' : 'neutral'}>
              {series.verification === 'verified' ? 'Seri terverifikasi' : 'Belum terverifikasi'}
            </Badge>
            <Link
              to={`/katalog/penulis/${series.authorSlug}`}
              className="rounded text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              karya {series.authorName}
            </Link>
          </div>
        }
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link to={`/katalog/penulis/${series.authorSlug}`}>
              <ArrowLeft className="size-3.5" aria-hidden />
              Kembali ke {series.authorName}
            </Link>
          </Button>
        }
      />

      <PageBody className="space-y-8">
        {/* ---------- Stats: three different facts, three different labels ---------- */}
        <motion.dl
          variants={staggerContainer(0.05)}
          initial="hidden"
          animate="show"
          className="grid gap-3 sm:grid-cols-3"
        >
          <motion.div variants={staggerItem} className="panel p-4">
            <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ListOrdered className="size-3.5" aria-hidden />
              judul dalam seri
            </dt>
            <dd className="mt-1 font-display text-2xl font-semibold tabular-nums text-foreground">
              {formatNumber(series.totalItems)}
            </dd>
            <p className="text-2xs text-muted-foreground">bibliografi, ada atau tidak</p>
          </motion.div>

          <motion.div variants={staggerItem} className="panel p-4">
            <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <BookMarked className="size-3.5" aria-hidden />
              ada di koleksi
            </dt>
            <dd className="mt-1 font-display text-2xl font-semibold tabular-nums text-foreground">
              {formatNumber(series.ownedItems)}
            </dd>
            <p className="text-2xs text-muted-foreground">judul yang ada di rak kami</p>
          </motion.div>

          <motion.div variants={staggerItem} className="panel p-4">
            <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Sparkles className="size-3.5" aria-hidden />
              eksemplar tersedia
            </dt>
            <dd className="mt-1 font-display text-2xl font-semibold tabular-nums text-success">
              {formatNumber(series.availableCopies)}
            </dd>
            <p className="text-2xs text-muted-foreground">salinan yang siap dipinjam</p>
          </motion.div>
        </motion.dl>

        {rows.length === 0 ? (
          <div className="panel">
            <EmptyState
              icon={Layers}
              title="Seri ini belum memiliki judul yang tercatat."
              description="Daftar posisi dalam seri ini masih kosong, jadi belum ada yang bisa dipinjam dari sini."
              action={
                <Button asChild variant="outline" size="sm">
                  <Link to="/katalog">Telusuri katalog</Link>
                </Button>
              }
            />
          </div>
        ) : (
          <>
            {/* ---------- The wheel ---------- */}
            <section aria-labelledby="series-wheel-heading" className="space-y-3">
              <div className="flex items-center gap-3">
                <Layers className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <h2
                  id="series-wheel-heading"
                  className="font-display text-lg font-semibold tracking-tight"
                >
                  Putaran karya
                </h2>
                <span className="rule flex-1" aria-hidden />
              </div>
              <p className="max-w-2xl text-sm text-muted-foreground text-pretty">
                Geser, gulir, atau gunakan tombol panah untuk memutar roda. Kartu tanpa sampul
                tetap terbaca. Judul yang tidak ada di koleksi kami tidak bisa dibuka &mdash;
                daftar lengkapnya ada di tabel di bawah.
              </p>
              <div className="panel overflow-hidden">
                <div className="h-[520px] min-h-[24rem] w-full">
                  <WorksWheel items={wheelItems} label={series.name} action="Lihat" />
                </div>
              </div>
            </section>

            {/* ---------- Full list: every position, reachable by keyboard and screen reader ---------- */}
            <section aria-labelledby="series-list-heading" className="space-y-3">
              <div className="flex items-center gap-3">
                <ListOrdered className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <h2
                  id="series-list-heading"
                  className="font-display text-lg font-semibold tracking-tight"
                >
                  Daftar judul
                </h2>
                <span className="rule flex-1" aria-hidden />
                <span className="shrink-0 text-2xs text-muted-foreground">
                  {formatNumber(rows.length)} posisi
                </span>
              </div>

              <div className="panel overflow-x-auto">
                <table className="w-full min-w-[520px] border-collapse text-sm">
                  <caption className="sr-only">
                    Daftar judul dalam seri {series.name}, karya {series.authorName}
                  </caption>
                  <thead>
                    <tr className="border-b border-border text-left text-2xs uppercase tracking-wider text-muted-foreground">
                      <th scope="col" className="w-16 px-4 py-3 font-semibold">
                        #
                      </th>
                      <th scope="col" className="px-4 py-3 font-semibold">
                        Judul
                      </th>
                      <th scope="col" className="px-4 py-3 font-semibold">
                        Catatan
                      </th>
                      <th scope="col" className="px-4 py-3 text-right font-semibold">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {rows.map((item) => (
                      <SeriesRow key={item.book ? item.book.id : `pos-${item.position}`} item={item} />
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        <div className="pt-2">
          <Link
            to={`/katalog/penulis/${series.authorSlug}`}
            className="inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            Kembali ke {series.authorName}
          </Link>
        </div>
      </PageBody>
    </>
  );
}

/* ------------------------------------------------------------------ */

function SeriesRow({ item }: { item: SeriesBookItem }) {
  const book = item.book;
  const title = book?.title ?? noteTitle(item.note) ?? `Judul ${item.position}`;

  return (
    <tr className="transition-colors hover:bg-muted/40">
      <td className="px-4 py-3 align-top font-mono text-xs text-muted-foreground tabular-nums">
        {item.position}
      </td>
      <td className="px-4 py-3 align-top">
        {book ? (
          <Link
            to={`/katalog/${book.id}`}
            className="rounded font-display text-sm font-semibold text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {title}
          </Link>
        ) : (
          <span className="font-display text-sm font-semibold text-muted-foreground">{title}</span>
        )}
        {book?.categoryName ? (
          <p className="mt-0.5 text-2xs text-muted-foreground">{book.categoryName}</p>
        ) : null}
      </td>
      <td className="px-4 py-3 align-top text-xs text-muted-foreground">
        {item.note ?? (book ? (book.publishYear ? String(book.publishYear) : '-') : '-')}
      </td>
      <td className="px-4 py-3 text-right align-top">
        {book ? (
          <StockBadge available={book.availableCopies} total={book.totalCopies} />
        ) : (
          <Badge tone="neutral">Belum ada di koleksi</Badge>
        )}
      </td>
    </tr>
  );
}
