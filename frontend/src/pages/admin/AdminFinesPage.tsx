import * as React from 'react';
import { motion, useReducedMotion, type Variants } from 'framer-motion';
import { toast } from 'sonner';
import {
  BadgeCheck,
  CircleSlash,
  Download,
  HandCoins,
  RefreshCw,
  Search,
  Wallet,
  X,
} from 'lucide-react';
import { PageBody, PageHeader } from '@/components/layout/PageHeader';
import { Badge, FineKindBadge, FineStatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmContent, ConfirmDialog, ConfirmTrigger, Dialog, DialogClose, DialogContent } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { TableSkeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState, NoResultsState } from '@/components/ui/states';
import { api, downloadFile } from '@/lib/api';
import { useApiMutation, useDebounced, useFines, useListParams } from '@/hooks/useApi';
import { cn, formatDate, formatNumber, formatRupiah } from '@/lib/utils';
import { staggerContainer, staggerItem } from '@/lib/motion';
import type { Fine } from '@/types';

const STILL: Variants = { hidden: {}, show: {} };

const STATUS_OPTIONS = [
  { value: 'all', label: 'Semua status' },
  { value: 'unpaid', label: 'Belum lunas' },
  { value: 'paid', label: 'Lunas' },
  { value: 'waived', label: 'Dibebaskan' },
] as const;

const KIND_OPTIONS = [
  { value: 'all', label: 'Semua jenis' },
  { value: 'late', label: 'Keterlambatan' },
  { value: 'damaged', label: 'Kerusakan' },
  { value: 'lost', label: 'Kehilangan' },
] as const;

const INVALIDATE = [
  ['fines'],
  ['my-fines'],
  ['dashboard'],
  ['loans'],
  ['members'],
  ['activity'],
] as const;

