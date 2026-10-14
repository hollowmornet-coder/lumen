import * as React from 'react';
import { motion, useReducedMotion, type Variants } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  Ban,
  BookOpen,
  CalendarDays,
  ClipboardList,
  Handshake,
  Info,
  PackageCheck,
  RefreshCw,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageBody, PageHeader } from '@/components/layout/PageHeader';
import { MiniCover } from '@/components/ui/book-cover';
import { Badge, LoanStatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmContent, ConfirmDialog, ConfirmTrigger } from '@/components/ui/dialog';
import { Pagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState, NoResultsState } from '@/components/ui/states';
import { api } from '@/lib/api';
import { useApiMutation, useListParams, useMemberOverview, useMyLoans } from '@/hooks/useApi';
import { cn, formatDate, formatNumber, formatRupiah, relativeDays } from '@/lib/utils';
import { staggerContainer, staggerItem } from '@/lib/motion';
import type { Loan, LoanStatus } from '@/types';

/** Motion collapses to a static state when the OS asks for less movement. */
const STILL: Variants = { hidden: {}, show: {} };

/** Everything that can shift once a loan changes state. */
const INVALIDATE = [['my-loans'], ['loans'], ['dashboard'], ['books']] as const;

/**
 * "Aktif" means the member still has something to do about these loans:
 * a request waiting for a decision, a reserved copy waiting for pickup,
 * a book in hand, or a return waiting for the librarian.
 *
 * The server's own `status=active` filter deliberately excludes `pending`
 * (an unapproved request holds no copy), so the view is assembled here.
 */
const ACTIVE_STATUSES: readonly LoanStatus[] = [
  'pending',
  'approved',
  'borrowed',
  'return_requested',
];

const FILTERS = [
  { value: 'aktif', label: 'Semua aktif' },
  { value: 'pending', label: 'Menunggu persetujuan' },
  { value: 'approved', label: 'Siap diambil' },
  { value: 'borrowed', label: 'Sedang dipinjam' },
  { value: 'return_requested', label: 'Minta kembali' },
  { value: 'overdue', label: 'Terlambat' },
] as const;

function matchesFilter(loan: Loan, filter: string): boolean {
  if (filter === 'aktif') return ACTIVE_STATUSES.includes(loan.status);
  if (filter === 'overdue') return loan.displayStatus === 'overdue';
  return loan.status === filter;
}

interface Paged<T> {
  items: T[];
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
}

/** Client-side slice, so the merged "aktif" view paginates as one list. */
function paginate<T>(rows: T[], page: number, pageSize: number): Paged<T> {
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(1, page), totalPages);
  const start = (current - 1) * pageSize;
  return { items: rows.slice(start, start + pageSize), page: current, totalPages, total, pageSize };
}

function useLoanMutations() {
  const cancel = useApiMutation<number, Loan>({
    mutationFn: async (id) => (await api.post<Loan>(`/loans/${id}/cancel`)).data,
    successMessage: 'Pengajuan peminjaman dibatalkan.',
    invalidate: INVALIDATE,
  });

  const requestReturn = useApiMutation<number, Loan>({
    mutationFn: async (id) => (await api.post<Loan>(`/loans/${id}/return-request`)).data,
    successMessage: 'Permintaan pengembalian terkirim, menunggu verifikasi petugas.',
    invalidate: INVALIDATE,
  });

  return { cancel, requestReturn };
}

type LoanMutations = ReturnType<typeof useLoanMutations>;

