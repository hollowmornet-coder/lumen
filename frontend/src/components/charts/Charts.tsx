import * as React from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { formatNumber } from '@/lib/utils';
import type { CategorySlice, StatusSlice, TopBook, TrendPoint } from '@/types';

const AXIS = { fontSize: 11, fill: 'hsl(220 12% 42%)' } as const;
const GRID = 'hsl(36 18% 86%)';

const CHART_COLORS = [
  'hsl(224 100% 58%)',
  'hsl(248 62% 62%)',
  'hsl(199 89% 52%)',
  'hsl(158 74% 34%)',
  'hsl(33 94% 42%)',
  'hsl(222 32% 40%)',
  'hsl(280 55% 60%)',
];

const STATUS_COLOR: Record<string, string> = {
  pending: 'hsl(33 94% 42%)',
  approved: 'hsl(224 100% 58%)',
  borrowed: 'hsl(199 89% 52%)',
  return_requested: 'hsl(248 62% 62%)',
  returned: 'hsl(158 74% 34%)',
  rejected: 'hsl(220 9% 55%)',
  cancelled: 'hsl(220 9% 70%)',
  overdue: 'hsl(0 72% 48%)',
};

const STATUS_LABEL: Record<string, string> = {
  pending: 'Menunggu',
  approved: 'Disetujui',
  borrowed: 'Dipinjam',
  return_requested: 'Minta Kembali',
  returned: 'Selesai',
  rejected: 'Ditolak',
  cancelled: 'Dibatalkan',
  overdue: 'Terlambat',
};

function ChartTooltip({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string; dataKey?: string }>;
  label?: string;
  formatter?: (value: number, name: string) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card/95 px-3 py-2 shadow-lift backdrop-blur-sm">
      {label ? <p className="mb-1 text-xs font-medium text-foreground">{label}</p> : null}
      <ul className="space-y-0.5">
        {payload.map((entry, i) => (
          <li key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ background: entry.color }}
              aria-hidden
            />
            <span>{entry.name}</span>
            <span className="ml-auto font-semibold tabular-nums text-foreground">
              {formatter
                ? formatter(Number(entry.value ?? 0), String(entry.name))
                : formatNumber(Number(entry.value ?? 0))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */

/** Borrow vs return over the selected range. */
export function TrendChart({ data }: { data: TrendPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="gradBorrowed" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(224 100% 58%)" stopOpacity={0.28} />
            <stop offset="100%" stopColor="hsl(224 100% 58%)" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="gradReturned" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(158 74% 34%)" stopOpacity={0.26} />
            <stop offset="100%" stopColor="hsl(158 74% 34%)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} minTickGap={16} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} width={40} />
        <Tooltip content={<ChartTooltip />} cursor={{ stroke: GRID, strokeWidth: 1 }} />
        <Legend
          verticalAlign="top"
          height={30}
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 12, color: 'hsl(220 12% 42%)' }}
        />
        <Area
          type="monotone"
          dataKey="borrowed"
          name="Peminjaman"
          stroke="hsl(224 100% 58%)"
          strokeWidth={2}
          fill="url(#gradBorrowed)"
          animationDuration={650}
        />
        <Area
          type="monotone"
          dataKey="returned"
          name="Pengembalian"
          stroke="hsl(158 74% 34%)"
          strokeWidth={2}
          fill="url(#gradReturned)"
          animationDuration={650}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Catalogue split by category. */
export function CategoryChart({ data }: { data: CategorySlice[] }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <ResponsiveContainer width="100%" height={200} className="shrink-0 sm:w-1/2">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={52}
            outerRadius={80}
            paddingAngle={2}
            strokeWidth={0}
            animationDuration={650}
          >
            {data.map((entry, i) => (
              <Cell key={entry.name} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip />} />
        </PieChart>
      </ResponsiveContainer>

      {/* Legend doubles as an accessible list. */}
      <ul className="w-full space-y-1.5 sm:w-1/2">
        {data.map((entry, i) => {
          const pct = total > 0 ? Math.round((entry.value / total) * 100) : 0;
          return (
            <li key={entry.name} className="flex items-center gap-2 text-xs">
              <span
                className="size-2.5 shrink-0 rounded-sm"
                style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                aria-hidden
              />
              <span className="min-w-0 flex-1 truncate text-muted-foreground">{entry.name}</span>
              <span className="font-medium tabular-nums text-foreground">
                {formatNumber(entry.value)}
              </span>
              <span className="w-9 text-right tabular-nums text-muted-foreground">{pct}%</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Transaction status mix. */
export function StatusChart({ data }: { data: StatusSlice[] }) {
  const ordered = React.useMemo(
    () => [...data].sort((a, b) => b.value - a.value),
    [data],
  );

  return (
    <ResponsiveContainer width="100%" height={230}>
      <BarChart data={ordered} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
        <XAxis type="number" tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="status"
          tick={AXIS}
          tickLine={false}
          axisLine={false}
          width={96}
          tickFormatter={(v: string) => STATUS_LABEL[v] ?? v}
        />
        <Tooltip
          content={<ChartTooltip />}
          cursor={{ fill: 'hsl(40 18% 92%)' }}
        />
        <Bar dataKey="value" name="Transaksi" radius={[0, 4, 4, 0]} animationDuration={600}>
          {ordered.map((entry) => (
            <Cell key={entry.status} fill={STATUS_COLOR[entry.status] ?? CHART_COLORS[0]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Most-borrowed titles. */
export function TopBooksChart({ data }: { data: TopBook[] }) {
  const rows = React.useMemo(
    () =>
      [...data]
        .sort((a, b) => b.borrowCount - a.borrowCount)
        .slice(0, 8)
        .map((b) => ({ ...b, short: b.title.length > 26 ? `${b.title.slice(0, 26)}...` : b.title })),
    [data],
  );

  if (rows.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Belum ada data peminjaman.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(200, rows.length * 34)}>
      <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
        <XAxis type="number" tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="short"
          tick={AXIS}
          tickLine={false}
          axisLine={false}
          width={170}
        />
        <Tooltip
          content={<ChartTooltip />}
          cursor={{ fill: 'hsl(40 18% 92%)' }}
        />
        <Bar dataKey="borrowCount" name="Dipinjam" fill="hsl(248 62% 62%)" radius={[0, 4, 4, 0]} animationDuration={600} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Compact sparkline used on the member dashboard. */
export function MiniLine({ data }: { data: TrendPoint[] }) {
  if (data.length === 0) return null;
  return (
    <ResponsiveContainer width="100%" height={80}>
      <LineChart data={data} margin={{ top: 6, right: 0, left: 0, bottom: 0 }}>
        <Line
          type="monotone"
          dataKey="borrowed"
          stroke="hsl(224 100% 58%)"
          strokeWidth={2}
          dot={false}
          animationDuration={600}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
