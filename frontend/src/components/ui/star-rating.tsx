import * as React from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StarRatingProps {
  value: number;
  /** Renders a read-only average, rounded to the nearest half star. */
  readOnly?: boolean;
  onChange?: (value: number) => void;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  label?: string;
}

const SIZES = { sm: 'size-3.5', md: 'size-4', lg: 'size-6' } as const;

/**
 * Star rating.
 *
 * Read-only mode fills by half stars so an average of 4.3 does not look
 * identical to 4.0. Interactive mode only ever produces whole stars, because a
 * half star cannot be submitted as a meaningful opinion.
 */
export function StarRating({
  value,
  readOnly = false,
  onChange,
  size = 'md',
  className,
  label,
}: StarRatingProps) {
  const [hovered, setHovered] = React.useState<number | null>(null);
  const active = hovered ?? value;

  return (
    <div
      className={cn('flex items-center gap-0.5', className)}
      role={readOnly ? 'img' : 'radiogroup'}
      aria-label={label ?? `Rating ${value} dari 5`}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const fill = readOnly ? Math.min(1, Math.max(0, active - star + 1)) : active >= star ? 1 : 0;

        if (readOnly) {
          return (
            <span key={star} className="relative inline-flex" aria-hidden>
              <Star className={cn(SIZES[size], 'text-muted-foreground/35')} />
              {fill > 0 ? (
                <span
                  className="absolute inset-0 overflow-hidden"
                  style={{ width: `${fill * 100}%` }}
                >
                  <Star className={cn(SIZES[size], 'fill-warning text-warning')} />
                </span>
              ) : null}
            </span>
          );
        }

        return (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={value === star}
            aria-label={`${star} bintang`}
            onClick={() => onChange?.(star)}
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(null)}
            onFocus={() => setHovered(star)}
            onBlur={() => setHovered(null)}
            className="rounded-sm p-0.5 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Star
              className={cn(
                SIZES[size],
                active >= star ? 'fill-warning text-warning' : 'text-muted-foreground/40',
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
