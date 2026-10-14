import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import path from 'node:path';
import { env } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/error';
import routes from './routes';

export function createApp() {
  const app = express();

  // Trust the local reverse proxy (Vite dev proxy) for correct req.ip.
  app.set('trust proxy', 1);

  app.use(
    helmet({
      // Images are served from this origin (book covers); the default
      // same-origin policy is what we want, so we only relax CSP for
      // the inline styles Vite injects during development.
      contentSecurityPolicy: env.isProd ? undefined : false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.use(
    cors({
      origin: env.corsOrigin,
      credentials: true,
    }),
  );

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser());

  // Uploaded book covers. Served as static files, never executed.
  app.use(
    '/uploads',
    express.static(path.resolve(process.cwd(), env.uploadDir), {
      maxAge: '7d',
      index: false,
      dotfiles: 'deny',
    }),
  );

  app.get('/api/health', (_req, res) => {
    res.json({ success: true, data: { status: 'ok', service: 'lumen-api' } });
  });

  app.use('/api', routes);

  // In production the frontend is shipped inside ./public and served by the
  // same Express process. In development Vite owns the static assets.
  if (env.isProd) {
    const publicDir = path.resolve(process.cwd(), 'public');
    app.use(express.static(publicDir, { maxAge: '7d', index: true }));
    app.get('*', (_req, res) => res.sendFile(path.join(publicDir, 'index.html')));
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
