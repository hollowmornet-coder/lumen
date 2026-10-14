import * as React from 'react';
import { motion, useReducedMotion, type Variants } from 'framer-motion';
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  ClipboardList,
  FileSpreadsheet,
  Flame,
  Info,
  Library,
  PackageCheck,
  RefreshCw,
  SlidersHorizontal,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageBody, PageHeader } from '@/components/layout/PageHeader';
import { CategoryChart, TopBooksChart, TrendChart } from '@/components/charts/Charts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/input';
import { ChartSkeleton } from '@/components/ui/skeleton';
import { HeadlineFigure, StatCard } from '@/components/ui/stat-card';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { useAdminCharts, useListParams } from '@/hooks/useApi';
import { ApiError, downloadFile } from '@/lib/api';
import { cn, formatNumber, toInputDate } from '@/lib/utils';
import { staggerContainer, staggerItem } from '@/lib/motion';

/** Motion collapses to a static state when the OS asks for less movement. */
const STILL: Variants = { hidden: {}, show: {} };

/** Mirrors the `status` enum accepted by GET /api/loans and the loan export. */
const STATUS_OPTIONS = [
  { value: 'all', label: 'Semua status' },
  { value: 'pending', label: 'Menunggu persetujuan' },
  { value: 'approved', label: 'Disetujui, siap diserahkan' },
  { value: 'borrowed', label: 'Sedang dipinjam' },
  { value: 'return_requested', label: 'Permintaan pengembalian' },
  { value: 'returned', label: 'Selesai' },
  { value: 'rejected', label: 'Ditolak' },
  { value: 'cancelled', label: 'Dibatalkan' },
] as const;

const BUCKETS = [
  { value: 'day', label: 'Harian' },
  { value: 'week', label: 'Mingguan' },
  { value: 'month', label: 'Bulanan' },
] as const;

const RANGE_PRESETS = [
  { value: '7', label: '7 hari' },
  { value: '30', label: '30 hari' },
  { value: '90', label: '90 hari' },
] as const;

/** Columns the server expects in the import template (see excel.service.ts). */
const TEMPLATE_COLUMNS: ReadonlyArray<{ name: string; required: boolean; note: string }> = [
  { name: 'ISBN', required: true, note: 'ISBN-10 atau ISBN-13, wajib unik per judul.' },
  { name: 'Judul', required: true, note: 'Judul buku, minimal 2 karakter.' },
  { name: 'Penulis', required: true, note: 'Nama penulis, minimal 2 karakter.' },
  { name: 'Penerbit', required: false, note: 'Nama penerbit bila tersedia.' },
  { name: 'Tahun Terbit', required: false, note: 'Angka antara 1000 dan tahun depan.' },
  { name: 'Kategori', required: false, note: 'Harus sama dengan nama kategori yang sudah ada.' },
  { name: 'Lokasi Rak', required: false, note: 'Kode rak, contoh F-01-01.' },
  { name: 'Jumlah Eksemplar', required: true, note: 'Jumlah fisik, angka minimal 1.' },
  { name: 'Deskripsi', required: false, note: 'Ringkasan singkat, maksimal 2000 karakter.' },
];

/** The same 9 columns must exist in row 1, or the file is rejected outright. */
const TEMPLATE_HEADERS = TEMPLATE_COLUMNS.map((c) => c.name);

function defaultRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to.getTime() - 29 * 86_400_000);
  return { from: toInputDate(from), to: toInputDate(to) };
}

function shiftRange(days: number): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to.getTime() - (days - 1) * 86_400_000);
  return { from: toInputDate(from), to: toInputDate(to) };
}

/** Inclusive day count, so "today to today" reads as 1, not 0. */
function countDays(from: string, to: string): number {
  const start = new Date(from).getTime();
  const end = new Date(to).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return 0;
  return Math.max(1, Math.round((end - start) / 86_400_000) + 1);
}

interface ExportSpec {
  key: string;
  label: string;
  description: string;
  hint: string;
  icon: LucideIcon;
  path: string;
  query: Record<string, string>;
  fallbackName: string;
}

