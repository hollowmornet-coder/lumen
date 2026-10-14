import type { Variants, Transition } from 'framer-motion';

/** Detect the OS "reduce motion" setting once, and re-evaluate on change. */
const query =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null;

export const prefersReducedMotion = (): boolean => query?.matches ?? false;

if (query) {
  const onChange = () => {
    document.documentElement.dataset.reducedMotion = String(query.matches);
  };
  onChange();
  query.addEventListener?.('change', onChange);
}

/* ---------------------------------------------------------------------
   Shared motion language.
   One easing curve and one duration scale, so every surface of the app
   feels like the same product. Keep it on transform + opacity.
   --------------------------------------------------------------------- */

export const EASE_OUT = [0.22, 1, 0.36, 1] as const;
export const EASE_IN_OUT = [0.65, 0, 0.35, 1] as const;

export const springSoft: Transition = { type: 'spring', stiffness: 320, damping: 32, mass: 0.8 };
export const springSnappy: Transition = { type: 'spring', stiffness: 480, damping: 38, mass: 0.6 };

export const DURATION = {
  fast: 0.18,
  base: 0.28,
  slow: 0.45,
} as const;

/** Page-level enter. Short fade + 8px rise; never blocks interaction. */
export const pageVariants: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: DURATION.base, ease: EASE_OUT } },
  exit: { opacity: 0, y: -4, transition: { duration: DURATION.fast, ease: EASE_IN_OUT } },
};

/** Parent that reveals children one after another. */
export const staggerContainer = (stagger = 0.05, delay = 0): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: stagger, delayChildren: delay } },
});

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: DURATION.base, ease: EASE_OUT } },
};

/** Modal: scale + fade, with a soft backdrop. */
export const dialogVariants: Variants = {
  initial: { opacity: 0, scale: 0.97, y: 8 },
  animate: { opacity: 1, scale: 1, y: 0, transition: { duration: DURATION.base, ease: EASE_OUT } },
  exit: { opacity: 0, scale: 0.98, y: 4, transition: { duration: DURATION.fast, ease: EASE_IN_OUT } },
};

export const backdropVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: DURATION.fast } },
  exit: { opacity: 0, transition: { duration: DURATION.fast } },
};

/** Dropdown / popover. */
export const popoverVariants: Variants = {
  initial: { opacity: 0, scale: 0.96, y: -4 },
  animate: { opacity: 1, scale: 1, y: 0, transition: { duration: DURATION.fast, ease: EASE_OUT } },
  exit: { opacity: 0, scale: 0.98, y: -2, transition: { duration: 0.12 } },
};

/** Sidebar collapse/expand. */
export const sidebarVariants: Variants = {
  expanded: { width: 272, transition: springSoft },
  collapsed: { width: 76, transition: springSoft },
};

/** Toast entry from the top-right. */
export const toastVariants: Variants = {
  initial: { opacity: 0, x: 24, scale: 0.98 },
  animate: { opacity: 1, x: 0, scale: 1, transition: springSnappy },
  exit: { opacity: 0, x: 24, scale: 0.98, transition: { duration: DURATION.fast } },
};

/** Collapses a whole subtree to nothing without leaving layout holes. */
export const collapseVariants: Variants = {
  collapsed: { height: 0, opacity: 0, transition: { duration: DURATION.base, ease: EASE_IN_OUT } },
  open: { height: 'auto', opacity: 1, transition: { duration: DURATION.base, ease: EASE_OUT } },
};

/** The opening logo reveal on the auth screen. Deliberately very short. */
export const introWordmark: Variants = {
  initial: { opacity: 0, y: 14, filter: 'blur(6px)' },
  animate: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.55, ease: EASE_OUT },
  },
};

export const introLine: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE_OUT, delay: 0.12 } },
};

/** Cards in the catalogue: lift on hover, settle on leave. */
export const cardHover = {
  rest: { y: 0, transition: { duration: DURATION.base, ease: EASE_OUT } },
  hover: { y: -4, transition: { duration: DURATION.base, ease: EASE_OUT } },
};
