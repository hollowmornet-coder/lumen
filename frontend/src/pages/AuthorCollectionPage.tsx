import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, BookOpen, Layers, Library } from 'lucide-react';
import { PageBody, PageHeader } from '@/components/layout/PageHeader';
import { MiniCover } from '@/components/ui/book-cover';
import GlassFolder, { type ArtPreset, type FolderFile } from '@/components/ui/glass-folder-cards';
import { StockBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CardSkeleton, Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { useAuthor } from '@/hooks/useApi';
import { ApiError } from '@/lib/api';
import { formatNumber } from '@/lib/utils';
import { staggerContainer, staggerItem } from '@/lib/motion';
import type { LooseBook, SeriesSummary } from '@/types';

/**
 * Fixed rotation of artwork presets, keyed by position. Deterministic, so an
 * author page looks the same every time it is opened, and composed, so the row
 * never looks randomly coloured.
 */
const ART_ROTATION: ArtPreset[] = ['aurora', 'verdant', 'dusk', 'glacier', 'ember'];
const TONE_ROTATION = ['light', 'dark'] as const;

/**
 * A folder needs something between its pages. The summary endpoint gives counts
 * but no item list, so these sheets are an honest *preview* of the positions
 * we know exist - never a claim that a specific title sits there.
 */
function previewFiles(series: SeriesSummary): FolderFile[] {
  return Array.from({ length: series.totalItems }, (_, i) => ({
    id: i,
    name: 'Judul ' + (i + 1),
    meta: i < series.ownedItems ? 'Ada di koleksi' : 'Belum ada',
  }));
}

export default function AuthorCollectionPage() {
  const { slug } = useParams();
  const navigate = useNavigate();

  const { data, isLoading, isError, error, refetch } = useAuthor(slug ?? null);

  const author = data?.author;
  const series = data?.series ?? [];
  const looseBooks = data?.looseBooks ?? [];

  if (isLoading) {
    return (
      <PageBody className="space-y-6">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-8 w-72" />
        <div className="flex flex-wrap gap-8" aria-hidden>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} style={{ width: 300 }}>
              <Skeleton className="h-[228px] w-full rounded-xl" />
              <Skeleton className="mx-auto mt-3 h-3 w-2/3" />
            </div>
          ))}
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </PageBody>
    );
  }

  if (isError || !author) {
    // `error` arrives as a plain Error, so narrow before reading the status.
    const status = error instanceof ApiError ? error.status : null;
    const notFound = status === 404;
    return (
      <PageBody>
        <div className="panel">
          <ErrorState
            title={notFound ? 'Penulis tidak ditemukan' : 'Gagal memuat koleksi penulis'}
            message={
              notFound
                ? 'Tidak ada penulis dengan slug tersebut dalam katalog kami. Periksa kembali tautannya.'
                : error?.message
            }
            onRetry={() => void refetch()}
          />
        </div>
      </PageBody>
    );
  }

  const nothingAtAll = series.length === 0 && looseBooks.length === 0;

  return (
    <>
      <PageHeader
        breadcrumb={[
          { label: 'Katalog', to: '/katalog' },
          { label: author.name },
        ]}
        eyebrow="Koleksi penulis"
        title={author.name}
        // Only ever the real bio. No bio on record means no sentence here.
        description={author.bio ?? undefined}
        meta={
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
            <Figure label="judul" hint="judul berbeda" value={author.titleCount} />
            <Figure label="eksemplar" hint="total salinan fisik" value={author.copyCount} />
            <Figure label="eksemplar tersedia" hint="siap dipinjam" value={author.availableCopies} />
            <Figure label="seri" hint="tercatat di katalog" value={series.length} />
          </dl>
        }
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link to="/katalog">
              <ArrowLeft className="size-3.5" aria-hidden />
              Kembali ke katalog
            </Link>
          </Button>
        }
      />

      <PageBody className="space-y-10">
        {author.nationality ? (
          <p className="eyebrow">{author.nationality}</p>
        ) : null}

        {nothingAtAll ? (
          <div className="panel">
            <EmptyState
              icon={BookOpen}
              title="Belum ada buku dari penulis ini di koleksi perpustakaan"
              description={`Katalog kami belum memuat satu pun karya ${author.name}. Judul yang hanya tercatat sebagai bibliografi seri tidak dihitung sebagai buku yang bisa dipinjam.`}
              action={
                <Button asChild variant="outline" size="sm">
                  <Link to="/katalog">Telusuri katalog</Link>
                </Button>
              }
            />
          </div>
        ) : (
          <>
            {/* ---------- Seri ---------- */}
            <section aria-labelledby="author-series-heading" className="space-y-4">
              <div className="flex items-center gap-3">
                <Layers className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <h2 id="author-series-heading" className="font-display text-lg font-semibold tracking-tight">
                  Seri karya
                </h2>
                <span className="rule flex-1" aria-hidden />
                <span className="shrink-0 text-2xs text-muted-foreground">
                  {formatNumber(series.length)} seri
                </span>
              </div>

              {series.length === 0 ? (
                <div className="panel">
                  <EmptyState
                    icon={Layers}
                    title="Belum ada seri terverifikasi"
                    description={`Tidak ada seri karya ${author.name} yang tercatat di katalog perpustakaan. Buku yang berdiri sendiri bisa dilihat di bagian Karya Lepas.`}
                  />
                </div>
              ) : (
                <>
                  <p className="max-w-2xl text-sm text-muted-foreground text-pretty">
                    Satu folder untuk satu seri. Buka foldernya untuk melihat judul per posisi,
                    termasuk judul yang belum ada di rak kami.
                  </p>
                  <motion.ul
                    variants={staggerContainer(0.06)}
                    initial="hidden"
                    animate="show"
                    className="flex flex-wrap items-start justify-center gap-x-8 gap-y-10 sm:justify-start"
                  >
                    {series.map((s, i) => (
                      <SeriesFolder
                        key={s.id}
                        series={s}
                        index={i}
                        onOpen={(id) => navigate(`/katalog/seri/${id}`)}
                      />
                    ))}
                  </motion.ul>
                </>
              )}
            </section>

            {/* ---------- Karya lepas ---------- */}
            <section aria-labelledby="author-loose-heading" className="space-y-4">
              <div className="flex items-center gap-3">
                <Library className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <h2
                  id="author-loose-heading"
                  className="font-display text-lg font-semibold tracking-tight"
                >
                  Karya lepas
                </h2>
                <span className="rule flex-1" aria-hidden />
                <span className="shrink-0 text-2xs text-muted-foreground">
                  {formatNumber(looseBooks.length)} judul
                </span>
              </div>

              {looseBooks.length === 0 ? (
                <p className="panel px-5 py-4 text-sm text-muted-foreground">
                  Tidak ada karya yang berdiri sendiri di rak perpustakaan. Seri di atas tetap
                  dicatat sebagai bibliografi, hanya belum ada judulnya yang bisa dipinjam.
                </p>
              ) : (
                <>
                  <p className="max-w-2xl text-sm text-muted-foreground text-pretty">
                    Buku di luar seri yang benar-benar ada di rak kami dan bisa dipinjam.
                  </p>
                  <motion.ul
                    variants={staggerContainer(0.035)}
                    initial="hidden"
                    animate="show"
                    className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                  >
                    {looseBooks.map((book) => (
                      <LooseBookCard key={book.id} book={book} />
                    ))}
                  </motion.ul>
                </>
              )}
            </section>
          </>
        )}
      </PageBody>
    </>
  );
}

