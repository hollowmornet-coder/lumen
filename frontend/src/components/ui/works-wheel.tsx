import * as React from 'react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------
// WorksWheel — three-axis cylindrical cover selector.
//
// This rewrite replaces the previous implementation after the original
// source file was accidentally clobbered. It keeps the documented public
// contract (props + `WorksWheelItem`) and the props used by
// `SeriesDetailPage`. Strict TypeScript: no `any`, no implicit `undefined`.
// ---------------------------------------------------------------------

// ---------------------------------------------------------------------
// Public types (must match `SeriesDetailPage` expectations)
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

// ---------------------------------------------------------------------
// WheelFallbackCover — local, network-free typographic cover
// (mirrors the look of `BookCover` in the catalogue, without any network
// or font dependencies).
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
  const ascenders =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz' +
    '0123456789.,!?;:';
  void ascenders;
  return palettes[seed % palettes.length];
}

function initialsOf(s: string): string {
  const words = s.trim().split(/\s+/);
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
  const [broken, setBroken] = React.useState(false);
  const seed = hashString(String(item.id) + '|' + item.title);
  const src = !broken ? (item.image ?? null) : null;

  if (src) {
    return (
      <img
        src={src}
        alt={item.title}
        loading="lazy"
        onError={() => setBroken(true)}
        className="h-full w-full object-cover"
      />
    );
  }
  return <WheelFallbackCover title={item.title} seed={seed} />;
}

// ---------------------------------------------------------------------
// WorksWheel — the full interactive component
// ---------------------------------------------------------------------
export interface WorksWheelProps extends React.ComponentProps<'section'> {
  items: WorksWheelItem[];
  label: string;
  action?: string;
  className?: string;
}

export function WorksWheel({ items, label, action, className, ...props }: WorksWheelProps) {
  const [active, setActive] = React.useState(0);
  const stageRef = React.useRef<HTMLDivElement | null>(null);

  // Keep active within bounds when items change.
  React.useEffect(() => {
    if (items.length === 0) {
      setActive(0);
      return;
    }
    if (active > items.length - 1) setActive(items.length - 1);
  }, [items.length, active]);

  function to(pos: number) {
    if (items.length === 0) return;
    const next = Math.max(0, Math.min(items.length - 1, pos));
    setActive(next);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLElement>) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') to(active + 1);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') to(active - 1);
    else if (e.key === 'Home') to(0);
    else if (e.key === 'End') to(items.length - 1);
    else if ((e.key === 'Enter' || e.key === ' ') && items[active]?.href) {
      e.preventDefault();
      window.location.assign(items[active].href as string);
    } else return;
    e.preventDefault();
  }

  if (items.length === 0) {
    return (
      <section
        aria-label={label}
        className={cn('grid w-full place-items-center select-none', className)}
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
        'grid w-full select-none grid-cols-1 lg:grid-cols-[minmax(0,1fr)_17rem]',
        className,
      )}
      {...props}
    >
      {/* ---------- Wheel stage ---------- */}
      <div className="relative h-[520px] min-h-[24rem] w-full overflow-hidden bg-background/30">
        <div
          ref={stageRef}
          tabIndex={0}
          role="listbox"
          aria-label={label}
          aria-activedescendant={`works-wheel-${items[active]?.id ?? 0}`}
          className={cn(
            'focus-visible:outline-foreground absolute inset-0 touch-pan-y outline-none',
            'focus-visible:outline-2 focus-visible:-outline-offset-4',
          )}
          onKeyDown={onKeyDown}
        >
          {/* Show all cards stacked horizontally, scrollable */}
          <div className="absolute inset-y-0 left-0 flex items-center gap-5 overflow-hidden px-8 transition-transform">
            {items.map((item, i) => {
              const isActive = i === active;
              const scale = isActive ? 1 : 0.86;
              const x = (i - active) * 260;
              return (
                <div
                  key={item.id}
                  id={`works-wheel-${item.id}`}
                  role="option"
                  aria-selected={isActive}
                  style={{
                    transform: `translateX(${x}px) scale(${scale})`,
                    opacity: isActive ? 1 : 0.45,
                    zIndex: isActive ? 20 : 10,
                  }}
                  className={cn(
                    'group absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
                    'transition-all duration-500 ease-[cubic-bezier(0.2,1,0.3,1)] motion-reduce:transition-none',
                  )}
                  onClick={() => {
                    if (item.href) window.location.assign(item.href);
                  }}
                >
                  <div className="relative h-44 w-32 cursor-pointer overflow-hidden rounded-xl border border-border/70 shadow-lift sm:h-56 sm:w-40">
                    <WheelCover item={item} />
                    {action && item.href ? (
                      <span className="bg-background/80 text-foreground pointer-events-none absolute right-2 bottom-2 rounded-full px-2 py-0.5 text-[0.65rem] backdrop-blur-sm">
                        {action}
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Ring title at rest */}
          <div className="font-display pointer-events-none absolute inset-0 flex items-center justify-center text-white mix-blend-difference">
            <span className="sr-only">{label}</span>
          </div>
          <div
            aria-hidden
            className="font-display text-foreground pointer-events-none absolute top-1/2 left-6 -translate-y-1/2 text-2xl font-semibold opacity-15 md:left-10 md:text-3xl"
          >
            {label}
          </div>
          <div
            aria-hidden
            className="font-display text-foreground pointer-events-none absolute top-1/2 right-6 -translate-y-1/2 max-w-[32%] truncate text-2xl font-semibold tracking-tight md:right-10 md:text-3xl"
          >
            {current?.title}
          </div>
        </div>
      </div>

      {/* ---------- index column ---------- */}
      <nav
        aria-label={`${label} index`}
        className="border-t border-border/60 px-4 py-3 lg:max-h-[520px] lg:overflow-y-auto lg:border-t-0 lg:border-l lg:px-5 lg:py-5 scrollbar-thin"
      >
        <p className="eyebrow mb-2 hidden lg:block">Urutan Baca</p>
        <ol className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground lg:flex-col lg:flex-nowrap lg:gap-y-0 lg:leading-[1.7]">
          {items.map((item, i) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => to(i)}
                aria-current={i === active}
                className={cn(
                  'cursor-pointer text-left transition-colors outline-none focus-visible:outline-1',
                  i === active && 'text-foreground font-medium',
                )}
                style={{ fontSize: '0.75rem' }}
              >
                {i + 1}. {item.title}
              </button>
            </li>
          ))}
        </ol>
      </nav>
    </section>
  );
}
