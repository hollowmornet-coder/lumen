/* Tiny dependency-free logger with levels and timestamps. */
type Level = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const active: number = LEVELS[(process.env.LOG_LEVEL as Level) ?? 'info'] ?? LEVELS.info;

function emit(level: Level, msg: string, meta?: unknown): void {
  if (LEVELS[level] < active) return;
  const ts = new Date().toISOString();
  const line = `${ts} [${level.toUpperCase()}] ${msg}`;
  if (meta === undefined) {
    console.log(line);
    return;
  }
  if (meta instanceof Error) {
    console.log(line, meta.message, meta.stack ?? '');
    return;
  }
  console.log(line, meta);
}

export const logger = {
  debug: (msg: string, meta?: unknown) => emit('debug', msg, meta),
  info: (msg: string, meta?: unknown) => emit('info', msg, meta),
  warn: (msg: string, meta?: unknown) => emit('warn', msg, meta),
  error: (msg: string, meta?: unknown) => emit('error', msg, meta),
};
