import * as React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { BookOpenCheck, Crown, Flame, Sparkles, Trophy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn, formatNumber } from '@/lib/utils';
import type { LevelTone, MemberLevel } from '@/types';

const TONE_TO_BADGE: Record<LevelTone, 'neutral' | 'info' | 'cyan' | 'violet' | 'success' | 'warning'> = {
  neutral: 'neutral',
  info: 'info',
  cyan: 'cyan',
  violet: 'violet',
  success: 'success',
  warning: 'warning',
};

const TONE_TO_ICON: Record<LevelTone, React.ComponentType<{ className?: string }>> = {
  neutral: Sparkles,
  info: BookOpenCheck,
  cyan: Flame,
  violet: Trophy,
  success: Sparkles,
  warning: Crown,
};

/** Compact "Level 3 · Kutu Buku" chip for tables and headers. */
export function LevelBadge({
  level,
  className,
  showNumber = true,
}: {
  level: Pick<MemberLevel, 'level' | 'name' | 'tone'>;
  className?: string;
  showNumber?: boolean;
}) {
  const Icon = TONE_TO_ICON[level.tone] ?? Sparkles;

  return (
    <Badge tone={TONE_TO_BADGE[level.tone]} className={cn('gap-1', className)}>
      <Icon aria-hidden />
      <span>
        {showNumber ? `Lv.${level.level} · ` : null}
        {level.name}
      </span>
    </Badge>
  );
}

/**
 * Progress bar toward the next level.
 *
 * The percentage comes from the server, so the bar can never disagree with
 * the badge. Animation only changes how it is revealed.
 */
export function LevelProgress({
  level,
  className,
  showLabels = true,
}: {
  level: MemberLevel;
  className?: string;
  showLabels?: boolean;
}) {
  const reduce = useReducedMotion();
  const atTop = level.nextMin === null;

  return (
    <div className={cn('space-y-1.5', className)}>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={level.progress}
        aria-label={`Kemajuan ke level ${level.nextName ?? 'tertinggi'}`}
      >
        <motion.div
          className={cn(
            'h-full rounded-full',
            atTop
              ? 'bg-gradient-to-r from-warning to-secondary'
              : 'bg-gradient-to-r from-primary to-secondary',
          )}
          initial={reduce ? false : { width: 0 }}
          animate={{ width: `${level.progress}%` }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>

      {showLabels ? (
        <div className="flex items-center justify-between gap-2 text-2xs text-muted-foreground">
          <span className="tabular-nums">
            {formatNumber(level.totalBorrowed)} peminjaman
          </span>
          <span>
            {atTop ? (
              'Level tertinggi'
            ) : (
              <>
                {formatNumber(level.remaining)} lagi ke{' '}
                <span className="font-medium text-foreground">{level.nextName}</span>
              </>
            )}
          </span>
        </div>
      ) : null}
    </div>
  );
}
