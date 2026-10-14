import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Indonesian number formatting: 12.500 */
export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '-';
  return new Intl.NumberFormat('id-ID').format(value);
}

/** Indonesian rupiah: Rp 1.000 */
export function formatRupiah(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '-';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value);
}

const DATE_FMT = new Intl.DateTimeFormat('id-ID', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});
const DATETIME_FMT = new Intl.DateTimeFormat('id-ID', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/** Parses the API's `YYYY-MM-DD HH:mm:ss` (local time, no timezone suffix). */
export function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const iso = value.includes('T') ? value : value.replace(' ', 'T');
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDate(value: string | null | undefined): string {
  const d = parseDate(value);
  return d ? DATE_FMT.format(d) : '-';
}

export function formatDateTime(value: string | null | undefined): string {
  const d = parseDate(value);
  return d ? DATETIME_FMT.format(d) : '-';
}

/** "2 hari lagi" / "3 hari lalu" - used for due dates. */
export function relativeDays(value: string | null | undefined): string {
  const d = parseDate(value);
  if (!d) return '-';
  const diffMs = d.getTime() - Date.now();
  const days = Math.round(diffMs / 86_400_000);
  if (days === 0) return 'hari ini';
  if (days === 1) return 'besok';
  if (days === -1) return 'kemarin';
  if (days > 0) return `${days} hari lagi`;
  return `terlambat ${Math.abs(days)} hari`;
}

/** Normalises a Date | 'YYYY-MM-DD...' | null into 'YYYY-MM-DD' for <input type="date">. */
export function toInputDate(value: Date | string | null | undefined): string {
  const d = value instanceof Date ? value : parseDate(value);
  if (!d || Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Deterministic accent colour from a string, used for avatars/covers. */
export function hashHue(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 360;
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

export function debounce<T extends (...args: never[]) => void>(fn: T, delay: number) {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
