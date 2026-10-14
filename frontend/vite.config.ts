import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    // Proxy keeps the browser on a single origin in development, so the
    // httpOnly session cookie works without any CORS workaround.
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        // Split the heavy libraries so the first paint stays small.
        // Function form: the object form is not available in this Rollup type.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          const p = id.replace(/\\/g, '/');
          if (/\/node_modules\/(recharts|d3-|victory-|internmap|delaunator|robust-predicates)/.test(p)) {
            return 'charts';
          }
          if (/\/node_modules\/(framer-motion|motion-dom|motion-utils)/.test(p)) {
            return 'motion';
          }
          if (/\/node_modules\/(react|react-dom|scheduler|react-router|react-router-dom|@remix-run)/.test(p)) {
            return 'react';
          }
          return undefined;
        },
      },
    },
  },
});
