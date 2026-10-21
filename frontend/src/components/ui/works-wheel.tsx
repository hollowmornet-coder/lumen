import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, MoveHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------
// WorksWheel — a cover-flow selector for a series.
//
// Layout contract: the stage is the only positioning context, and every card
// is centred with `translate(-50%, -50%)` **inside** its own transform. The
// previous version relied on the `-translate-x-1/2` utility class while also
// writing `transform` inline, so the inline value silently replaced the
// centring and every card sat half a card off to the bottom-right.
// ---------------------------------------------------------------------

export interface WorksWheelItem {
  /** Stable identity. Required by React for keying. */
  id: string | number;
  title: string;
  /** Public URL/path to a cover, or null/undefined for the local fallback. */
  image?: string | null;
  /** Small secondary line, e.g. "4 tersedia". */
  meta?: string;
  /** Where "Lihat" should go. May be undefined for non-held titles. */
  href?: string;
}

/** Cards further than this from the active one are not painted at all. */
const MAX_VISIBLE = 3;

/** Horizontal distance between neighbouring cards, in px. */
const SPACING = 148;

/** Drag distance that counts as "one card", in px. */
const DRAG_STEP = 46;

// ---------------------------------------------------------------------
// Fallback cover — local, network-free, typographic
// ---------------------------------------------------------------------
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function pickGradient(seed: number): string {
  const palettes = [
    'from-indigo-700 via-indigo-900 to-navy-950',
    'from-emerald-700 via-emerald-900 to-navy-950',
    'from-rose-700 via-rose-900 to-navy-950',
    'from-amber-600 via-amber-800 to-navy-950',
    'from-sky-700 via-sky-900 to-navy-950',
    'from-violet-700 via-violet-900 to-navy-950',
  ];
  return palettes[seed % palettes.length];
}

function initialsOf(s: string): string {
  const words = s.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '??';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function WheelFallbackCover({ title, seed }: { title: string; seed: number }) {
  const grad = pickGradient(seed);
  const ini = initialsOf(title);
  return (
    <div
      className={cn(
        'relative flex h-full w-full flex-col items-center justify-center text-paper-50',
        'bg-gradient-to-br shadow-inner',
        grad,
      )}
      aria-hidden
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.15),transparent_55%)]" />
      <div className="relative flex flex-col items-center gap-2 px-3 text-center">
        <span className="font-display text-3xl font-bold tracking-tight drop-shadow-sm">{ini}</span>
        <span className="line-clamp-2 text-[0.65rem] font-medium leading-tight text-white/75">
          {title}
        </span>
      </div>
    </div>
  );
}

function WheelCover({ item }: { item: WorksWheelItem }) {
  // Track *which* src failed, not a boolean: a new cover arrives as a new
  // filename, and comparing against the current src resets the fallback
  // without an effect.
  const [failedSrc, setFailedSrc] = React.useState<string | null>(null);
  const seed = hashString(String(item.id) + '|' + item.title);
  const src = item.image && failedSrc !== item.image ? item.image : null;

  if (src) {
    return (
      <img
        src={src}
        alt={item.title}
        loading="lazy"
        draggable={false}
        onError={() => setFailedSrc(item.image ?? null)}
        className="h-full w-full object-cover"
      />
    );
  }
  return <WheelFallbackCover title={item.title} seed={seed} />;
}

// ---------------------------------------------------------------------
// WorksWheel
// ---------------------------------------------------------------------
export interface WorksWheelProps extends React.ComponentProps<'section'> {
  items: WorksWheelItem[];
  label: string;
  action?: string;
  className?: string;
}

