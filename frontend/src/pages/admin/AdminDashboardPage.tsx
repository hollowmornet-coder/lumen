import * as React from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  BarChart3,
  BookCheck,
  BookCopy,
  BookOpen,
  CalendarDays,
  Clock3,
  Flame,
  HandCoins,
  Library,
  RefreshCw,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageBody, PageHeader } from '@/components/layout/PageHeader';
import { StatCard, HeadlineFigure } from '@/components/ui/stat-card';
import { ChartSkeleton, Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { Badge, LoanStatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  CategoryChart,
  StatusChart,
  TopBooksChart,
  TrendChart,
} from '@/components/charts/Charts';
import { useAdminCharts, useAdminOverview, useLoans, useListParams } from '@/hooks/useApi';
import { toInputDate, formatDateTime, formatNumber, formatRupiah } from '@/lib/utils';
import { staggerContainer, staggerItem } from '@/lib/motion';

const BUCKETS = [
  { value: 'day', label: 'Harian' },
  { value: 'week', label: 'Mingguan' },
  { value: 'month', label: 'Bulanan' },
];

function defaultRange() {
  const to = new Date();
  const from = new Date(to.getTime() - 29 * 86_400_000);
  return { from: toInputDate(from), to: toInputDate(to) };
}

export default function AdminDashboardPage() {
  const { get, set } = useListParams();
  const defaults = React.useMemo(() => defaultRange(), []);

  const from = get('from', defaults.from);
  const to = get('to', defaults.to);
  const bucket = get('bucket', 'day');

  const overview = useAdminOverview();
  const charts = useAdminCharts({ from, to, bucket });

  const recent = useLoans({ pageSize: 6, sort: 'requested_at', direction: 'DESC' });

  const d = overview.data;
  const isLoading = overview.isLoading;
  const isError = overview.isError;

  const utilisation =
    d && d.totalCopies > 0 ? Math.round((d.borrowedCopies / d.totalCopies) * 100) : 0;

  return (
    <>
      <PageHeader
        eyebrow="Ringkasan Operasional"
        title="Dasbor Perpustakaan"
        description="Pantau kondisi koleksi, aktivitas peminjaman, dan anggota secara real-time dari database."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void overview.refetch();
              void charts.refetch();
              void recent.refetch();
            }}
          >
            <RefreshCw className="size-3.5" aria-hidden />
            Perbarui
          </Button>
        }
        meta={
          <div className="flex flex-wrap items-end gap-2">
            <label className="sr-only" htmlFor="range-from">
              Tanggal mulai
            </label>
            <input
              id="range-from"
              type="date"
              value={from}
              max={to}
              onChange={(e) => set('from', e.target.value)}
              className="h-8 rounded-md border border-input bg-card px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <span className="pb-1.5 text-xs text-muted-foreground">s/d</span>
            <label className="sr-only" htmlFor="range-to">
              Tanggal akhir
            </label>
            <input
              id="range-to"
              type="date"
              value={to}
              min={from}
              onChange={(e) => set('to', e.target.value)}
              className="h-8 rounded-md border border-input bg-card px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <div
              className="flex overflow-hidden rounded-md border border-input"
              role="group"
              aria-label="Kelompok periode"
            >
              {BUCKETS.map((b) => (
                <button
                  key={b.value}
                  type="button"
                  onClick={() => set('bucket', b.value)}
                  aria-pressed={bucket === b.value}
                  className={
                    bucket === b.value
                      ? 'bg-primary px-2.5 py-1.5 text-2xs font-semibold text-primary-foreground'
                      : 'bg-card px-2.5 py-1.5 text-2xs font-medium text-muted-foreground transition-colors hover:bg-muted'
                  }
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>
        }
      />

      <PageBody className="space-y-6">
        {isError ? (
          <ErrorState
            title="Gagal memuat ringkasan"
            message={overview.error?.message}
            onRetry={() => void overview.refetch()}
          />
        ) : (
          <>
            {/* ---------- Figures ---------- */}
            <section aria-label="Statistik utama">
              <div className="grid gap-4 lg:grid-cols-4">
                <div className="lg:col-span-1">
                  <HeadlineFigure
                    label="Judul Koleksi"
                    value={d?.totalTitles ?? 0}
                    caption={`${d?.categories ?? 0} kategori · ${d?.totalCopies ?? 0} eksemplar`}
                    loading={isLoading}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:col-span-3 lg:grid-cols-3">
                  <StatCard
                    index={0}
                    label="Eksemplar Tersedia"
                    value={d?.availableCopies ?? 0}
                    icon={BookCheck}
                    tone="success"
                    loading={isLoading}
                    hint={`${utilisation}% sedang dipinjam`}
                  />
                  <StatCard
                    index={1}
                    label="Sedang Dipinjam"
                    value={d?.borrowedCopies ?? 0}
                    icon={BookCopy}
                    tone="violet"
                    loading={isLoading}
                    hint={`dari ${d?.totalCopies ?? 0} eksemplar`}
                  />
                  <StatCard
                    index={2}
                    label="Anggota Aktif"
                    value={d?.activeMembers ?? 0}
                    icon={Users}
                    tone="electric"
                    loading={isLoading}
                    hint={`${d?.totalMembers ?? 0} total terdaftar`}
                  />
                  <StatCard
                    index={3}
                    label="Menunggu Persetujuan"
                    value={d?.pendingApprovals ?? 0}
                    icon={Clock3}
                    tone="warning"
                    loading={isLoading}
                    hint="perlu tindakan petugas"
                  />
                  <StatCard
                    index={4}
                    label="Pengembalian Masuk"
                    value={d?.returnRequests ?? 0}
                    icon={BookOpen}
                    tone="cyan"
                    loading={isLoading}
                    hint="menunggu verifikasi"
                  />
                  <StatCard
                    index={5}
                    label="Peminjaman Terlambat"
                    value={d?.overdueLoans ?? 0}
                    icon={AlertTriangle}
                    tone="danger"
                    loading={isLoading}
                    hint="lewat jatuh tempo"
                  />
                </div>
              </div>
            </section>

            {/* ---------- Needs attention ---------- */}
            <section aria-label="Perlu tindakan" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <AttentionTile
                to="/admin/denda"
                icon={HandCoins}
                tone="danger"
                label="Denda belum lunas"
                value={formatRupiah(d?.unpaidFinesTotal ?? 0)}
                hint={`${formatNumber(d?.unpaidFinesCount ?? 0)} tagihan terbuka`}
                loading={isLoading}
                alert={(d?.unpaidFinesCount ?? 0) > 0}
              />
              <AttentionTile
                to="/admin/transaksi?status=pickup_expired"
                icon={Clock3}
                tone="warning"
                label="Lewat batas ambil"
                value={formatNumber(d?.pickupExpired ?? 0)}
                hint="buku disisihkan, tidak diambil"
                loading={isLoading}
                alert={(d?.pickupExpired ?? 0) > 0}
              />
              <AttentionTile
                to="/admin/transaksi?status=return_requested"
                icon={Library}
                tone="cyan"
                label="Antrean menunggu"
                value={formatNumber(d?.queueWaiting ?? 0)}
                hint="anggota menunggu buku tersedia"
                loading={isLoading}
              />
              <AttentionTile
                to="/admin/buku"
                icon={BookCopy}
                tone="violet"
                label="Eksemplar rusak"
                value={formatNumber(d?.damagedCopies ?? 0)}
                hint="dalam perbaikan, tidak dipinjam"
                loading={isLoading}
                alert={(d?.damagedCopies ?? 0) > 0}
              />
            </section>

            {/* ---------- Charts ---------- */}
            <section className="grid gap-4 lg:grid-cols-3" aria-label="Visualisasi">
              <div className="panel p-5 lg:col-span-2">
                <header className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display text-base font-semibold">Tren Transaksi</h2>
                    <p className="text-xs text-muted-foreground">
                      Perbandingan peminjaman dan pengembalian pada periode terpilih
                    </p>
                  </div>
                  <Badge tone="info">
                    <CalendarDays className="size-3" aria-hidden />
                    {from} → {to}
                  </Badge>
                </header>

                {charts.isLoading ? (
                  <ChartSkeleton />
                ) : charts.isError ? (
                  <ErrorState
                    title="Gagal memuat grafik"
                    message={charts.error?.message}
                    onRetry={() => void charts.refetch()}
                  />
                ) : charts.data && charts.data.trend.length === 0 ? (
                  <EmptyState
                    icon={BarChart3}
                    title="Tidak ada transaksi pada periode ini"
                    description="Ubah rentang tanggal di atas untuk melihat aktivitas peminjaman dan pengembalian."
                    className="py-10"
                  />
                ) : (
                  <TrendChart data={charts.data?.trend ?? []} />
                )}
              </div>

              <div className="panel p-5">
                <header className="mb-4">
                  <h2 className="font-display text-base font-semibold">Distribusi Kategori</h2>
                  <p className="text-xs text-muted-foreground">Sebaran judul per kategori</p>
                </header>
                {charts.isLoading ? (
                  <ChartSkeleton />
                ) : charts.data && charts.data.categories.length === 0 ? (
                  <EmptyState title="Belum ada kategori" className="py-10" />
                ) : (
                  <CategoryChart data={charts.data?.categories ?? []} />
                )}
              </div>

              <div className="panel p-5">
                <header className="mb-4">
                  <h2 className="font-display text-base font-semibold">Status Transaksi</h2>
                  <p className="text-xs text-muted-foreground">Komposisi status pada periode ini</p>
                </header>
                {charts.isLoading ? (
                  <ChartSkeleton />
                ) : charts.data && charts.data.statuses.length === 0 ? (
                  <EmptyState title="Belum ada transaksi" className="py-10" />
                ) : (
                  <StatusChart data={charts.data?.statuses ?? []} />
                )}
              </div>

              <div className="panel p-5 lg:col-span-2">
                <header className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display text-base font-semibold">Buku Paling Sering Dipinjam</h2>
                    <p className="text-xs text-muted-foreground">Peringkat berdasarkan jumlah peminjaman</p>
                  </div>
                  <Flame className="size-4 text-warning" aria-hidden />
                </header>
                {charts.isLoading ? (
                  <ChartSkeleton />
                ) : (
                  <TopBooksChart data={charts.data?.topBooks ?? []} />
                )}
              </div>

              <div className="panel p-5">
                <header className="mb-4">
                  <h2 className="font-display text-base font-semibold">Anggota Teraktif</h2>
                  <p className="text-xs text-muted-foreground">Berdasarkan riwayat peminjaman</p>
                </header>
                {charts.isLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <Skeleton className="size-8 rounded-full" />
                        <Skeleton className="h-3 flex-1" />
                      </div>
                    ))}
                  </div>
                ) : !charts.data?.topMembers.length ? (
                  <EmptyState title="Belum ada aktivitas anggota" className="py-10" />
                ) : (
                  <ul className="space-y-2.5">
                    {charts.data.topMembers.slice(0, 6).map((m, i) => (
                      <li key={m.id} className="flex items-center gap-3">
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-2xs font-semibold text-muted-foreground">
                          {i + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{m.fullName}</p>
                          <p className="truncate text-2xs text-muted-foreground">
                            {m.memberCode ?? '-'} · {m.activeCount} aktif
                          </p>
                        </div>
                        {m.overdueCount > 0 ? (
                          <Badge tone="danger">{m.overdueCount} telat</Badge>
                        ) : (
                          <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                            {m.borrowCount}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            {/* ---------- Recent activity ---------- */}
            <section className="panel overflow-hidden" aria-label="Transaksi terbaru">
              <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
                <div>
                  <h2 className="font-display text-base font-semibold">Transaksi Terbaru</h2>
                  <p className="text-xs text-muted-foreground">Aktivitas peminjaman terakhir</p>
                </div>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/admin/transaksi">Lihat semua</Link>
                </Button>
              </header>

              {recent.isLoading ? (
                <div className="space-y-2 p-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="size-10 rounded-md" />
                      <Skeleton className="h-3 flex-1" />
                      <Skeleton className="h-5 w-20 rounded-full" />
                    </div>
                  ))}
                </div>
              ) : recent.data && recent.data.items.length > 0 ? (
                <motion.ul
                  variants={staggerContainer(0.04)}
                  initial="hidden"
                  animate="show"
                  className="divide-y divide-border"
                >
                  {recent.data.items.map((loan) => (
                    <motion.li
                      key={loan.id}
                      variants={staggerItem}
                      className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/40"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{loan.book.title}</p>
                        <p className="truncate text-2xs text-muted-foreground">
                          {loan.member.fullName} · {loan.loanCode}
                        </p>
                      </div>
                      <span className="hidden text-2xs text-muted-foreground sm:block">
                        {formatDateTime(loan.requestedAt)}
                      </span>
                      <LoanStatusBadge status={loan.displayStatus} />
                    </motion.li>
                  ))}
                </motion.ul>
              ) : (
                <EmptyState
                  icon={BookOpen}
                  title="Belum ada transaksi"
                  description="Transaksi akan muncul di sini setelah siswa mengajukan peminjaman."
                />
              )}
            </section>
          </>
        )}
      </PageBody>
    </>
  );
}

/* ------------------------------------------------------------------ */

/**
 * A tile that exists only to route the officer somewhere.
 *
 * Deliberately not a StatCard: these are not KPIs to admire, they are queues to
 * clear. When the number is above zero the whole tile turns urgent.
 */
function AttentionTile({
  to,
  icon: Icon,
  tone,
  label,
  value,
  hint,
  loading,
  alert,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: 'danger' | 'warning' | 'cyan' | 'violet';
  label: string;
  value: string;
  hint: string;
  loading: boolean;
  alert?: boolean;
}) {
  const tones = {
    danger: 'bg-destructive-soft text-destructive',
    warning: 'bg-warning-soft text-warning',
    cyan: 'bg-cyan-soft text-cyan',
    violet: 'bg-violet-soft text-secondary',
  } as const;

  return (
    <Link
      to={to}
      className={
        alert
          ? 'panel group flex items-start gap-3 border-warning/30 bg-warning-soft/30 p-4 transition-colors hover:border-warning/50'
          : 'panel group flex items-start gap-3 p-4 transition-colors hover:border-foreground/20'
      }
    >
      <span
        className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${tones[tone]}`}
        aria-hidden
      >
        <Icon className="size-[18px]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
        {loading ? (
          <div className="mt-1.5 h-6 w-20 rounded skeleton" aria-label="Memuat" />
        ) : (
          <p className="mt-1 font-display text-lg font-semibold tabular-nums text-foreground">
            {value}
          </p>
        )}
        <p className="mt-0.5 truncate text-2xs text-muted-foreground">{hint}</p>
      </div>
    </Link>
  );
}
