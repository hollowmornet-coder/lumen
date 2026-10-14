/**
 * PostCSS config.
 *
 * REQUIRED: without this file Vite never runs PostCSS, the `@tailwind`
 * directives in src/index.css stay unprocessed, and the app renders as
 * completely unstyled HTML.
 */
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