export function WorksWheel({ items, label, action, className, ...props }: WorksWheelProps) {
  const navigate = useNavigate();
  const [rawActive, setRawActive] = React.useState(0);
  const stageRef = React.useRef<HTMLDivElement | null>(null);

  const count = items.length;
  const last = Math.max(0, count - 1);

  // Clamp during render rather than in an effect: when the series changes and
  // the list gets shorter, the stored index can point past the end, and an
  // effect would paint one frame with nothing selected.
  const active = Math.min(rawActive, last);

  // The native listeners below are registered once; they read the live index
  // from here instead of closing over a stale `active`.
  const activeRef = React.useRef(active);
  React.useEffect(() => {
    activeRef.current = active;
  }, [active]);

  const nudge = React.useCallback(
    (delta: number) => {
      setRawActive((current) => {
        const base = Math.min(current, Math.max(0, items.length - 1));
        return Math.max(0, Math.min(Math.max(0, items.length - 1), base + delta));
      });
    },
    [items.length],
  );

  const to = React.useCallback(
    (pos: number) => {
      if (items.length === 0) return;
      setRawActive(Math.max(0, Math.min(items.length - 1, pos)));
    },
    [items.length],
  );

  /**
   * Wheel / trackpad scrolling.
   *
   * React registers `wheel` as a passive listener at the root, so
   * `preventDefault()` inside an `onWheel` prop is ignored — the listener has
   * to be attached natively with `{ passive: false }`.
   *
   * It only swallows the gesture while there is a card left to turn to. At
   * either end the event is left alone, so the page keeps scrolling and the
   * wheel can never become a scroll trap.
   */
  React.useEffect(() => {
    const node = stageRef.current;
    if (!node || count < 2) return;

    let lockedUntil = 0;
    const onWheel = (event: WheelEvent) => {
      const delta = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
      if (delta === 0) return;

      const atStart = activeRef.current === 0;
      const atEnd = activeRef.current === count - 1;
      if ((delta > 0 && atEnd) || (delta < 0 && atStart)) return;

      event.preventDefault();

      // One card per gesture burst: a trackpad emits dozens of events per flick.
      const now = Date.now();
      if (now < lockedUntil) return;
      lockedUntil = now + 150;
      nudge(delta > 0 ? 1 : -1);
    };

    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, [count, nudge]);

  /**
   * Drag to turn.
   *
   * Deliberately *not* `setPointerCapture`: capturing retargets `pointerup` to
   * the stage, and the browser then dispatches `click` on the stage instead of
   * the card button, so tapping a cover would stop opening the book.
   */
  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    // Take focus on press so the arrow keys work straight after a click,
    // without the user having to Tab into the stage first.
    event.currentTarget.focus({ preventScroll: true });

    let lastX = event.clientX;
    let moved = false;

    const onMove = (e: PointerEvent) => {
      const dx = e.clientX - lastX;
      if (Math.abs(dx) < DRAG_STEP) return;
      lastX = e.clientX;
      moved = true;
      nudge(dx < 0 ? 1 : -1);
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);

      if (!moved) return;
      // A drag ends with a click on whatever is under the cursor; swallow that
      // one click so dragging never opens a book by accident.
      const swallow = (e: MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
      };
      window.addEventListener('click', swallow, { capture: true, once: true });
      window.setTimeout(
        () => window.removeEventListener('click', swallow, { capture: true }),
        0,
      );
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        nudge(1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        nudge(-1);
        break;
      case 'Home':
        to(0);
        break;
      case 'End':
        to(last);
        break;
      case 'Enter':
      case ' ': {
        const href = items[active]?.href;
        if (!href) return;
        navigate(href);
        break;
      }
      default:
        return;
    }
    event.preventDefault();
  }

  if (count === 0) {
    return (
      <section
        aria-label={label}
        className={cn('grid w-full place-items-center p-10 select-none', className)}
        {...props}
      >
        <p className="text-sm text-muted-foreground">Belum ada karya untuk seri ini.</p>
      </section>
    );
  }

  const current = items[active];

  return (
    <section
      aria-label={label}
      className={cn(
        'grid w-full select-none grid-cols-1 lg:grid-cols-[minmax(0,1fr)_15rem]',
        className,
      )}
      {...props}
    >
      {/* ---------- Stage ---------- */}
      <div className="relative min-w-0">
        <div
          ref={stageRef}
          tabIndex={0}
          role="group"
          aria-roledescription="korsel"
          aria-label={`${label}: putaran sampul`}
          onKeyDown={onKeyDown}
          onPointerDown={onPointerDown}
          className={cn(
            'relative h-[15.5rem] w-full touch-pan-y overflow-hidden outline-none sm:h-[25rem]',
            'cursor-grab focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
            'active:cursor-grabbing',
          )}
          style={{ perspective: '1100px' }}
        >
          {/* Soft floor, so the covers are not floating in nothing. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-7 mx-auto h-14 w-3/5 rounded-[50%] bg-navy-950/10 blur-2xl dark:bg-black/50"
          />

          {/* `pointer-events-none` is required, not cosmetic: this wrapper
              sits at z=0 while the side cards are pushed back with
              `translateZ(-90px)`, so without it the wrapper's own plane
              swallows every click aimed at a card behind the centre one. */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{ transformStyle: 'preserve-3d' }}
          >
            {items.map((item, i) => {
              const offset = i - active;
              const depth = Math.abs(offset);
              const hidden = depth > MAX_VISIBLE;
              const isActive = offset === 0;

              return (
                <div
                  key={item.id}
                  className={cn(
                    'pointer-events-auto absolute top-1/2 left-1/2 w-28 sm:w-36',
                    'transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.2,1,0.3,1)] motion-reduce:transition-none',
                  )}
                  style={{
                    // translate(-50%,-50%) is part of the same transform, so it
                    // cannot be clobbered by a utility class.
                    transform: [
                      'translate(-50%, -50%)',
                      `translateX(${offset * SPACING}px)`,
                      `translateZ(${-depth * 90}px)`,
                      `rotateY(${-offset * 30}deg)`,
                      `scale(${1 - depth * 0.04})`,
                    ].join(' '),
                    opacity: hidden ? 0 : Math.max(0.35, 1 - depth * 0.24),
                    zIndex: 30 - depth,
                    pointerEvents: hidden ? 'none' : 'auto',
                  }}
                  aria-hidden={hidden || undefined}
                >
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-label={
                      isActive && item.href
                        ? `Buka ${item.title}`
                        : `Tampilkan ${item.title} di putaran`
                    }
                    onClick={() => {
                      if (!isActive) {
                        to(i);
                        return;
                      }
                      if (item.href) navigate(item.href);
                    }}
                    className={cn(
                      'relative block aspect-[3/4] w-full overflow-hidden rounded-lg border bg-muted text-left',
                      'transition-shadow duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      isActive
                        ? 'border-border shadow-lift'
                        : 'border-border/60 shadow-md hover:border-border',
                    )}
                  >
                    <WheelCover item={item} />

                    {/* The position is meaningful in a series, so it is shown. */}
                    <span className="absolute top-1 left-1 rounded-full bg-navy-950/70 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-white tabular-nums backdrop-blur-sm">
                      {i + 1}
                    </span>

                    {isActive && action && item.href ? (
                      <span className="pointer-events-none absolute right-1 bottom-1 rounded-full bg-background/85 px-1.5 py-0.5 text-[0.6rem] font-medium text-foreground backdrop-blur-sm">
                        {action}
                      </span>
                    ) : null}

                    {!item.href ? (
                      <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-navy-950/75 px-1.5 py-1 text-[0.6rem] leading-tight text-white/85">
                        Belum di koleksi
                      </span>
                    ) : null}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* ---------- Controls: active title, counter, arrows ---------- */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-1 pt-1">
          <div className="min-w-0">
            <p className="truncate font-display text-sm font-semibold text-foreground">
              {current?.title}
            </p>
            <p className="text-2xs text-muted-foreground">
              {current?.meta ?? '\u00a0'}
              <span className="mx-1.5 opacity-40">·</span>
              <span className="tabular-nums">
                {active + 1} / {count}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => nudge(-1)}
              disabled={active === 0}
              aria-label="Karya sebelumnya"
              className="flex size-8 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40"
            >
              <ChevronLeft className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => nudge(1)}
              disabled={active === last}
              aria-label="Karya berikutnya"
              className="flex size-8 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40"
            >
              <ChevronRight className="size-4" aria-hidden />
            </button>
          </div>
        </div>

        <p className="mt-1 hidden items-center gap-1.5 px-1 text-2xs text-muted-foreground sm:flex">
          <MoveHorizontal className="size-3" aria-hidden />
          Geser kartu, gulir, atau pakai tombol panah.
        </p>
      </div>

      {/* ---------- Reading order ---------- */}
      <nav
        aria-label={`${label}: urutan baca`}
        className="border-t border-border/60 px-4 py-3 lg:max-h-[27rem] lg:overflow-y-auto lg:border-t-0 lg:border-l lg:px-4 lg:py-4 scrollbar-thin"
      >
        <p className="eyebrow mb-2 hidden lg:block">Urutan Baca</p>
        <ol className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground lg:flex-col lg:flex-nowrap lg:gap-y-0.5">
          {items.map((item, i) => {
            const isActive = i === active;
            return (
              <li key={item.id} className="lg:w-full">
                <button
                  type="button"
                  onClick={() => to(i)}
                  aria-current={isActive ? 'true' : undefined}
                  className={cn(
                    'flex w-full items-baseline gap-2 rounded px-1 py-0.5 text-left transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    isActive ? 'font-medium text-foreground' : 'hover:text-foreground',
                  )}
                >
                  <span className="w-4 shrink-0 text-right font-mono text-[10px] tabular-nums opacity-60">
                    {i + 1}
                  </span>
                  <span className="truncate">{item.title}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>
    </section>
  );
}
