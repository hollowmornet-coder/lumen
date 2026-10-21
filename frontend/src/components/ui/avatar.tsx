import * as React from 'react';
import { cn, initials } from '@/lib/utils';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const SIZES: Record<AvatarSize, { box: string; text: string }> = {
  xs: { box: 'size-6', text: 'text-[9px]' },
  sm: { box: 'size-8', text: 'text-[10px]' },
  md: { box: 'size-10', text: 'text-xs' },
  lg: { box: 'size-14', text: 'text-base' },
  xl: { box: 'size-24', text: 'text-2xl' },
};

/**
 * Profile photo with an initials fallback.
 *
 * An animated GIF animates on its own inside `<img>`; nothing extra is needed
 * to "support" it beyond not re-encoding the file on upload. `onError` falls
 * back to initials so a deleted file never leaves a broken-image icon.
 *
 * The component is deliberately presentational: it takes a path, not a user,
 * so it works for the header, member tables, and the leaderboard alike.
 */
export function Avatar({
  name,
  src,
  size = 'sm',
  className,
  ring = false,
  alt,
}: {
  name: string;
  src?: string | null;
  size?: AvatarSize;
  className?: string;
  /** Adds a subtle level ring - used for the member's own profile. */
  ring?: boolean;
  alt?: string;
}) {
  // Track *which* src failed instead of a boolean: a new upload produces a new
  // filename, and comparing against the current src resets the fallback without
  // an effect (and without a render pass on every path change).
  const [failedSrc, setFailedSrc] = React.useState<string | null>(null);
  const showImage = Boolean(src) && failedSrc !== src;
  const dims = SIZES[size];

  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full',
        'bg-gradient-to-br from-primary to-secondary font-display font-semibold text-white',
        'select-none',
        dims.box,
        dims.text,
        ring && 'ring-2 ring-primary/40 ring-offset-2 ring-offset-background',
        className,
      )}
      aria-hidden={showImage ? undefined : true}
    >
      {showImage ? (
        <img
          src={src as string}
          alt={alt ?? `Foto profil ${name}`}
          // No lazy loading: avatars sit above the fold in the header.
          decoding="async"
          onError={() => setFailedSrc(src as string)}
          className="size-full object-cover"
        />
      ) : (
        <span aria-hidden>{initials(name || '?')}</span>
      )}
    </span>
  );
}
