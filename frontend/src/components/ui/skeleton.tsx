import * as React from 'react';
import { cn } from '@/lib/utils';

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('skeleton', className)} aria-hidden {...props} />;
}

/** Skeleton shaped like a real table row, so layout does not jump. */
export function TableSkeleton({ rows = 6, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="space-y-2" role="status" aria-label="Memuat data">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 px-4 py-3">
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton
              key={c}
              className={cn('h-4', c === 0 ? 'w-1/3' : 'flex-1')}
            />
          ))}
        </div>
      ))}
      <span className="sr-only">Memuat data...</span>
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="space-y-3" role="status" aria-label="Memuat data">
      <Skeleton className="h-40 w-full rounded-lg" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  );
}

export function StatSkeleton() {
  return (
    <div className="space-y-2" role="status" aria-label="Memuat statistik">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-8 w-16" />
    </div>
  );
}

export function ChartSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-end gap-2 p-4', className)} role="status" aria-label="Memuat grafik">
      {[40, 65, 30, 80, 55, 70, 45].map((h, i) => (
        <Skeleton key={i} className="flex-1 rounded-t" style={{ height: `${h}%` }} />
      ))}
    </div>
  );
}