export default function MyLoansPage() {
  const defaults = React.useMemo(() => ({ status: 'aktif' }), []);
  const { get, set, setMany, reset } = useListParams(defaults);

  const status = get('status', 'aktif');
  const page = Number(get('page', '1')) || 1;
  const pageSize = Number(get('pageSize', '12')) || 12;

  // The whole personal ledger in one request; filtering and paging happen
  // below so "aktif" can merge several server statuses into one list.
  const loans = useMyLoans({ status: 'all', sort: 'requested_at', direction: 'DESC', pageSize: 100 });
  const overview = useMemberOverview();
  const actions = useLoanMutations();

  const reduce = useReducedMotion();
  const containerVariants = reduce ? STILL : staggerContainer(0.035);
  const cardVariants = reduce ? STILL : staggerItem;

  const all = React.useMemo(() => loans.data?.items ?? [], [loans.data?.items]);
  const filtered = React.useMemo(
    () => all.filter((loan) => matchesFilter(loan, status)),
    [all, status],
  );
  const paged = paginate(filtered, page, pageSize);

  const hasFilters = status !== 'aktif';
  const allowSelfReturn = overview.data?.allowSelfReturn ?? false;
  const overdueCount = all.filter((loan) => loan.displayStatus === 'overdue').length;
  const activeLabel = FILTERS.find((f) => f.value === status)?.label ?? 'Semua aktif';

  const clearFilters = () => {
    reset();
  };

  return (
    <>
      <PageHeader
        eyebrow="Sirkulasi"
        title="Pinjaman Saya"
        description="Semua peminjaman yang masih berjalan: pengajuan menunggu, buku siap diambil, buku di tangan, dan permintaan pengembalian."
        breadcrumb={[
          { label: 'Beranda', to: '/perpustakaan' },
          { label: 'Pinjaman Saya' },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void loans.refetch();
                void overview.refetch();
              }}
              loading={loans.isFetching && !loans.isLoading}
            >
              <RefreshCw className="size-3.5" aria-hidden />
              Perbarui
            </Button>
            <Button asChild size="sm">
              <Link to="/katalog">
                <BookOpen className="size-3.5" aria-hidden />
                Ajukan Peminjaman
              </Link>
            </Button>
          </div>
        }
        meta={
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {loans.isLoading
              ? 'Memuat peminjaman...'
              : `${formatNumber(paged.total)} transaksi · ${activeLabel.toLowerCase()}${
                  overdueCount > 0 && !hasFilters
                    ? ` · ${formatNumber(overdueCount)} terlambat`
                    : ''
                }`}
          </p>
        }
      />

      <PageBody className="space-y-4">
        {/* ---------- Filter chips ---------- */}
        <div className="panel p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
              <ClipboardList className="size-3" aria-hidden />
              Tampilan
            </span>
            {FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => setMany({ status: filter.value, page: undefined })}
                aria-pressed={status === filter.value}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  status === filter.value
                    ? 'border-primary/30 bg-electric-soft text-primary'
                    : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                {filter.label}
              </button>
            ))}
            {hasFilters ? (
              <button
                type="button"
                onClick={clearFilters}
                className="rounded text-2xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Tampilkan semua
              </button>
            ) : null}
          </div>

          {overview.data && !overview.data.allowSelfReturn ? (
            <p className="mt-3 flex items-start gap-2 rounded-lg border border-border bg-background/40 p-3 text-xs leading-relaxed text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <span>
                Pengembalian mandiri sedang dinonaktifkan oleh petugas. Untuk buku yang sudah
                dipinjam, serahkan langsung ke loket perpustakaan.
              </span>
            </p>
          ) : null}
        </div>

        {/* ---------- Loan list ---------- */}
        <section className="panel overflow-hidden" aria-label="Daftar peminjaman aktif">
          {loans.isFetching && !loans.isLoading ? (
            <div className="h-0.5 overflow-hidden bg-border" aria-hidden>
              <div className="h-full w-1/3 animate-shimmer bg-primary" />
            </div>
          ) : null}

          {loans.isError ? (
            <ErrorState
              title="Gagal memuat peminjaman"
              message={loans.error?.message}
              onRetry={() => void loans.refetch()}
            />
          ) : loans.isLoading ? (
            <div className="space-y-3 p-4" role="status" aria-label="Memuat peminjaman">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-start gap-4 rounded-lg border border-border p-4">
                  <Skeleton className="size-14 shrink-0 rounded-md" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3 w-2/3" />
                    <Skeleton className="h-3 w-1/3" />
                    <Skeleton className="h-8 w-40" />
                  </div>
                </div>
              ))}
            </div>
          ) : paged.items.length === 0 ? (
            hasFilters ? (
              <NoResultsState
                onReset={clearFilters}
                description="Tidak ada peminjaman dengan tampilan ini. Coba lihat semua transaksi aktif."
              />
            ) : (
              <EmptyState
                icon={BookOpen}
                title="Tidak ada peminjaman aktif"
                description="Anda sedang tidak memegang buku. Pilih judul dari katalog untuk mengajukan peminjaman."
                action={
                  <Button asChild size="sm">
                    <Link to="/katalog">
                      Buka katalog
                      <ArrowRight className="size-3.5" aria-hidden />
                    </Link>
                  </Button>
                }
              />
            )
          ) : (
            <motion.ul
              key={`${status}-${paged.page}-${pageSize}`}
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="divide-y divide-border"
            >
              {paged.items.map((loan) => (
                <motion.li key={loan.id} variants={cardVariants}>
                  <ActiveLoanCard loan={loan} allowSelfReturn={allowSelfReturn} actions={actions} />
                </motion.li>
              ))}
            </motion.ul>
          )}

          {paged.total > 0 ? (
            <Pagination
              page={paged.page}
              totalPages={paged.totalPages}
              total={paged.total}
              pageSize={pageSize}
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

function ActiveLoanCard({
  loan,
  allowSelfReturn,
  actions,
}: {
  loan: Loan;
  allowSelfReturn: boolean;
  actions: LoanMutations;
}) {
  const overdue = loan.displayStatus === 'overdue';
  const daysLate = loan.daysLate ?? 0;
  const lateFee = loan.lateFee ?? 0;

  return (
    <article className="flex flex-col gap-4 px-5 py-4 transition-colors hover:bg-muted/40 lg:flex-row lg:items-start">
      <div className="flex min-w-0 flex-1 items-start gap-4">
        <MiniCover title={loan.book.title} author={loan.book.author} src={loan.book.coverPath} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <LoanStatusBadge status={loan.displayStatus} />
            <span className="font-mono text-2xs text-muted-foreground">{loan.loanCode}</span>
            {loan.quantity > 1 ? (
              <Badge tone="neutral">{loan.quantity} eksemplar</Badge>
            ) : null}
          </div>

          <h3 className="mt-1.5 font-display text-sm font-semibold text-foreground">
            {loan.book.title}
          </h3>
          <p className="text-xs text-muted-foreground">
            {loan.book.author}
            {loan.book.categoryName ? ` · ${loan.book.categoryName}` : ''}
          </p>

          <dl className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-2xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <CalendarDays className="size-3" aria-hidden />
              <dt className="sr-only">Tanggal pengajuan</dt>
              <dd>Diajukan {formatDate(loan.requestedAt)}</dd>
            </div>
            {loan.dueAt ? (
              <div className="flex items-center gap-1.5">
                <dt className="sr-only">Jatuh tempo</dt>
                <dd className={cn(overdue && 'font-semibold text-destructive')}>
                  Jatuh tempo {formatDate(loan.dueAt)} ({relativeDays(loan.dueAt)})
                </dd>
              </div>
            ) : null}
            {loan.returnRequestedAt ? (
              <div className="flex items-center gap-1.5">
                <dt className="sr-only">Tanggal permintaan pengembalian</dt>
                <dd>Diminta kembali {formatDate(loan.returnRequestedAt)}</dd>
              </div>
            ) : null}
          </dl>

          {overdue ? (
            <p className="mt-2.5 flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive-soft px-3 py-2 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span>
                Peminjaman ini terlambat {formatNumber(daysLate)} hari. Denda yang dihitung sistem:{' '}
                {lateFee > 0 ? formatRupiah(lateFee) : 'belum ada'}. Kembalikan secepatnya untuk
                menghindari denda tambahan.
              </span>
            </p>
          ) : null}
        </div>
      </div>

      <div className="shrink-0 lg:w-64 lg:text-right">
        <LoanActions loan={loan} allowSelfReturn={allowSelfReturn} actions={actions} />
      </div>
    </article>
  );
}

function LoanActions({
  loan,
  allowSelfReturn,
  actions,
}: {
  loan: Loan;
  allowSelfReturn: boolean;
  actions: LoanMutations;
}) {
  if (loan.status === 'pending') {
    return (
      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
        <ConfirmDialog>
          <ConfirmTrigger asChild>
            <Button size="sm" variant="outline" disabled={actions.cancel.isPending}>
              <Ban className="size-3.5" aria-hidden />
              Batalkan
            </Button>
          </ConfirmTrigger>
          <ConfirmContent
            title="Batalkan pengajuan?"
            tone="danger"
            confirmLabel="Ya, batalkan"
            cancelLabel="Kembali"
            onConfirm={async () => {
              try {
                await actions.cancel.mutateAsync(loan.id);
              } catch {
                // The toast already carries the server message.
              }
            }}
            description={
              <>
                Pengajuan <strong>{loan.book.title}</strong> akan dibatalkan dan tidak lagi
                menunggu persetujuan petugas.
              </>
            }
          >
            <p className="font-mono text-xs text-muted-foreground">Kode: {loan.loanCode}</p>
          </ConfirmContent>
        </ConfirmDialog>
      </div>
    );
  }

  if (loan.status === 'approved') {
    return (
      <p className="flex items-center justify-end gap-2 text-xs leading-relaxed text-muted-foreground">
        <Handshake className="size-3.5 shrink-0 text-primary" aria-hidden />
        <span>
          <span className="font-medium text-foreground">Tersedia di loket.</span> Silakan ambil di
          meja peminjaman pada jam layanan.
        </span>
      </p>
    );
  }

  if (loan.status === 'borrowed') {
    if (!allowSelfReturn) {
      return (
        <p className="flex items-center justify-end gap-2 text-xs leading-relaxed text-muted-foreground">
          <Info className="size-3.5 shrink-0" aria-hidden />
          <span>
            Pengembalian mandiri dinonaktifkan. Serahkan buku ini kepada petugas perpustakaan di
            loket.
          </span>
        </p>
      );
    }

    return (
      <ConfirmDialog>
        <ConfirmTrigger asChild>
          <Button size="sm" variant="primary" disabled={actions.requestReturn.isPending}>
            <PackageCheck className="size-3.5" aria-hidden />
            Ajukan Pengembalian
          </Button>
        </ConfirmTrigger>
        <ConfirmContent
          title="Ajukan pengembalian buku?"
          tone="primary"
          confirmLabel="Ya, ajukan"
          cancelLabel="Batal"
          onConfirm={async () => {
            try {
              await actions.requestReturn.mutateAsync(loan.id);
            } catch {
              // The toast already carries the server message.
            }
          }}
          description={
            <>
              Buku <strong>{loan.book.title}</strong> akan ditandai sebagai permintaan
              pengembalian. Petugas tetap harus memverifikasi buku secara fisik sebelum transaksi
              ditutup.
            </>
          }
        >
          <p className="font-mono text-xs text-muted-foreground">Kode: {loan.loanCode}</p>
        </ConfirmContent>
      </ConfirmDialog>
    );
  }

  if (loan.status === 'return_requested') {
    return (
      <p className="flex items-center justify-end gap-2 text-xs leading-relaxed text-muted-foreground">
        <PackageCheck className="size-3.5 shrink-0 text-secondary" aria-hidden />
        <span>
          <span className="font-medium text-foreground">Menunggu verifikasi petugas.</span>{' '}
          Bawa buku ini ke loket, transaksi selesai setelah petugas menerimanya.
        </span>
      </p>
    );
  }

  return <span className="text-2xs text-muted-foreground">Tidak ada tindakan</span>;
}
