import * as React from 'react';

type Theme = 'light' | 'dark';

const STORAGE_KEY = 'lumen-theme';

/**
 * The `.dark` token block has existed in `index.css` from the start, but nothing
 * ever added the class — the whole palette was dead CSS. This hook is what makes
 * it reachable.
 *
 * The initial value is read from `localStorage` and falls back to the OS
 * preference, so a first-time visitor gets the theme their device already uses
 * instead of a flash of white.
 */
function readInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light';

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  // Keeps native controls (scrollbars, date pickers) in the same mode.
  root.style.colorScheme = theme;
}

interface ThemeContextValue {
  theme: Theme;
  toggle: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<Theme>(readInitialTheme);

  // Apply on mount and on every change. Doing it in an effect (not during
  // render) keeps the DOM write out of React's render phase.
  React.useEffect(() => {
    applyTheme(theme);
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  // Follow the OS only while the user has not chosen explicitly.
  React.useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (event: MediaQueryListEvent) => {
      if (!window.localStorage.getItem(STORAGE_KEY)) {
        setThemeState(event.matches ? 'dark' : 'light');
      }
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const setTheme = React.useCallback((next: Theme) => setThemeState(next), []);
  const toggle = React.useCallback(
    () => setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark')),
    [],
  );

  const value = React.useMemo(() => ({ theme, toggle, setTheme }), [theme, toggle, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme harus dipakai di dalam ThemeProvider.');
  return ctx;
}
