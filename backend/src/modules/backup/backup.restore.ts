import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { env } from '../../config/env';
import { badRequest, internal } from '../../lib/errors';

/**
 * Locates a MySQL/MariaDB client binary.
 *
 * Same three-step strategy as `dumpBinary`: explicit override, the portable
 * MariaDB under `_vendor`, then PATH. Restore needs the *client* (`mysql`), not
 * the dumper, so both binaries are resolved by the same rules but different
 * names.
 */
function clientBinary(): string {
  const override = process.env.MYSQLCLIENT_PATH ?? process.env.MYSQL_PATH;
  if (override) return override;

  const exe = process.platform === 'win32' ? '.exe' : '';
  const vendored = [
    path.resolve(process.cwd(), '..', '_vendor', 'mariadb-11.4.7-winx64', 'bin', `mysql${exe}`),
    path.resolve(process.cwd(), '_vendor', 'mariadb-11.4.7-winx64', 'bin', `mysql${exe}`),
  ];

  for (const candidate of vendored) {
    if (fs.existsSync(candidate)) return candidate;
  }

  return process.platform === 'win32' ? 'mysql.exe' : 'mysql';
}

/** Tables a genuine LUMEN dump must contain before we allow it to overwrite. */
const REQUIRED_TABLES = ['users', 'books', 'loans', 'settings'];

export interface RestoreReport {
  bytes: number;
  tables: string[];
  durationMs: number;
}

/**
 * Refuses files that are not LUMEN dumps.
 *
 * Restoring the wrong `.sql` into a live database is the most destructive
 * action this application offers. A cheap content check catches the common
 * mistakes — an empty upload, a different project's dump, a plain text file
 * renamed to `.sql` — before anything is dropped.
 */
export function inspectDump(sql: string): string[] {
  if (sql.trim().length === 0) {
    throw badRequest('Berkas cadangan kosong.');
  }

  const lower = sql.toLowerCase();
  const found = REQUIRED_TABLES.filter((table) =>
    lower.includes(`create table \`${table}\``) || lower.includes(`create table ${table}`),
  );

  if (found.length !== REQUIRED_TABLES.length) {
    const missing = REQUIRED_TABLES.filter((t) => !found.includes(t));
    throw badRequest(
      `Berkas ini bukan cadangan LUMEN yang sah (tabel tidak ditemukan: ${missing.join(', ')}).`,
    );
  }

  // A dump from a different schema version would silently drop the new columns
  // and break features added after the backup was taken.
  const tables = Array.from(
    new Set(
      Array.from(lower.matchAll(/create table (?:if not exists )?`?([a-z0-9_]+)`?/g)).map(
        (m) => m[1],
      ),
    ),
  );

  return tables;
}

/**
 * Restores the database from a SQL dump.
 *
 * The file is piped to the `mysql` client rather than parsed in Node: the dump
 * contains multi-statement procedures and `DELIMITER` blocks that a naive
 * splitter would mangle. The client is the same tool that produced the file, so
 * it is the only parser guaranteed to read it back correctly.
 */
export async function restoreDatabase(buffer: Buffer): Promise<RestoreReport> {
  const sql = buffer.toString('utf8');
  const tables = inspectDump(sql);

  const tempFile = path.join(
    os.tmpdir(),
    `lumen-restore-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.sql`,
  );
  fs.writeFileSync(tempFile, buffer);

  const startedAt = Date.now();

  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(
        clientBinary(),
        [
          `--host=${env.db.host}`,
          `--port=${env.db.port}`,
          `--user=${env.db.user}`,
          '--default-character-set=utf8mb4',
          env.db.database,
        ],
        {
          windowsHide: true,
          // Password through the environment, never argv.
          env: { ...process.env, MYSQL_PWD: env.db.password },
        },
      );

      let stderr = '';
      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      child.on('error', (err: NodeJS.ErrnoException) => {
        reject(
          err.code === 'ENOENT'
            ? internal(
                'Klien mysql tidak ditemukan. Pasang klien MySQL atau isi MYSQLCLIENT_PATH di .env.',
              )
            : err,
        );
      });

      child.on('close', (code) => {
        if (code === 0) resolve();
        else reject(internal(`Restore gagal: ${stderr.slice(0, 300) || `kode ${code}`}`));
      });

      const stream = fs.createReadStream(tempFile);
      stream.on('error', reject);
      stream.pipe(child.stdin);
    });
  } finally {
    // Always remove the temp file: it contains every member's personal data.
    fs.rm(tempFile, { force: true }, () => undefined);
  }

  return { bytes: buffer.byteLength, tables, durationMs: Date.now() - startedAt };
}