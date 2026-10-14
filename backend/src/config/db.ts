import mysql, { type Pool, type PoolConnection, type RowDataPacket, type ResultSetHeader } from 'mysql2/promise';
import { env } from './env';
import { logger } from '../lib/logger';

let pool: Pool | null = null;

export function getPool(): Pool {
  if (pool) return pool;

  pool = mysql.createPool({
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    database: env.db.database,
    waitForConnections: true,
    connectionLimit: env.db.connectionLimit,
    queueLimit: 0,
    charset: 'utf8mb4_unicode_ci',
    // Return DATETIME as plain 'YYYY-MM-DD HH:mm:ss' in local time, not JS Date.
    // This keeps timezone handling explicit and avoids off-by-one-day bugs on due dates.
    dateStrings: true,
    timezone: 'local',
    enableKeepAlive: true,
  });

  // mysql2's typed `on` overload only exposes 'enqueue'; the pool also emits
  // 'error'. Cast the emitter surface rather than dropping the handler.
  (pool as unknown as { on(event: string, cb: (err: Error) => void): void }).on(
    'error',
    (err: Error) => {
      logger.error('MySQL pool error', err);
    },
  );

  return pool;
}

/** Verify the database is reachable. Used by /api/health and on boot. */
export async function assertDatabaseConnection(): Promise<void> {
  const conn = await getPool().getConnection();
  try {
    await conn.query('SELECT 1');
  } finally {
    conn.release();
  }
}

/** Run a SELECT and return typed rows. */
export async function query<T extends RowDataPacket>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const [rows] = await getPool().query<T[]>(sql, params);
  return rows;
}

/** Run a SELECT and return the first row (or null). */
export async function queryOne<T extends RowDataPacket>(
  sql: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

/** Run an INSERT/UPDATE/DELETE and return the result header. */
export async function execute(
  sql: string,
  params: unknown[] = [],
): Promise<ResultSetHeader> {
  const [result] = await getPool().query<ResultSetHeader>(sql, params);
  return result;
}

/**
 * Execute `fn` inside a real database transaction.
 * Rolls back on any thrown error. This is the ONLY safe way to mutate
 * `books.available_copies` or `loans.status`, because those two columns
 * must stay consistent with each other under concurrent requests.
 */
export async function withTransaction<T>(
  fn: (conn: PoolConnection) => Promise<T>,
): Promise<T> {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    try {
      await conn.rollback();
    } catch (rollbackErr) {
      logger.error('Rollback failed', rollbackErr);
    }
    throw err;
  } finally {
    conn.release();
  }
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

export type { RowDataPacket, ResultSetHeader, PoolConnection };