export default function AdminFinesPage() {
  const defaults = React.useMemo(() => ({ status: 'unpaid' }), []);
  const { get, set, setMany, reset } = useListParams(defaults);

  const [term, setTerm] = React.useState(() => get('search'));
  const debounced = useDebounced(term, 350);

  const status = get('status', 'unpaid');
  const kind = get('kind', 'all');
  const from = get('from');
  const to = get('to');
  const page = Number(get('page', '1')) || 1;
  const pageSize = Number(get('pageSize', '20')) || 20;

  const query = React.useMemo(
    () => ({
      search: debounced || undefined,
      status,
      kind,
      from: from || undefined,
      to: to || undefined,
      page,
      pageSize,
    }),
    [debounced, status, kind, from, to, page, pageSize],
  );

  const fines = useFines(query, 'admin');
  const reduce = useReducedMotion();
  const containerVariants = reduce ? STILL : staggerContainer(0.03);
  const rowVariants = reduce ? STILL : staggerItem;

  const items = fines.data?.items ?? [];
  const meta = fines.data?.meta;
  const summary = fines.data?.summary;
  const hasFilters =
    Boolean(debounced) || status !== 'unpaid' || kind !== 'all' || Boolean(from) || Boolean(to);

  const [exporting, setExporting] = React.useState(false);

  const exportFines = async () => {
    setExporting(true);
    try {
      await downloadFile(
        '/excel/export/fines',
        { search: debounced || undefined, status, kind, from: from || undefined, to: to || undefined },
        'lumen-denda.xlsx',
      );
      toast.success('Laporan denda diunduh.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal mengunduh laporan.');
    } finally {
      setExporting(false);
    }
  };

  const clearFilters = () => {
    setTerm('');
    reset();
  };

  return (
    <>
      <PageHeader
        eyebrow="Keuangan"
        title="Denda Perpustakaan"
        description="Tagihan yang tercatat saat buku dikembalikan terlambat, rusak, atau hilang. Denda disimpan sebagai data, bukan dihitung ulang setiap kali halaman dibuka."
        breadcrumb={[
          { label: 'Dasbor', to: '/admin' },
          { label: 'Denda' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void exportFines()}
              loading={exporting}
            >
              <Download className="size-3.5" aria-hidden />
              Ekspor Excel
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void fines.refetch()}
              loading={fines.isFetching && !fines.isLoading}
            >
              <RefreshCw className="size-3.5" aria-hidden />
              Perbarui
            </Button>
          </div>
        }
        meta={
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {fines.isLoading
              ? 'Memuat denda...'
              : `${formatNumber(meta?.total ?? 0)} tagihan · total belum lunas ${formatRupiah(summary?.unpaidTotal ?? 0)}`}
          </p>
        }
      />

      <PageBody className="space-y-4">
        {/* ---------- Summary ---------- */}
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Ringkasan denda">
          <SummaryTile
            label="Belum lunas"
            value={formatRupiah(summary?.unpaidTotal ?? 0)}
            hint={`${formatNumber(summary?.unpaidCount ?? 0)} tagihan terbuka`}
            tone="danger"
            icon={Wallet}
            loading={fines.isLoading}
          />
          <SummaryTile
            label="Sudah dibayar"
            value={formatRupiah(summary?.paidTotal ?? 0)}
            hint="total penerimaan tercatat"
            tone="success"
            icon={HandCoins}
            loading={fines.isLoading}
          />
          <SummaryTile
            label="Dibebaskan"
            value={formatRupiah(summary?.waivedTotal ?? 0)}
            hint="dihapus oleh petugas"
            tone="neutral"
            icon={CircleSlash}
            loading={fines.isLoading}
          />
          <SummaryTile
            label="Tagihan tampil"
            value={formatNumber(meta?.total ?? 0)}
            hint="sesuai filter aktif"
            tone="electric"
            icon={BadgeCheck}
            loading={fines.isLoading}
          />
        </section>

        {/* ---------- Filters ---------- */}
        <div className="panel p-4">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-end">
            <Field label="Cari denda" htmlFor="fine-search">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  id="fine-search"
                  type="search"
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  placeholder="Nama anggota, kode transaksi, atau judul buku..."
                  className="pl-9"
                />
                {term ? (
                  <button
                    type="button"
                    onClick={() => setTerm('')}
                    aria-label="Bersihkan pencarian"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <X className="size-3.5" aria-hidden />
                  </button>
                ) : null}
              </div>
            </Field>

            <Field label="Status" htmlFor="fine-status" className="md:w-44">
              <Select
                id="fine-status"
                value={status}
                onChange={(e) => setMany({ status: e.target.value, page: undefined })}
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Jenis" htmlFor="fine-kind" className="md:w-44">
              <Select
                id="fine-kind"
                value={kind}
                onChange={(e) => setMany({ kind: e.target.value, page: undefined })}
              >
                {KIND_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {/* Period filter: the monthly cash question ("how much came in this
              month?") needs a date range, not just a status. */}
          <div className="mt-3 grid gap-3 sm:grid-cols-[auto_1fr_1fr_auto] sm:items-end">
            <span className="hidden text-2xs font-semibold uppercase tracking-wider text-muted-foreground sm:block sm:pb-2.5">
              Periode
            </span>
            <Field label="Dari tanggal" htmlFor="fine-from">
              <Input
                id="fine-from"
                type="date"
                value={from}
                max={to || undefined}
                onChange={(e) => setMany({ from: e.target.value, page: undefined })}
              />
            </Field>
            <Field label="Sampai tanggal" htmlFor="fine-to">
              <Input
                id="fine-to"
                type="date"
                value={to}
                min={from || undefined}
                onChange={(e) => setMany({ to: e.target.value, page: undefined })}
              />
            </Field>
            <Button
              variant="ghost"
              size="sm"
              disabled={!from && !to}
              onClick={() => setMany({ from: undefined, to: undefined, page: undefined })}
              className="sm:mb-0.5"
            >
              Bersihkan periode
            </Button>
          </div>

          {hasFilters ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                Filter aktif
              </span>
              {debounced ? <Badge tone="info">Kata kunci: {debounced}</Badge> : null}
              {status !== 'unpaid' ? (
                <Badge tone="violet">
                  {STATUS_OPTIONS.find((o) => o.value === status)?.label}
                </Badge>
              ) : null}
              {kind !== 'all' ? (
                <Badge tone="warning">{KIND_OPTIONS.find((o) => o.value === kind)?.label}</Badge>
              ) : null}
              {from || to ? (
                <Badge tone="success">
                  Periode: {from || 'awal'} – {to || 'sekarang'}
                </Badge>
              ) : null}
              <button
                type="button"
                onClick={clearFilters}
                className="rounded text-2xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Atur ulang
              </button>
            </div>
          ) : null}
        </div>

        {/* ---------- Table ---------- */}
        <section className="panel overflow-hidden" aria-label="Daftar denda">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-sm">
              <caption className="sr-only">
                Daftar denda beserta anggota, jenis, jumlah, dan status pembayaran
              </caption>
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  {['Anggota', 'Buku', 'Jenis', 'Jumlah', 'Status', 'Aksi'].map((h, i) => (
                    <th
                      key={h}
                      scope="col"
                      className={cn(
                        'px-4 py-3 text-2xs font-semibold uppercase tracking-wider text-muted-foreground',
                        i === 5 ? 'text-right' : 'text-left',
                      )}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>

              {fines.isLoading ? (
                <tbody>
                  <tr>
                    <td colSpan={6} className="px-4 py-4">
                      <TableSkeleton rows={5} columns={4} />
                    </td>
                  </tr>
                </tbody>
              ) : fines.isError ? (
                <tbody>
                  <tr>
                    <td colSpan={6}>
                      <ErrorState
                        title="Gagal memuat denda"
                        message={fines.error?.message}
                        onRetry={() => void fines.refetch()}
                      />
                    </td>
                  </tr>
                </tbody>
              ) : items.length === 0 ? (
                <tbody>
                  <tr>
                    <td colSpan={6}>
                      {hasFilters ? (
                        <NoResultsState
                          onReset={clearFilters}
                          description="Tidak ada denda yang cocok dengan filter ini."
                        />
                      ) : (
                        <EmptyState
                          icon={HandCoins}
                          title="Tidak ada denda"
                          description="Denda hanya tercatat bila buku dikembalikan terlambat, rusak, atau hilang."
                        />
                      )}
                    </td>
                  </tr>
                </tbody>
              ) : (
                <motion.tbody
                  key={`${status}-${kind}-${page}-${pageSize}-${debounced}`}
                  variants={containerVariants}
                  initial="hidden"
                  animate="show"
                >
                  {items.map((fine) => (
                    <motion.tr
                      key={fine.id}
                      variants={rowVariants}
                      className="border-b border-border transition-colors last:border-0 hover:bg-muted/40"
                    >
                      <td className="px-4 py-3 align-top">
                        <p className="truncate text-sm font-medium text-foreground">
                          {fine.member.fullName}
                        </p>
                        <p className="truncate font-mono text-2xs text-muted-foreground">
                          {fine.member.memberCode ?? '-'}
                        </p>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <p className="max-w-[16rem] truncate text-sm text-foreground">
                          {fine.book.title}
                        </p>
                        <p className="truncate font-mono text-2xs text-muted-foreground">
                          {fine.loanCode}
                        </p>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <FineKindBadge kind={fine.kind} />
                        {fine.note ? (
                          <p className="mt-1 max-w-[14rem] text-2xs leading-relaxed text-muted-foreground">
                            {fine.note}
                          </p>
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 align-top">
                        <p className="font-display text-sm font-semibold tabular-nums text-foreground">
                          {formatRupiah(fine.amount)}
                        </p>
                        <p className="text-2xs text-muted-foreground">
                          {formatDate(fine.createdAt)}
                        </p>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <FineStatusBadge status={fine.status} />
                        {fine.settledAt ? (
                          <p className="mt-1 text-2xs text-muted-foreground">
                            {formatDate(fine.settledAt)}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-right align-top">
                        <SettleActions fine={fine} />
                      </td>
                    </motion.tr>
                  ))}
                </motion.tbody>
              )}
            </table>
          </div>

          {meta && items.length > 0 ? (
            <Pagination
              page={meta.page}
              totalPages={meta.totalPages}
              total={meta.total}
              pageSize={meta.pageSize}
              onPageChange={(p) => {
                set('page', p);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onPageSizeChange={(s) => setMany({ pageSize: s, page: undefined })}
            />
          ) : null}
        </section>
      </PageBody>
    </>
  );
}

/* ------------------------------------------------------------------ */

function SummaryTile({
  label,
  value,
  hint,
  tone,
  icon: Icon,
  loading,
}: {
  label: string;
  value: string;
  hint: string;
  tone: 'danger' | 'success' | 'neutral' | 'electric';
  icon: React.ComponentType<{ className?: string }>;
  loading: boolean;
}) {
  const tones = {
    danger: 'bg-destructive-soft text-destructive',
    success: 'bg-success-soft text-success',
    neutral: 'bg-muted text-muted-foreground',
    electric: 'bg-electric-soft text-primary',
  } as const;

  return (
    <div className="panel p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
          {loading ? (
            <div className="mt-2 h-7 w-24 rounded skeleton" aria-label="Memuat" />
          ) : (
            <p className="mt-1.5 font-display text-xl font-semibold tabular-nums text-foreground">
              {value}
            </p>
          )}
          <p className="mt-1 truncate text-2xs text-muted-foreground">{hint}</p>
        </div>
        <span
          className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', tones[tone])}
          aria-hidden
        >
          <Icon className="size-[18px]" />
        </span>
      </div>
    </div>
  );
}

function SettleActions({ fine }: { fine: Fine }) {
  const [open, setOpen] = React.useState(false);
  const [note, setNote] = React.useState('');

  const settle = useApiMutation<{ action: 'pay' | 'waive'; note?: string }, Fine>({
    mutationFn: async (body) => (await api.post<Fine>(`/fines/${fine.id}/settle`, body)).data,
    successMessage: (_data, vars) =>
      vars.action === 'pay' ? 'Pembayaran denda dicatat.' : 'Denda dibebaskan.',
    invalidate: INVALIDATE,
    onSuccess: () => {
      setOpen(false);
      setNote('');
    },
  });

  if (fine.status !== 'unpaid') {
    return <span className="text-2xs text-muted-foreground">Selesai</span>;
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      <ConfirmDialog>
        <ConfirmTrigger asChild>
          <Button size="sm" variant="success" disabled={settle.isPending}>
            <HandCoins className="size-3.5" aria-hidden />
            Terima bayar
          </Button>
        </ConfirmTrigger>
        <ConfirmContent
          title="Terima pembayaran denda?"
          tone="primary"
          confirmLabel="Ya, sudah dibayar"
          cancelLabel="Batal"
          onConfirm={async () => {
            try {
              await settle.mutateAsync({ action: 'pay' });
            } catch {
              // The toast carries the server message.
            }
          }}
          description={
            <>
              Denda <strong>{formatRupiah(fine.amount)}</strong> untuk{' '}
              <strong>{fine.member.fullName}</strong> akan ditandai lunas. Pastikan uang sudah
              diterima sebelum menekan tombol ini.
            </>
          }
        >
          <p className="font-mono text-xs text-muted-foreground">{fine.loanCode}</p>
        </ConfirmContent>
      </ConfirmDialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          <CircleSlash className="size-3.5" aria-hidden />
          Bebaskan
        </Button>

        <DialogContent
          title="Bebaskan denda"
          description={`Denda ${formatRupiah(fine.amount)} untuk ${fine.member.fullName} akan dihapus tanpa pembayaran.`}
          size="sm"
          footer={
            <>
              <DialogClose asChild>
                <Button variant="outline" disabled={settle.isPending}>
                  Batal
                </Button>
              </DialogClose>
              <Button
                variant="danger"
                loading={settle.isPending}
                onClick={() => {
                  void settle.mutateAsync({ action: 'waive', note: note.trim() || undefined });
                }}
              >
                Bebaskan denda
              </Button>
            </>
          }
        >
          <Field
            label="Alasan pembebasan"
            htmlFor="waive-note"
            hint="Tersimpan pada catatan denda untuk pertanggungjawaban."
          >
            <Textarea
              id="waive-note"
              rows={3}
              maxLength={255}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Contoh: buku rusak akibat banjir, bukan kelalaian siswa."
            />
          </Field>
        </DialogContent>
      </Dialog>
    </div>
  );
}
