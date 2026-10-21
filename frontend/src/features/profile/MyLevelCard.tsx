import { motion, useReducedMotion } from 'framer-motion';
import { TrendingUp } from 'lucide-react';
import { LevelBadge, LevelProgress } from '@/components/ui/level-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useLevelTiers, useMyLevel } from '@/hooks/useApi';
import { cn, formatNumber } from '@/lib/utils';

/**
 * The member's own level card.
 *
 * Everything shown here is server-derived: the tier name, the threshold and
 * the progress percentage all come from `/levels/me`. The ladder below is
 * rendered from `/levels` so changing the curve in one place updates the UI.
 */
export function MyLevelCard({ className }: { className?: string }) {
  const level = useMyLevel();
  const tiers = useLevelTiers();
  const reduce = useReducedMotion();

  if (level.isLoading) {
    return (
      <section className={cn('panel space-y-3 p-5', className)} aria-label="Level anggota">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-2 w-full" />
      </section>
    );
  }

  if (level.isError || !level.data) {
    return (
      <section className={cn('panel p-5', className)} aria-label="Level anggota">
        <p className="text-sm text-muted-foreground">Level belum dapat dimuat.</p>
      </section>
    );
  }

  const data = level.data;
  const ladder = tiers.data ?? [];

  return (
    <section className={cn('panel p-5', className)} aria-label="Level anggota">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow">Tingkatan Anggota</p>
          <h2 className="mt-1 font-display text-lg font-semibold text-foreground">
            {data.name}
          </h2>
        </div>
        <div className="flex flex-col items-end gap-1">
          <LevelBadge level={data} />
          {data.rank != null ? (
            <span className="text-2xs text-muted-foreground">
              Peringkat #{formatNumber(data.rank)}
            </span>
          ) : null}
        </div>
      </header>

      <p className="mb-4 text-xs leading-relaxed text-muted-foreground">{data.blurb}</p>

      <LevelProgress level={data} />

      {ladder.length > 0 ? (
        <div className="mt-4">
          <p className="mb-2 flex items-center gap-1.5 text-2xs font-medium uppercase tracking-wider text-muted-foreground">
            <TrendingUp className="size-3" aria-hidden />
            Tangga level
          </p>
          <ol className="grid gap-1 sm:grid-cols-2">
            {ladder.map((tier) => {
              const reached = data.totalBorrowed >= tier.minLoans;
              const current = tier.level === data.level;

              return (
                <motion.li
                  key={tier.level}
                  initial={reduce ? false : { opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2, delay: reduce ? 0 : tier.level * 0.04 }}
                  className={cn(
                    'flex items-center justify-between gap-2 rounded-lg border px-2 py-1 text-2xs',
                    current
                      ? 'border-primary/30 bg-electric-soft'
                      : 'border-transparent bg-background/30',
                  )}
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span
                      className={cn(
                        'flex size-4 shrink-0 items-center justify-center rounded-full font-mono text-[10px] font-semibold',
                        reached ? 'bg-primary text-white' : 'bg-muted text-muted-foreground',
                      )}
                      aria-hidden
                    >
                      {tier.level}
                    </span>
                    <span
                      className={cn(
                        'truncate font-medium',
                        current ? 'text-foreground' : 'text-muted-foreground',
                      )}
                    >
                      {tier.name}
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {formatNumber(tier.minLoans)}+
                  </span>
                </motion.li>
              );
            })}
          </ol>
        </div>
      ) : null}
    </section>
  );
}
