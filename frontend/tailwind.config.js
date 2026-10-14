/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '1.5rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        /* --- LUMEN identity palette --- */
        navy: {
          950: 'hsl(var(--navy-950))',
          900: 'hsl(var(--navy-900))',
          800: 'hsl(var(--navy-800))',
          700: 'hsl(var(--navy-700))',
          /* Text tones for use on navy surfaces (sidebar, dark panels). */
          muted: 'hsl(var(--navy-muted))',
          subtle: 'hsl(var(--navy-subtle))',
        },
        ivory: 'hsl(var(--ivory))',
        electric: {
          DEFAULT: 'hsl(var(--electric))',
          soft: 'hsl(var(--electric-soft))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        violet: {
          DEFAULT: 'hsl(var(--violet))',
          soft: 'hsl(var(--violet-soft))',
        },
        cyan: {
          DEFAULT: 'hsl(var(--cyan))',
          soft: 'hsl(var(--cyan-soft))',
        },
        success: {
          DEFAULT: 'hsl(var(--success))',
          soft: 'hsl(var(--success-soft))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          soft: 'hsl(var(--warning-soft))',
        },
        danger: {
          DEFAULT: 'hsl(var(--destructive))',
          soft: 'hsl(var(--destructive-soft))',
        },
      },
      fontFamily: {
        /* Local-only font stacks. The UKK task requires the app to run with
           no internet, so no Google Fonts / webfont request is ever made. */
        display: [
          'Iowan Old Style',
          'Palatino Linotype',
          'Book Antiqua',
          'Palatino',
          'Georgia',
          'Cambria',
          'serif',
        ],
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      boxShadow: {
        soft: '0 1px 2px 0 rgb(15 23 42 / 0.05), 0 8px 24px -10px rgb(15 23 42 / 0.12)',
        panel: '0 1px 2px 0 rgb(15 23 42 / 0.05), 0 12px 32px -12px rgb(15 23 42 / 0.18)',
        // Used on hover for glass layers: depth, never contrast.
        lift: '0 2px 6px 0 rgb(15 23 42 / 0.06), 0 24px 48px -16px rgb(15 23 42 / 0.26)',
        glow: '0 0 0 1px hsl(var(--electric) / 0.22), 0 8px 24px -10px hsl(var(--electric) / 0.35)',
        inset: 'inset 0 1px 0 0 rgb(255 255 255 / 0.06)',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        'pulse-ring': {
          '0%': { opacity: '0.6', transform: 'scale(0.9)' },
          '70%': { opacity: '0', transform: 'scale(1.6)' },
          '100%': { opacity: '0', transform: 'scale(1.6)' },
        },
        'draw-in': {
          from: { transform: 'scaleX(0)' },
          to: { transform: 'scaleX(1)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.4s cubic-bezier(0.22, 1, 0.36, 1) both',
        shimmer: 'shimmer 1.6s infinite',
        'pulse-ring': 'pulse-ring 2s cubic-bezier(0.24, 0, 0.38, 1) infinite',
        'draw-in': 'draw-in 0.8s cubic-bezier(0.22, 1, 0.36, 1) both',
        float: 'float 7s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
