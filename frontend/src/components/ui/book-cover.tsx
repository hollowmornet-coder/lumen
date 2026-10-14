import * as React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { BookOpen } from 'lucide-react';
import { cn, formatNumber, hashHue } from '@/lib/utils';

/**
 * Animated number that counts up once the value is known.
 *
 * The final value is what the server returned - the animation only changes
 * how it is revealed, never the underlying number. Honours reduced motion by
 * rendering the real value immediately.
 */
export function CountUp({
  value,
  duration = 1.1,
  format = formatNumber,
  className,
}: {
  value: number;
  duration?: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const [display, setDisplay] = React.useState(reduce ? value : 0);
  const frame = React.useRef<number | undefined>(undefined);

  React.useEffect(() => {
    if (reduce) {
      setDisplay(value);
      return;
    }

    const start = performance.now();
    const delta = value - 0;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / (duration * 1000));
      // easeOutExpo - fast start, gentle settle.
      const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      setDisplay(Math.round(delta * eased));
      if (t < 1) frame.current = requestAnimationFrame(tick);
    };

    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [value, duration, reduce]);

  return <span className={cn('tabular-nums', className)}>{format(display)}</span>;
}

interface BookCoverProps {
  title: string;
  author?: string | null;
  src?: string | null;
  className?: string;
  rounded?: string;
}

/**
 * Book cover with a designed fallback.
 *
 * The fallback is generated locally from the title (deterministic hue + a
 * typographic spine layout) rather than a remote placeholder image, so the
 * catalogue still looks intentional with no internet connection and no cover
 * upload.
 */
export function BookCover({
  title,
  author,
  src,
  className,
  rounded = 'rounded-lg',
}: BookCoverProps) {
  const [failed, setFailed] = React.useState(false);
  const hue = hashHue(title);

  const showImage = Boolean(src) && !failed;

  return (
    <div
      className={cn(
        'relative isolate overflow-hidden bg-navy-900',
        rounded,
        className,
      )}
    >
      {showImage ? (
        <>
          <img
            src={src as string}
            alt={`Sampul buku ${title}`}
            loading="lazy"
            decoding="async"
            onError={() => setFailed(true)}
            className="size-full object-cover"
          />
          {/* Spine + gloss for depth without a heavy image. */}
          <div
            className="pointer-events-none absolute inset-y-0 left-0 w-1.5 bg-gradient-to-r from-black/35 to-transparent"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-white/10"
            aria-hidden
          />
        </>
      ) : (
        <div
          className="flex size-full flex-col justify-between p-3 text-left"
          style={{
            background: `linear-gradient(145deg,
              hsl(${hue} 42% 22%),
              hsl(${(hue + 28) % 360} 38% 14%))`,
          }}
        >
          <div className="flex items-center justify-between">
            <BookOpen className="size-3.5 text-white/55" aria-hidden />
            <span
              className="h-px w-8"
              style={{ background: `hsl(${hue} 70% 65% / 0.6)` }}
              aria-hidden
            />
          </div>
          <div className="space-y-1">
            <p
              className="line-clamp-3 font-display text-[13px] font-semibold leading-tight text-white/95"
              aria-hidden
            >
              {title}
            </p>
            {author ? (
              <p className="line-clamp-1 text-[10px] uppercase tracking-wider text-white/60" aria-hidden>
                {author}
              </p>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

/** Small cover used inside dense table rows. */
export function MiniCover(props: BookCoverProps) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
      className="h-14 w-10 shrink-0 shadow-sm"
    >
      <BookCover {...props} className="size-full" rounded="rounded-md" />
    </motion.div>
  );
}