/* ------------------------------------------------------------------ */

function Figure({
  value,
  label,
  hint,
}: {
  value: number;
  label: string;
  hint: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5">
        <span className="font-display text-xl font-semibold tabular-nums text-foreground">
          {formatNumber(value)}
        </span>
        <span className="text-2xs text-muted-foreground">{hint}</span>
      </dd>
    </div>
  );
}

function SeriesFolder({
  series,
  index,
  onOpen,
}: {
  series: SeriesSummary;
  index: number;
  onOpen: (id: number) => void;
}) {
  return (
    <motion.li variants={staggerItem} className="flex flex-col items-center gap-3">
      <GlassFolder
        label={series.name}
        // Owned vs total, never one standing in for the other.
        meta={`${formatNumber(series.ownedItems)} dari ${formatNumber(
          series.totalItems,
        )} judul ada di koleksi`}
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
          if (open) onOpen(series.id);
        }}
      />
      {/* The visible, keyboard-reachable path to the same place. */}
      <Link
        to={`/katalog/seri/${series.id}`}
        className="inline-flex items-center gap-1.5 rounded-md text-xs font-medium text-primary underline-offset-4 transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Buka seri
        <ArrowRight className="size-3.5" aria-hidden />
        <span className="sr-only">{series.name}</span>
      </Link>
    </motion.li>
  );
}

function LooseBookCard({ book }: { book: LooseBook }) {
  return (
    <motion.li variants={staggerItem} className="h-full">
      <Link
        to={`/katalog/${book.id}`}
        className="flex h-full items-start gap-3 rounded-xl border border-border bg-card p-3 shadow-soft transition-[box-shadow,border-color] duration-200 hover:border-primary/30 hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <MiniCover title={book.title} author={book.author} src={book.coverPath} />
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 font-display text-sm font-semibold leading-snug text-foreground">
            {book.title}
          </h3>
          <p className="mt-0.5 text-2xs text-muted-foreground">
            {book.author}
            {book.publishYear ? ` · ${book.publishYear}` : ''}
          </p>
          <div className="mt-2">
            <StockBadge available={book.availableCopies} total={book.totalCopies} />
          </div>
        </div>
      </Link>
    </motion.li>
  );
}

