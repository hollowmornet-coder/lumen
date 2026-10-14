import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueries } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  BookMarked,
  Layers,
  ListOrdered,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import { PageBody, PageHeader } from '@/components/layout/PageHeader';
import GlassFolder, { type ArtPreset, type FolderFile } from '@/components/ui/glass-folder-cards';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { queryKeys, useAuthors, useDebounced, useListParams } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { cn, formatNumber } from '@/lib/utils';
import { staggerContainer, staggerItem } from '@/lib/motion';
import type { AuthorDetail, AuthorSummary, SeriesSummary } from '@/types';

/**
 * Stable defaults, so the callbacks `useListParams` hands back keep a stable
 * identity and the search effect below runs once per keystroke burst, not once
 * per render.
 */
const LIST_DEFAULTS: Record<string, string> = {};

/**
 * Fixed rotation of artwork presets, keyed by position. Deterministic, so a
 * series always looks the same, and composed, so a row is never randomly
 * coloured.
 */
const ART_ROTATION: ArtPreset[] = ['aurora', 'verdant', 'dusk', 'glacier', 'ember'];
const TONE_ROTATION = ['light', 'dark'] as const;

/**
 * A folder needs something between its pages. The summary endpoint gives counts
 * but no item list, so these sheets are an honest *preview* of the positions we
 * know exist - never a claim that a specific title sits there. The folder's real
 * action is navigation to the series page.
 */
function previewFiles(series: SeriesSummary): FolderFile[] {
  return Array.from({ length: Math.min(series.totalItems, 4) }, (_, i) => ({
    id: i,
    name: 'Judul ' + (i + 1),
    meta: i < series.ownedItems ? 'Ada di koleksi' : 'Belum ada',
  }));
}

