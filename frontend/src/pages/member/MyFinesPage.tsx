import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, CircleSlash, HandCoins, Info, RefreshCw, Wallet } from 'lucide-react';
import { PageBody, PageHeader } from '@/components/layout/PageHeader';
import { MiniCover } from '@/components/ui/book-cover';
import { Badge, FineKindBadge, FineStatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { useFines, useMemberOverview } from '@/hooks/useApi';
import { formatDate, formatNumber, formatRupiah } from '@/lib/utils';
import { staggerContainer, staggerItem } from '@/lib/motion';

/**
 * Member-facing fine ledger.
 *
 * The member can see exactly what is owed and why, but cannot settle it: money
 * changes hands at the desk, and letting a client mark its own bill paid would
 * make the ledger worthless.
 */
export default function MyFinesPage() {
  const fines = useFines({ pageSize: 50 }, 'mine');
  const overview = useMemberOverview();

  const items = fines.data?.items ?? [];
  const summary = fines.data?.summary;
  const unpaid = items.filter((f) => f.status === 'unpaid');
  const settled = items.filter((f) => f.status !== 'unpaid');

  return (
    <>
      <PageHeader
        eyebrow="Keuangan"
        title="Denda Saya"
        description="Tagihan yang timbul dari keterlambatan, kerusakan, atau kehilangan buku. Pembayaran dilakukan langsung di meja petugas."
        breadcrumb={[
          { label: 'Beranda', to: '/perpustakaan' },
          { label: 'Denda Saya' },
        ]}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void fines.refetch();
              void overview.refetch();
            }}
            loading={fines.isFetching && !fines.isLoading}
          >
            <RefreshCw className="size-3.5" aria-hidden />
            Perbarui
          </Button>
        }
        meta={
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {fines.isLoading
              ? 'Memuat denda...'
              : summary && summary.unpaidTotal > 0
                ? `Total belum lunas ${formatRupiah(summary.unpaidTotal)} dari ${formatNumber(summary.unpaidCount)} tagihan`
                : 'Tidak ada denda yang menunggu pembayaran'}
          </p>
        }
      />

      <PageBody className="space-y-4">
        {/* ---------- Status banner ---------- */}
        {summary && summary.unpaidTotal > 0 ? (
          <div className="panel flex items-start gap-3 border-warning/30 bg-warning-soft/50 p-4">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">
                Denda belum lunas: {formatRupiah(summary.unpaidTotal)}
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                Selama denda belum dilunasi, peminjaman baru tidak dapat diproses. Datang ke meja
                perpustakaan untuk membayar.
              </p>
            </div>
          </div>
        ) : (
          <div className="panel flex items-start gap-3 border-success/25 bg-success-soft/40 p-4">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">Tidak ada tanggungan</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Semua denda Anda sudah selesai. Terima kasih sudah mengembalikan buku tepat waktu.
              </p>
            </div>
          </div>
        )}

        {/* ---------- Summary ---------- */}
        <div className="grid gap-3 sm:grid-cols-3">
          <MiniTile
            label="Belum lunas"
            value={formatRupiah(summary?.unpaidTotal ?? 0)}
            hint={`${formatNumber(summary?.unpaidCount ?? 0)} tagihan`}
            tone="danger"
            icon={Wallet}
          />
          <MiniTile
            label="Sudah dibayar"
            value={formatRupiah(summary?.paidTotal ?? 0)}
            hint="riwayat pembayaran Anda"
            tone="success"
            icon={HandCoins}
          />
          <MiniTile
            label="Dibebaskan"
            value={formatRupiah(summary?.waivedTotal ?? 0)}
            hint="dihapus oleh petugas"
            tone="neutral"
            icon={CircleSlash}
          />
        </div>

        {fines.isError ? (
          <div className="panel">
            <ErrorState
              title="Gagal memuat denda"
              message={fines.error?.message}
              onRetry={() => void fines.refetch()}
            />
          </div>
        ) : fines.isLoading ? (
          <div className="panel space-y-3 p-4" role="status" aria-label="Memuat denda">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-start gap-4 rounded-lg border border-border p-4">
                <Skeleton className="h-14 w-10 shrink-0 rounded-md" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="panel">
            <EmptyState
              icon={HandCoins}
              title="Belum ada denda"
              description="Denda hanya muncul bila buku dikembalikan melewati jatuh tempo atau dalam kondisi rusak."
            />
          </div>
        ) : (
          <div className="space-y-4">
            {unpaid.length > 0 ? (
              <section className="panel overflow-hidden" aria-label="Denda belum lunas">
                <header className="border-b border-border px-5 py-3">
                  <h2 className="font-display text-sm font-semibold">Belum lunas</h2>
                  <p className="text-xs text-muted-foreground">
                    Bayar di meja petugas, lalu statusnya diperbarui di sini.
                  </p>
                </header>
                <motion.ul
                  variants={staggerContainer(0.04)}
                  initial="hidden"
                  animate="show"
                  className="divide-y divide-border"
                >
                  {unpaid.map((fine) => (
                    <motion.li key={fine.id} variants={staggerItem}>
                      <FineRow fine={fine} />
                    </motion.li>
                  ))}
                </motion.ul>
              </section>
            ) : null}

            {settled.length > 0 ? (
              <section className="panel overflow-hidden" aria-label="Riwayat denda selesai">
                <header className="border-b border-border px-5 py-3">
                  <h2 className="font-display text-sm font-semibold">Sudah selesai</h2>
                  <p className="text-xs text-muted-foreground">
                    Denda yang sudah dibayar atau dibebaskan petugas.
                  </p>
                </header>
                <motion.ul
                  variants={staggerContainer(0.04)}
                  initial="hidden"
                  animate="show"
                  className="divide-y divide-border"
                >
                  {settled.map((fine) => (
                    <motion.li key={fine.id} variants={staggerItem}>
                      <FineRow fine={fine} />
                    </motion.li>
                  ))}
                </motion.ul>
              </section>
            ) : null}
          </div>
        )}

        <p className="flex items-start gap-2 rounded-lg border border-border bg-background/40 p-3 text-xs leading-relaxed text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            Denda dihitung otomatis saat buku diterima petugas dan disimpan permanen. Perubahan
            tarif di kemudian hari tidak mengubah tagihan yang sudah tercatat.
          </span>
        </p>
      </PageBody>
    </>
  );
}

