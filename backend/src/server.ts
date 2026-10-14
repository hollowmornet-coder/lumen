import { createApp } from './app';
import { assertDatabaseConnection, closePool } from './config/db';
import { env } from './config/env';
import { logger } from './lib/logger';

async function bootstrap(): Promise<void> {
  try {
    await assertDatabaseConnection();
    logger.info(`Database connected: ${env.db.user}@${env.db.host}:${env.db.port}/${env.db.database}`);
  } catch (err) {
    logger.error('Tidak dapat terhubung ke database. Pastikan MariaDB/MySQL berjalan.', err);
    process.exit(1);
  }

  const app = createApp();
  const server = app.listen(env.port, () => {
    logger.info(`LUMEN API berjalan di http://localhost:${env.port}/api`);
  });

  const shutdown = async (signal: string) => {
    logger.info(`${signal} diterima, menutup server...`);
    server.close(async () => {
      await closePool();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 5000).unref();
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

void bootstrap();