export default function SeriesCatalogPage() {
  const { get, set, reset } = useListParams(LIST_DEFAULTS);

  const [term, setTerm] = React.useState(get('q'));
  const debouncedTerm = useDebounced(term, 350);

  React.useEffect(() => {
    set('q', debouncedTerm || undefined);
  }, [debouncedTerm, set]);

  const authorsQuery = useAuthors({ pageSize: 100 });
  const authors = React.useMemo(
    () => (authorsQuery.data?.items ?? []).filter((author) => author.seriesCount > 0),
    [authorsQuery.data],
  );

  /**
   * The series of every author, fetched in one go. A hook cannot be called in a
   * loop, so `useQueries` does the work here; the query key is the same one
   * `useAuthor` uses, so opening an author page later reads this cache instead
   * of asking the server again.
   */
  const seriesQueries = useQueries({
    queries: authors.map((author) => ({
      queryKey: queryKeys.author(author.slug),
      queryFn: async () =>
        (await api.get<AuthorDetail>(`/collections/authors/${encodeURIComponent(author.slug)}`))
          .data,
      staleTime: 5 * 60_000,
    })),
  });

  const needle = debouncedTerm.trim().toLowerCase();

  // A matching author keeps every one of their series; otherwise only series
  // whose own name matches survive, so a heading never stands over nothing.
  const groups = authors
    .map((author, i) => {
      const authorMatches = !needle || author.name.toLowerCase().includes(needle);
      const series = (seriesQueries[i]?.data?.series ?? []).filter(
        (s) => authorMatches || s.name.toLowerCase().includes(needle),
      );
      return { author, series };
    })
    .filter((group) => group.series.length > 0);

  // Three different facts, so three different labels. None of them is "eksemplar".
  const totals = groups.reduce(
    (acc, group) => {
      for (const s of group.series) {
        acc.series += 1;
        acc.items += s.totalItems;
        acc.owned += s.ownedItems;
      }
      return acc;
    },
    { series: 0, items: 0, owned: 0 },
  );

  const isLoading = authorsQuery.isLoading || seriesQueries.some((q) => q.isLoading);
  const failedQuery = seriesQueries.find((q) => q.isError);
  const isError = authorsQuery.isError || Boolean(failedQuery);
  const errorMessage = authorsQuery.error?.message ?? failedQuery?.error?.message;

  const clearSearch = () => {
    setTerm('');
    reset();
  };

  const retry = () => {
    void authorsQuery.refetch();
    for (const q of seriesQueries) void q.refetch();
  };

  return (
    <>
      <PageHeader
        breadcrumb={[
          { label: 'Katalog Buku', to: '/katalog' },
          { label: 'Katalog Seri' },
        ]}
        eyebrow="Koleksi seri"
        title="Katalog Seri"
        description="Seluruh seri buku yang tercatat di katalog perpustakaan, dikelompokkan menurut penulis. Satu folder untuk satu seri, dan judul yang hanya ada sebagai bibliografi tetap ikut terbawa."
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link to="/katalog">
              <ArrowLeft className="size-3.5" aria-hidden />
              Katalog Buku
            </Link>
          </Button>
        }
      />

      <PageBody className="space-y-6">
        {/* ---------- Search ---------- */}
        <div className="panel p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:w-80">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                type="search"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Cari nama seri atau penulis..."
                aria-label="Cari seri atau penulis"
                className="pl-9"
              />
              {term ? (
                <button
                  type="button"
                  onClick={() => setTerm('')}
                  aria-label="Bersihkan pencarian"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="size-3.5" />
                </button>
              ) : null}
            </div>

            <p className="text-sm text-muted-foreground" aria-live="polite">
              {isLoading ? (
                'Memuat katalog seri...'
              ) : (
                <>
                  Menampilkan{' '}
                  <span className="font-medium text-foreground">{formatNumber(totals.series)}</span>{' '}
                  seri dari{' '}
                  <span className="font-medium text-foreground">{formatNumber(groups.length)}</span>{' '}
                  penulis
                  {needle ? (
                    <>
                      {' '}untuk &ldquo;
                      <span className="font-medium text-foreground">
                        {debouncedTerm.trim()}
                      </span>
                      &rdquo;
                    </>
                  ) : null}
                </>
              )}
            </p>
          </div>
        </div>

        {/* ---------- Totals ---------- */}
        {!isLoading && !isError && authors.length > 0 ? (
          <motion.dl
            variants={staggerContainer(0.05)}
            initial="hidden"
            animate="show"
            className="grid gap-3 sm:grid-cols-3"
          >
            <motion.div variants={staggerItem} className="panel p-4">
              <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Layers className="size-3.5" aria-hidden />
                seri
              </dt>
              <dd className="mt-1 font-display text-2xl font-semibold tabular-nums text-foreground">
                {formatNumber(totals.series)}
              </dd>
              <p className="text-2xs text-muted-foreground">folder yang tampil di halaman ini</p>
            </motion.div>

            <motion.div variants={staggerItem} className="panel p-4">
              <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ListOrdered className="size-3.5" aria-hidden />
                judul dalam seri
              </dt>
              <dd className="mt-1 font-display text-2xl font-semibold tabular-nums text-foreground">
                {formatNumber(totals.items)}
              </dd>
              <p className="text-2xs text-muted-foreground">posisi bibliografi, ada atau tidak</p>
            </motion.div>

            <motion.div variants={staggerItem} className="panel p-4">
              <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <BookMarked className="size-3.5" aria-hidden />
                ada di koleksi
              </dt>
              <dd className="mt-1 font-display text-2xl font-semibold tabular-nums text-foreground">
                {formatNumber(totals.owned)}
              </dd>
              <p className="text-2xs text-muted-foreground">judul yang benar-benar ada di rak kami</p>
            </motion.div>
          </motion.dl>
        ) : null}

        {/* ---------- Folders ---------- */}
        {isLoading ? (
          <FolderSkeletonRow count={4} />
        ) : isError ? (
          <div className="panel">
            <ErrorState
              title="Gagal memuat katalog seri"
              message={errorMessage}
              onRetry={retry}
            />
          </div>
        ) : authors.length === 0 ? (
          <div className="panel">
            <EmptyState
              icon={Layers}
              title="Belum ada seri yang tercatat"
              description="Tidak ada seri buku yang tercatat di katalog perpustakaan. Seri muncul setelah judul-judul dalam satu rangkaian dikelompokkan bersama."
              action={
                <Button asChild variant="outline" size="sm">
                  <Link to="/katalog">Telusuri Katalog Buku</Link>
                </Button>
              }
            />
          </div>
        ) : groups.length === 0 ? (
          <div className="panel">
            <EmptyState
              icon={Search}
              title="Tidak ada seri yang cocok"
              description={`Tidak ditemukan seri maupun penulis dengan kata kunci "${debouncedTerm.trim()}".`}
              action={
                <Button variant="outline" size="sm" onClick={clearSearch}>
                  <RefreshCw className="size-3.5" aria-hidden />
                  Atur ulang pencarian
                </Button>
              }
            />
          </div>
        ) : (
          <div className="space-y-10">
            {groups.map((group) => (
              <SeriesFolderGroup
                key={group.author.id}
                author={group.author}
                series={group.series}
              />
            ))}
          </div>
        )}
      </PageBody>
    </>
  );
}

