import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BookMarked, Search, Users, X } from 'lucide-react';
import GlassFolder, {
  type ArtPreset,
  type FolderFile,
} from '@/components/ui/glass-folder-cards';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { Badge } from '@/components/ui/badge';
import { useAuthors, useDebounced } from '@/hooks/useApi';
import { cn, formatNumber } from '@/lib/utils';
import { staggerContainer, staggerItem } from '@/lib/motion';
import type { AuthorSummary } from '@/types';

/**
 * A fixed rotation of artwork presets. Deterministic, so a given author always
 * looks the same, and composed, so the row does not look randomly coloured.
 */
const ART_ROTATION: ArtPreset[] = ['aurora', 'verdant', 'dusk', 'glacier', 'ember'];
const TONE_ROTATION = ['light', 'dark'] as const;

/** How many authors to show before the "load more" control. */
const PAGE_SIZE = 8;

function authorToFiles(author: AuthorSummary): FolderFile[] {
  // A folder needs visible contents. If the author has no series, show their
  // books as sheets so the folder is never a decorative empty box.
  if (author.seriesCount > 0) {
    return Array.from({ length: Math.min(author.seriesCount, 4) }, (_, i) => ({
      id: `series-${i}`,
      name: `Seri ${i + 1}`,
      meta: 'Klik untuk membuka',
      art: undefined,
    }));
  }
  if (author.titleCount > 0) {
    return Array.from({ length: Math.min(author.titleCount, 4) }, (_, i) => ({
      id: `book-${i}`,
      name: `Judul ${i + 1}`,
      meta: `${author.copyCount} eksemplar`,
    }));
  }
  return [];
}

export function AuthorCollections() {
  const navigate = useNavigate();
  const [term, setTerm] = React.useState('');
  const debounced = useDebounced(term, 350);
  const [limit, setLimit] = React.useState(PAGE_SIZE);

  const { data, isLoading, isError, error, refetch } = useAuthors({
    search: debounced || undefined,
    sort: 'title_count',
    direction: 'DESC',
    pageSize: 100,
  });

  const authors = data?.items ?? [];
  const visible = authors.slice(0, limit);
  const hasMore = authors.length > limit;

  return (
    <section aria-labelledby="author-collections-heading" className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-1.5">
          <p className="eyebrow">Telusuri lewat penulis</p>
          <h2
            id="author-collections-heading"
            className="font-display text-2xl font-semibold tracking-tight text-foreground"
          >
            Jelajahi Para Penulis
          </h2>
          <p className="max-w-2xl text-sm text-muted-foreground text-pretty">
            Setiap folder adalah satu penulis. Buka foldernya untuk melihat seri yang
            terverifikasi dan karya yang berdiri sendiri.
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={term}
            onChange={(e) => {
              setTerm(e.target.value);
              setLimit(PAGE_SIZE);
            }}
            placeholder="Cari penulis..."
            aria-label="Cari penulis"
            className="pl-9"
          />
          {term ? (
            <button
              type="button"
              onClick={() => setTerm('')}
              aria-label="Bersihkan pencarian penulis"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="size-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      {/* Count + reset */}
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {isLoading ? (
            'Memuat penulis...'
          ) : (
            <>
              <span className="font-medium text-foreground">
                {formatNumber(data?.meta.total ?? 0)}
              </span>{' '}
              penulis ditemukan
            </>
          )}
        </p>
        {debounced ? (
          <Badge tone="info">
            &ldquo;{debounced}&rdquo;
            <button
              type="button"
              onClick={() => setTerm('')}
              aria-label="Hapus pencarian penulis"
              className="ml-0.5 rounded hover:bg-primary/20"
            >
              <X className="size-3" />
            </button>
          </Badge>
        ) : null}
      </div>

      {isError ? (
        <div className="panel">
          <ErrorState
            title="Gagal memuat daftar penulis"
            message={error?.message}
            onRetry={() => void refetch()}
          />
        </div>
      ) : isLoading ? (
        <div className="flex flex-wrap gap-8" aria-hidden>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-3" style={{ width: 300 }}>
              <Skeleton className="h-[228px] w-full rounded-xl" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          ))}
        </div>
      ) : authors.length === 0 ? (
        <div className="panel">
          {debounced ? (
            <EmptyState
              icon={Search}
              title="Tidak ada penulis yang cocok"
              description={`Tidak ditemukan penulis dengan nama "${debounced}".`}
              action={
                <button
                  type="button"
                  onClick={() => setTerm('')}
                  className="rounded-md px-3 py-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Atur ulang pencarian
                </button>
              }
            />
          ) : (
            <EmptyState
              icon={Users}
              title="Belum ada data penulis"
              description="Koleksi belum memuat buku. Tambahkan buku terlebih dahulu untuk melihat pengelompokan penulis."
            />
          )}
        </div>
      ) : (
        <>
          <motion.div
            variants={staggerContainer(0.06)}
            initial="hidden"
            animate="show"
            className="flex flex-wrap items-start gap-x-8 gap-y-10"
          >
            {visible.map((author, i) => (
              <motion.div key={author.id} variants={staggerItem} className="group relative">
                <GlassFolder
                  label={author.name}
                  // Titles and copies are different facts; the label shows both.
                  meta={`${formatNumber(author.titleCount)} judul · ${formatNumber(
                    author.copyCount,
                  )} eksemplar`}
                  tone={TONE_ROTATION[i % TONE_ROTATION.length]}
                  art={ART_ROTATION[i % ART_ROTATION.length]}
                  seed={author.id * 7 + 3}
                  files={authorToFiles(author)}
                  // No "+" button: adding a book is a librarian action and
                  // this folder has nothing to add.
                  action="none"
                  width={300}
                  appearDelay={Math.min(i, 6) * 70}
                  // Clicking the folder is a real navigation, not just an animation.
                  onOpenChange={(open) => {
                    if (open) navigate(`/katalog/penulis/${author.slug}`);
                  }}
                />
                {/* Screen-reader + no-hover path to the same place. */}
                <a
                  href={`/katalog/penulis/${author.slug}`}
                  className={cn(
                    'absolute inset-0 rounded-xl',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  )}
                >
                  <span className="sr-only">
                    Lihat koleksi {author.name} ({formatNumber(author.titleCount)} judul)
                  </span>
                </a>
              </motion.div>
            ))}
          </motion.div>

          {hasMore ? (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={() => setLimit((l) => l + PAGE_SIZE)}
                className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Tampilkan {Math.min(PAGE_SIZE, authors.length - limit)} penulis lainnya
              </button>
            </div>
          ) : null}
        </>
      )}

      <div className="flex items-center gap-3 pt-2" aria-hidden>
        <span className="eyebrow whitespace-nowrap">Atau telusuri langsung</span>
        <span className="rule flex-1" />
        <BookMarked className="size-4 text-muted-foreground" />
      </div>
    </section>
  );
}
