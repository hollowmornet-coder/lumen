import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { env } from '../../config/env';
import { internal } from '../../lib/errors';

const run = promisify(execFile);

/**
 * Locates the `mysqldump` binary.
 *
 * Three environments are supported, in order of preference:
 *
 *  1. `MYSQLDUMP_PATH` — an explicit override for unusual installs.
 *  2. The portable MariaDB shipped under `_vendor` (Windows development).
 *  3. `mysqldump` on PATH — XAMPP, Laragon, a Linux server, a Docker image.
 *
 * The previous version returned the vendored `.exe` unconditionally, so on any
 * machine without `_vendor` (every Linux container) the backup button failed
 * with ENOENT even when `mysqldump` was installed normally.
 */
function dumpBinary(): string {
  const override = process.env.MYSQLDUMP_PATH;
  if (override) return override;

  const vendored = [
    path.resolve(process.cwd(), '..', '_vendor', 'mariadb-11.4.7-winx64', 'bin', 'mysqldump.exe'),
    path.resolve(process.cwd(), '_vendor', 'mariadb-11.4.7-winx64', 'bin', 'mysqldump.exe'),
    path.resolve(process.cwd(), '..', '_vendor', 'mariadb-11.4.7-winx64', 'bin', 'mysqldump'),
  ];

  for (const candidate of vendored) {
    if (fs.existsSync(candidate)) return candidate;
  }

  // Resolved through PATH by the OS; throws ENOENT later if truly missing.
  return process.platform === 'win32' ? 'mysqldump.exe' : 'mysqldump';
}

/**
 * Streams a logical backup as SQL text.
 *
 * `--single-transaction` keeps InnoDB consistent without locking the library
 * out while the dump runs; `--no-tablespaces` avoids needing PROCESS privileges
 * that the application user does not have.
 */
export async function dumpDatabase(): Promise<string> {
  const args = [
    `--host=${env.db.host}`,
    `--port=${env.db.port}`,
    `--user=${env.db.user}`,
    '--single-transaction',
    '--quick',
    '--no-tablespaces',
    '--default-character-set=utf8mb4',
    '--skip-comments',
    env.db.database,
  ];

  try {
    const { stdout } = await run(dumpBinary(), args, {
      maxBuffer: 64 * 1024 * 1024,
      windowsHide: true,
      // Password via environment, not argv: a command line is readable by
      // other users through `ps`/Task Manager while the dump runs.
      env: { ...process.env, MYSQL_PWD: env.db.password },
    });
    return stdout;
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    if (raw.includes('ENOENT')) {
      throw internal(
        'mysqldump tidak ditemukan. Pasang klien MySQL atau isi MYSQLDUMP_PATH di .env.',
      );
    }
    throw internal(`Gagal membuat cadangan database: ${raw.slice(0, 200)}`);
  }
}

/**
 * A backup file name that sorts chronologically and says what it is.
 *
 * Built from local time on purpose: a backup taken at 01:00 in Jakarta would
 * otherwise be named with the previous UTC day, and a librarian sorting the
 * folder would restore the wrong file after a mistake.
 */
export function backupFileName(): string {
  const now = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  const stamp =
    `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}` +
    `-${p(now.getHours())}-${p(now.getMinutes())}-${p(now.getSeconds())}`;
  return `lumen-backup-${stamp}.sql`;
}