/* ------------------------------------------------------------------ */

function FineRow({
  fine,
}: {
  fine: {
    id: number;
    kind: string;
    amount: number;
    status: string;
    note: string | null;
    createdAt: string;
    settledAt: string | null;
    loanCode: string;
    book: { id: number; title: string };
  };
}) {
  return (
    <article className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start">
      <MiniCover title={fine.book.title} author="" src={null} />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <FineKindBadge kind={fine.kind} />
          <FineStatusBadge status={fine.status} />
          <span className="font-mono text-2xs text-muted-foreground">{fine.loanCode}</span>
        </div>
        <h3 className="mt-1.5 font-display text-sm font-semibold text-foreground">
          {fine.book.title}
        </h3>
        {fine.note ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{fine.note}</p>
        ) : null}
        <p className="mt-1 text-2xs text-muted-foreground">
          Tercatat {formatDate(fine.createdAt)}
          {fine.settledAt ? ` · diselesaikan ${formatDate(fine.settledAt)}` : ''}
        </p>
      </div>

      <div className="shrink-0 sm:text-right">
        <p className="font-display text-lg font-semibold tabular-nums text-foreground">
          {formatRupiah(fine.amount)}
        </p>
        {fine.status === 'unpaid' ? (
          <Badge tone="danger" className="mt-1">
            Bayar di loket
          </Badge>
        ) : null}
      </div>
    </article>
  );
}

function MiniTile({
  label,
  value,
  hint,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint: string;
  tone: 'danger' | 'success' | 'neutral';
  icon: React.ComponentType<{ className?: string }>;
}) {
  const tones = {
    danger: 'bg-destructive-soft text-destructive',
    success: 'bg-success-soft text-success',
    neutral: 'bg-muted text-muted-foreground',
  } as const;

  return (
    <div className="panel flex items-start justify-between gap-3 p-4">
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="mt-1 font-display text-lg font-semibold tabular-nums text-foreground">
          {value}
        </p>
        <p className="mt-0.5 text-2xs text-muted-foreground">{hint}</p>
      </div>
      <span
        className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${tones[tone]}`}
        aria-hidden
      >
        <Icon className="size-[18px]" />
      </span>
    </div>
  );
}
