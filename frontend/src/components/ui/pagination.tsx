import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import { cn, formatNumber } from '@/lib/utils';
import { springSnappy } from '@/lib/motion';
import { Button } from './button';

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  className?: string;
}

const PAGE_SIZES = [12, 24, 48];

export function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
  onPageSizeChange,
  className,
}: PaginationProps) {
  if (total === 0) return null;

  // Window of pages around the current one, with ellipses.
  const pages: Array<number | 'gap'> = [];
  const push = (n: number | 'gap') => pages.push(n);

  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i += 1) push(i);
  } else {
    push(1);
    if (page > 3) push('gap');
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i += 1) push(i);
    if (page < totalPages - 2) push('gap');
    push(totalPages);
  }

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-between gap-3 border-t border-border px-4 py-3 sm:flex-row',
        className,
      )}
    >
      <p className="text-xs text-muted-foreground">
        Menampilkan <span className="font-medium text-foreground">{formatNumber(from)}</span>-
        <span className="font-medium text-foreground">{formatNumber(to)}</span> dari{' '}
        <span className="font-medium text-foreground">{formatNumber(total)}</span> data
      </p>

      <div className="flex items-center gap-3">
        {onPageSizeChange ? (
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="hidden sm:inline">Baris</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="h-8 rounded-md border border-input bg-card px-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Jumlah baris per halaman"
            >
              {PAGE_SIZES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <nav className="flex items-center gap-1" aria-label="Navigasi halaman">
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            aria-label="Halaman sebelumnya"
          >
            <ChevronLeft />
          </Button>

          <AnimatePresence mode="popLayout" initial={false}>
            {pages.map((p, i) =>
              p === 'gap' ? (
                <span key={`gap-${i}`} className="px-1.5 text-xs text-muted-foreground" aria-hidden>
                  <MoreHorizontal className="size-3.5" />
                </span>
              ) : (
                <motion.button
                  key={p}
                  type="button"
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={springSnappy}
                  onClick={() => onPageChange(p)}
                  aria-current={p === page ? 'page' : undefined}
                  className={cn(
                    'h-8 min-w-8 rounded-md px-2 text-xs font-medium tabular-nums transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    p === page
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  {p}
                </motion.button>
              ),
            )}
          </AnimatePresence>

          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            aria-label="Halaman berikutnya"
          >
            <ChevronRight />
          </Button>
        </nav>
      </div>
    </div>
  );
}