export default function AdminReportsPage() {
  const defaults = React.useMemo(
    () => ({ ...defaultRange(), bucket: 'day', status: 'all' }),
    [],
  );
  const { get, set, setMany } = useListParams(defaults);

  const from = get('from');
  const to = get('to');
  const bucket = get('bucket', 'day');
  const status = get('status', 'all');

  const [busy, setBusy] = React.useState<string | null>(null);

  const charts = useAdminCharts({ from, to, bucket });

  const reduce = useReducedMotion();
  const containerVariants = reduce ? STILL : staggerContainer(0.04);
  const itemVariants = reduce ? STILL : staggerItem;

  const rangeDays = countDays(from, to);
  const trend = charts.data?.trend ?? [];
  const totalBorrowed = trend.reduce((sum, point) => sum + point.borrowed, 0);
  const totalReturned = trend.reduce((sum, point) => sum + point.returned, 0);
  const topBook = charts.data?.topBooks?.[0];
  const perDay = rangeDays > 0 ? Math.round(totalBorrowed / rangeDays) : 0;
  const activePreset = RANGE_PRESETS.find(
    (p) => shiftRange(Number(p.value)).from === from && shiftRange(Number(p.value)).to === to,
  );

  // Rebuilt on every render on purpose: the list is tiny and only read on click.
  const exports: ExportSpec[] = [
      {
        key: 'books',
        label: 'Data Buku',
        description: 'Seluruh koleksi beserta ISBN, kategori, lokasi rak, dan jumlah stok.',
        hint: 'Batas ekspor 5.000 baris.',
        icon: BookOpen,
        path: '/excel/export/books',
        query: {},
        fallbackName: 'lumen-buku.xlsx',
      },
      {
        key: 'members',
        label: 'Data Anggota',
        description: 'Daftar anggota lengkap: kode anggota, kontak, kelas, dan riwayat pinjam.',
        hint: 'Batas ekspor 5.000 baris.',
        icon: Users,
        path: '/excel/export/members',
        query: {},
        fallbackName: 'lumen-anggota.xlsx',
      },
      {
        key: 'loans',
        label: 'Laporan Transaksi',
        description: 'Transaksi peminjaman pada periode dan status yang sedang dipilih.',
        hint: 'Mengikuti filter tanggal dan status di atas.',
        icon: ClipboardList,
        path: '/excel/export/loans',
        query: { from, to, ...(status !== 'all' ? { status } : {}) },
        fallbackName: 'lumen-transaksi.xlsx',
      },
  ];

  const runExport = async (spec: ExportSpec) => {
    setBusy(spec.key);
    try {
      await downloadFile(spec.path, spec.query, spec.fallbackName);
      toast.success(`${spec.label} berhasil diunduh.`);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : 'Gagal mengunduh berkas. Silakan coba lagi.',
      );
    } finally {
      setBusy(null);
    }
  };

  const downloadTemplate = async () => {
    setBusy('template');
    try {
      await downloadFile('/excel/template', undefined, 'lumen-template-impor-buku.xlsx');
      toast.success('Template impor berhasil diunduh.');
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : 'Gagal mengunduh template. Silakan coba lagi.',
      );
    } finally {
      setBusy(null);
    }
  };

  const activeStatusLabel = STATUS_OPTIONS.find((o) => o.value === status)?.label ?? 'Semua status';

  return (
    <>
      <PageHeader
        eyebrow="Pusat Pelaporan"
        title="Laporan dan Ekspor"
        description="Rangkum aktivitas perpustakaan pada periode tertentu, lalu unduh data mentah sebagai berkas Excel untuk diolah kembali."
        breadcrumb={[
          { label: 'Dasbor', to: '/admin' },
          { label: 'Laporan' },
        ]}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => void charts.refetch()}
            loading={charts.isFetching && !charts.isLoading}
          >
            <RefreshCw className="size-3.5" aria-hidden />
            Perbarui
          </Button>
        }
        meta={
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {charts.isLoading
              ? 'Menyusun laporan...'
              : `${from} s/d ${to} · ${formatNumber(rangeDays)} hari · ${activeStatusLabel}`}
          </p>
        }
      />

      <PageBody className="space-y-6">
        {/* ---------- Filter ---------- */}
        <section className="panel p-4" aria-label="Filter periode laporan">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4 lg:items-end">
            <Field label="Dari tanggal" htmlFor="report-from">
              <Input
                id="report-from"
                type="date"
                value={from}
                max={to}
                onChange={(e) => set('from', e.target.value)}
              />
            </Field>

            <Field label="Sampai tanggal" htmlFor="report-to">
              <Input
                id="report-to"
                type="date"
                value={to}
                min={from}
                onChange={(e) => set('to', e.target.value)}
              />
            </Field>

            <Field label="Status transaksi" htmlFor="report-status">
              <Select
                id="report-status"
                value={status}
                onChange={(e) => set('status', e.target.value)}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="space-y-1.5">
              <span
                className="text-sm font-medium leading-none text-foreground"
                id="report-period-label"
              >
                Periode grafik
              </span>
              <div
                role="group"
                aria-labelledby="report-period-label"
                className="flex overflow-hidden rounded-lg border border-input"
              >
                {BUCKETS.map((b) => (
                  <button
                    key={b.value}
                    type="button"
                    onClick={() => set('bucket', b.value)}
                    aria-pressed={bucket === b.value}
                    className={cn(
                      'flex-1 px-2.5 py-2 text-xs font-medium transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                      bucket === b.value
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-card text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
              <SlidersHorizontal className="size-3" aria-hidden />
              Periode cepat
            </span>
            {RANGE_PRESETS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => setMany({ ...shiftRange(Number(preset.value)) })}
                aria-pressed={activePreset?.value === preset.value}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-2xs font-medium transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  activePreset?.value === preset.value
                    ? 'border-primary/30 bg-electric-soft text-primary'
                    : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                {preset.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setMany({ ...defaultRange() })}
              className="rounded text-2xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Kembalikan ke 30 hari terakhir
            </button>
          </div>
        </section>

        {/* ---------- Summary tiles ---------- */}
        <section aria-label="Ringkasan periode">
          <div className="grid gap-4 lg:grid-cols-4">
            <HeadlineFigure
              label="Total Peminjaman"
              value={totalBorrowed}
              caption={`${formatNumber(rangeDays)} hari terpilih`}
              loading={charts.isLoading}
            />
            <div className="grid gap-4 sm:grid-cols-2 lg:col-span-3">
              <StatCard
                index={0}
                label="Pengembalian Tercatat"
                value={totalReturned}
                icon={PackageCheck}
                tone="success"
                loading={charts.isLoading}
                hint="diterima petugas pada periode ini"
              />
              <StatCard
                index={1}
                label="Buku Paling Sering Dipinjam"
                value={topBook?.borrowCount ?? 0}
                icon={Flame}
                tone="violet"
                loading={charts.isLoading}
                hint={topBook ? topBook.title : 'belum ada peminjaman'}
              />
              <StatCard
                index={2}
                label="Kategori Tercakup"
                value={charts.data?.categories.length ?? 0}
                icon={Library}
                tone="cyan"
                loading={charts.isLoading}
                hint="kategori dalam koleksi"
              />
              <StatCard
                index={3}
                label="Rata-rata per Hari"
                value={perDay}
                icon={BarChart3}
                tone="electric"
                loading={charts.isLoading}
                hint="peminjaman rata-rata harian"
              />
            </div>
          </div>
        </section>

        {/* ---------- Charts ---------- */}
        <section className="grid gap-4 lg:grid-cols-3" aria-label="Visualisasi laporan">
          <div className="panel p-5 lg:col-span-2">
            <header className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-base font-semibold">Tren Transaksi</h2>
                <p className="text-xs text-muted-foreground">
                  Peminjaman dibandingkan pengembalian pada periode terpilih
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
            ) : trend.length === 0 ? (
              <EmptyState
                icon={BarChart3}
                title="Tidak ada transaksi pada periode ini"
                description="Perpanjang rentang tanggal atau pilih status lain untuk melihat aktivitas peminjaman."
                className="py-10"
              />
            ) : (
              <TrendChart data={trend} />
            )}
          </div>

          <div className="panel p-5">
            <header className="mb-4">
              <h2 className="font-display text-base font-semibold">Distribusi Kategori</h2>
              <p className="text-xs text-muted-foreground">Sebaran judul per kategori</p>
            </header>
            {charts.isLoading ? (
              <ChartSkeleton />
            ) : (charts.data?.categories.length ?? 0) === 0 ? (
              <EmptyState title="Belum ada kategori" className="py-10" />
            ) : (
              <CategoryChart data={charts.data?.categories ?? []} />
            )}
          </div>

          <div className="panel p-5 lg:col-span-3">
            <header className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-base font-semibold">
                  Buku Paling Sering Dipinjam
                </h2>
                <p className="text-xs text-muted-foreground">
                  Peringkat berdasarkan jumlah peminjaman pada periode {from} s/d {to}
                </p>
              </div>
              <Flame className="size-4 text-warning" aria-hidden />
            </header>
            {charts.isLoading ? (
              <ChartSkeleton />
            ) : charts.isError ? (
              <ErrorState
                title="Gagal memuat peringkat buku"
                message={charts.error?.message}
                onRetry={() => void charts.refetch()}
              />
            ) : (
              <TopBooksChart data={charts.data?.topBooks ?? []} />
            )}
          </div>
        </section>

        {/* ---------- Export centre ---------- */}
        <motion.section
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="panel overflow-hidden"
          aria-label="Pusat ekspor Excel"
        >
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
            <div>
              <p className="eyebrow">Unduh Data</p>
              <h2 className="font-display text-base font-semibold">Ekspor ke Excel</h2>
              <p className="text-xs text-muted-foreground">
                Berkas .xlsx dibangkitkan server dari database, bukan dari data yang sedang
                ditampilkan di layar.
              </p>
            </div>
            <Badge tone="neutral">
              <FileSpreadsheet className="size-3" aria-hidden />
              Format .xlsx
            </Badge>
          </header>

          <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3">
            {exports.map((spec) => {
              const Icon = spec.icon;
              const loading = busy === spec.key;
              const filteredExport = spec.key === 'loans';
              return (
                <motion.article
                  key={spec.key}
                  variants={itemVariants}
                  className="flex flex-col gap-3 rounded-xl border border-border bg-background/40 p-4"
                >
                  <div className="flex items-start gap-3">
                    <span
                      className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-electric-soft text-primary"
                      aria-hidden
                    >
                      <Icon className="size-[18px]" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="font-display text-sm font-semibold text-foreground">
                        {spec.label}
                      </h3>
                      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                        {spec.description}
                      </p>
                    </div>
                  </div>

                  <p className="text-2xs text-muted-foreground">{spec.hint}</p>

                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-auto w-full"
                    loading={loading}
                    disabled={busy !== null && !loading}
                    onClick={() => {
                      void runExport(spec);
                    }}
                  >
                    {!loading ? <Icon className="size-3.5" aria-hidden /> : null}
                    {loading ? 'Menyiapkan berkas...' : `Unduh ${spec.label}`}
                  </Button>

                  {filteredExport ? (
                    <p className="text-2xs text-muted-foreground">
                      Filter aktif: <span className="font-medium text-foreground">{activeStatusLabel}</span>
                      {' · '}
                      {from} s/d {to}
                    </p>
                  ) : null}
                </motion.article>
              );
            })}
          </div>
        </motion.section>

        {/* ---------- Import template ---------- */}
        <section className="panel overflow-hidden" aria-label="Template impor buku">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
            <div>
              <p className="eyebrow">Impor Koleksi</p>
              <h2 className="font-display text-base font-semibold">Template Impor Buku</h2>
              <p className="text-xs text-muted-foreground">
                Unduh berkas contoh, isi baris data, lalu unggah kembali melalui menu Kelola Buku.
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              loading={busy === 'template'}
              disabled={busy !== null && busy !== 'template'}
              onClick={() => {
                void downloadTemplate();
              }}
            >
              {busy === 'template' ? null : <FileSpreadsheet className="size-3.5" aria-hidden />}
              Unduh Template Impor
            </Button>
          </header>

          <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-sm">
                <caption className="sr-only">
                  Daftar kolom template impor buku beserta status wajib dan keterangan
                </caption>
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th
                      scope="col"
                      className="px-3 py-2.5 text-left text-2xs font-semibold uppercase tracking-wider text-muted-foreground"
                    >
                      Kolom
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2.5 text-left text-2xs font-semibold uppercase tracking-wider text-muted-foreground"
                    >
                      Status
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2.5 text-left text-2xs font-semibold uppercase tracking-wider text-muted-foreground"
                    >
                      Keterangan
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {TEMPLATE_COLUMNS.map((column) => (
                    <tr
                      key={column.name}
                      className="border-b border-border transition-colors last:border-0 hover:bg-muted/40"
                    >
                      <td className="whitespace-nowrap px-3 py-2.5 align-top font-medium text-foreground">
                        {column.name}
                      </td>
                      <td className="px-3 py-2.5 align-top">
                        {column.required ? (
                          <Badge tone="danger">Wajib</Badge>
                        ) : (
                          <Badge tone="neutral">Opsional</Badge>
                        )}
                      </td>
                      <td className="px-3 py-2.5 align-top text-xs text-muted-foreground">
                        {column.note}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <aside className="space-y-3">
              <div className="rounded-lg border border-warning/25 bg-warning-soft p-3.5">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-warning">
                  <Info className="size-3.5" aria-hidden />
                  Validasi dijalankan lebih dulu
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  Kolom wajib yang kosong atau nilainya tidak valid akan menolak baris tersebut
                  sebelum ada satu pun data yang tersimpan. Baris yang lolos pemeriksaan baru
                  ditulis ke database dalam satu transaksi.
                </p>
              </div>

              <div className="rounded-lg border border-border bg-background/40 p-3.5">
                <p className="text-xs font-semibold text-foreground">Nama kolom pada baris pertama</p>
                <p className="mt-1.5 break-words font-mono text-2xs leading-relaxed text-muted-foreground">
                  {TEMPLATE_HEADERS.join(' | ')}
                </p>
                <p className="mt-2 text-2xs leading-relaxed text-muted-foreground">
                  Jika salah satu kolom ini tidak ditemukan, seluruh berkas ditolak tanpa menyimpan
                  apa pun. Urutan kolom bebas, tetapi nama harus sama persis.
                </p>
              </div>
            </aside>
          </div>
        </section>
      </PageBody>
    </>
  );
}
