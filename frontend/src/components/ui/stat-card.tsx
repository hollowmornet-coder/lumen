import { motion } from 'framer-motion';
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CountUp } from '@/components/ui/book-cover';
import { springSoft, staggerContainer, staggerItem } from '@/lib/motion';

type Tone = 'electric' | 'violet' | 'cyan' | 'success' | 'warning' | 'danger';

const TONE_STYLES: Record<Tone, { icon: string; accent: string; value: string }> = {
  electric: { icon: 'bg-electric-soft text-primary', accent: 'bg-primary', value: 'text-primary' },
  violet: { icon: 'bg-violet-soft text-secondary', accent: 'bg-secondary', value: 'text-secondary' },
  cyan: { icon: 'bg-cyan-soft text-cyan', accent: 'bg-cyan', value: 'text-cyan' },
  success: { icon: 'bg-success-soft text-success', accent: 'bg-success', value: 'text-success' },
  warning: { icon: 'bg-warning-soft text-warning', accent: 'bg-warning', value: 'text-warning' },
  danger: { icon: 'bg-destructive-soft text-destructive', accent: 'bg-destructive', value: 'text-destructive' },
};

interface StatCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  tone?: Tone;
  hint?: string;
  trend?: { value: number; label: string };
  index?: number;
  loading?: boolean;
  onClick?: () => void;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = 'electric',
  hint,
  trend,
  index = 0,
  loading = false,
  onClick,
}: StatCardProps) {
  const styles = TONE_STYLES[tone];

  const Comp = onClick ? 'button' : 'div';

  return (
    <motion.div
      variants={staggerContainer(0.05)}
      initial="hidden"
      animate="show"
      custom={index}
    >
      <motion.div variants={staggerItem}>
        <Comp
          type={onClick ? 'button' : undefined}
          onClick={onClick}
          className={cn(
            'group relative w-full overflow-hidden rounded-xl p-4 text-left',
            'glass',
            'transition-[box-shadow,transform] duration-200 ease-out',
            onClick &&
              'hover:-translate-y-0.5 hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          )}
        >
          {/* Colour rail - the only decoration the card needs. */}
          <span
            className={cn('absolute inset-y-0 left-0 w-[3px] opacity-70', styles.accent)}
            aria-hidden
          />

          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
              {loading ? (
                <div className="mt-2 h-8 w-20 skeleton" aria-label="Memuat" />
              ) : (
                <p
                  className={cn(
                    'mt-1.5 font-display text-[26px] font-semibold leading-none tracking-tight',
                    value === 0 ? 'text-muted-foreground' : styles.value,
                  )}
                >
                  <CountUp value={value} />
                </p>
              )}
            </div>

            <span
              className={cn(
                'flex size-9 shrink-0 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-105',
                styles.icon,
              )}
              aria-hidden
            >
              <Icon className="size-[18px]" />
            </span>
          </div>

          {(hint || trend) && !loading ? (
            <div className="mt-3 flex items-center gap-2 text-2xs text-muted-foreground">
              {trend ? (
                <span
                  className={cn(
                    'inline-flex items-center gap-0.5 font-semibold',
                    trend.value >= 0 ? 'text-success' : 'text-destructive',
                  )}
                >
                  {trend.value >= 0 ? (
                    <ArrowUpRight className="size-3" aria-hidden />
                  ) : (
                    <ArrowDownRight className="size-3" aria-hidden />
                  )}
                  {Math.abs(trend.value)}%
                </span>
              ) : null}
              {hint ? <span className="truncate">{hint}</span> : null}
              {trend ? <span className="truncate">{trend.label}</span> : null}
            </div>
          ) : null}
        </Comp>
      </motion.div>
    </motion.div>
  );
}

/**
 * Editorial "hero" figure. Deliberately different from StatCard so the
 * dashboard does not read as a wall of identical tiles.
 */
export function HeadlineFigure({
  label,
  value,
  caption,
  tone = 'electric',
  loading = false,
}: {
  label: string;
  value: number;
  caption?: string;
  tone?: Tone;
  loading?: boolean;
}) {
  const styles = TONE_STYLES[tone];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springSoft}
      className="relative overflow-hidden rounded-xl border border-border bg-gradient-to-br from-navy-950 to-navy-800 p-6 text-white"
    >
      <div className="grain pointer-events-none absolute inset-0 opacity-30" aria-hidden />
      <div
        className={cn('pointer-events-none absolute -right-8 -top-8 size-40 rounded-full blur-3xl', styles.accent)}
        style={{ opacity: 0.28 }}
        aria-hidden
      />

      <div className="relative">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-navy-subtle">
          {label}
        </p>
        {loading ? (
          <div className="mt-3 h-12 w-32 rounded skeleton bg-white/10" aria-label="Memuat" />
        ) : (
          <p className="mt-2 font-display text-5xl font-semibold leading-none tracking-tight text-white">
            <CountUp value={value} />
          </p>
        )}
        {caption ? <p className="mt-2 text-xs text-navy-subtle">{caption}</p> : null}
      </div>
    </motion.div>
  );
}

export { TONE_STYLES };