/* ------------------------------------------------------------------ */

function FolderSkeletonRow({ count }: { count: number }) {
  return (
    <div className="flex flex-wrap items-start gap-x-8 gap-y-10" role="status">
      <span className="sr-only">Memuat seri...</span>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-3" style={{ width: 300 }}>
          <Skeleton className="h-[228px] w-full rounded-xl" />
          <Skeleton className="mx-auto h-3 w-2/3" />
        </div>
      ))}
    </div>
  );
}

function SeriesFolderGroup({
  author,
  series,
}: {
  author: AuthorSummary;
  series: SeriesSummary[];
}) {
  const headingId = `seri-${author.slug}`;

  return (
    <section aria-labelledby={headingId} className="space-y-4">
      <div className="flex items-center gap-3">
        <Layers className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <h2 id={headingId} className="font-display text-lg font-semibold tracking-tight">
          {author.name}
        </h2>
        <span className="rule flex-1" aria-hidden />
        <Link
          to={`/katalog/penulis/${author.slug}`}
          className="shrink-0 rounded text-2xs text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {formatNumber(series.length)} seri &middot; lihat karya penulis
        </Link>
      </div>

      <motion.ul
        variants={staggerContainer(0.06)}
        initial="hidden"
        animate="show"
        className="flex flex-wrap items-start gap-x-8 gap-y-10"
      >
        {series.map((s, i) => (
          <SeriesFolder key={s.id} series={s} index={i} />
        ))}
      </motion.ul>
    </section>
  );
}

function SeriesFolder({ series, index }: { series: SeriesSummary; index: number }) {
  const navigate = useNavigate();

  return (
    <motion.li variants={staggerItem} className="relative">
      <GlassFolder
        label={series.name}
        // Owned vs total, never one standing in for the other.
        meta={`${formatNumber(series.ownedItems)} dari ${formatNumber(
          series.totalItems,
        )} judul di koleksi`}
        tone={TONE_ROTATION[index % TONE_ROTATION.length]}
        art={ART_ROTATION[index % ART_ROTATION.length]}
        seed={series.id * 7 + 3}
        files={previewFiles(series)}
        // No "+" key: nothing can be added to a bibliography from here.
        action="none"
        width={300}
        appearDelay={Math.min(index, 6) * 70}
        // Opening the folder is a real navigation, not only an animation.
        onOpenChange={(open) => {
          if (open) navigate(`/katalog/seri/${series.id}`);
        }}
      />
      {/*
        The keyboard and screen-reader path to the same place. It sits over the
        folder but is inert for the pointer, so the folder keeps its hover and
        its own open behaviour; focusing the link is what makes it clickable.
      */}
      <Link
        to={`/katalog/seri/${series.id}`}
        className={cn(
          'pointer-events-none absolute inset-0 rounded-xl',
          'focus-visible:pointer-events-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        )}
      >
        <span className="sr-only">
          Buka seri {series.name} ({formatNumber(series.totalItems)} judul dalam seri)
        </span>
      </Link>
    </motion.li>
  );
}