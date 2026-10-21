import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function str(key: string, fallback?: string): string {
  const v = process.env[key];
  if (v === undefined || v === '') {
    if (fallback !== undefined) return fallback;
    throw new Error(`Environment variable ${key} is required but missing.`);
  }
  return v;
}

function int(key: string, fallback: number): number {
  const v = process.env[key];
  if (v === undefined || v === '') return fallback;
  const n = Number.parseInt(v, 10);
  if (Number.isNaN(n)) throw new Error(`Environment variable ${key} must be a number.`);
  return n;
}

export const env = {
  nodeEnv: str('NODE_ENV', 'development'),
  isProd: str('NODE_ENV', 'development') === 'production',
  port: int('PORT', 4000),

  db: {
    host: str('DB_HOST', '127.0.0.1'),
    port: int('DB_PORT', 3307),
    user: str('DB_USER', 'lumen_user'),
    password: str('DB_PASSWORD', ''),
    database: str('DB_NAME', 'lumen_db'),
    connectionLimit: int('DB_CONNECTION_LIMIT', 10),
  },

  jwt: {
    secret: str('JWT_SECRET'),
    expiresIn: str('JWT_EXPIRES_IN', '7d'),
  },

  bcryptSaltRounds: int('BCRYPT_SALT_ROUNDS', 10),

  corsOrigin: str('CORS_ORIGIN', 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  uploadDir: str('UPLOAD_DIR', 'uploads'),
  maxUploadBytes: int('MAX_UPLOAD_MB', 3) * 1024 * 1024,
  // Profile photos get a larger ceiling than covers: an animated GIF that
  // actually moves is easily 2-3 MB, and a rejected upload is a dead end for
  // the student (there is nothing they can do to "fix" the file size).
  avatarMaxUploadBytes: int('AVATAR_MAX_UPLOAD_MB', 5) * 1024 * 1024,

  authRateLimit: {
    windowMs: int('AUTH_RATE_LIMIT_WINDOW_MIN', 15) * 60 * 1000,
    max: int('AUTH_RATE_LIMIT_MAX', 20),
  },
} as const;

export type Env = typeof env;
