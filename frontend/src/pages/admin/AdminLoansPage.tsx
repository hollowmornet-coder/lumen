import * as React from 'react';
import { motion, useReducedMotion, type Variants } from 'framer-motion';
import {
  ArrowUpDown,
  Ban,
  BookOpen,
  Check,
  Handshake,
  PackageCheck,
  RefreshCw,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { PageBody, PageHeader } from '@/components/layout/PageHeader';
import { MiniCover } from '@/components/ui/book-cover';
import { Badge, LoanStatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ConfirmContent,
  ConfirmDialog,
  ConfirmTrigger,
  Dialog,
  DialogClose,
  DialogContent,
} from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { TableSkeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState, NoResultsState } from '@/components/ui/states';
import { api } from '@/lib/api';
import { useApiMutation, useDebounced, useListParams, useLoans } from '@/hooks/useApi';
import { cn, formatDate, formatNumber, formatRupiah, relativeDays } from '@/lib/utils';
import { staggerContainer, staggerItem } from '@/lib/motion';
import type { Loan } from '@/types';

/** Motion collapses to a static state when the OS asks for less movement. */
const STILL: Variants = { hidden: {}, show: {} };

/** Mirrors the `status` enum accepted by GET /api/loans. */
const STATUS_OPTIONS = [
  { value: 'all', label: 'Semua status' },
  { value: 'pending', label: 'Menunggu persetujuan' },
  { value: 'approved', label: 'Disetujui, siap diserahkan' },
  { value: 'borrowed', label: 'Sedang dipinjam' },
  { value: 'return_requested', label: 'Permintaan pengembalian' },
  { value: 'overdue', label: 'Terlambat' },
  { value: 'active', label: 'Aktif' },
  { value: 'returned', label: 'Selesai' },
  { value: 'rejected', label: 'Ditolak' },
  { value: 'cancelled', label: 'Dibatalkan' },
] as const;

/** Mirrors the `sort` enum accepted by GET /api/loans. */
const SORT_FIELDS = [
  { value: 'requested_at', label: 'Tanggal pengajuan' },
  { value: 'due_at', label: 'Jatuh tempo' },
  { value: 'returned_at', label: 'Tanggal pengembalian' },
  { value: 'title', label: 'Judul buku' },
  { value: 'full_name', label: 'Nama anggota' },
  { value: 'status', label: 'Status transaksi' },
] as const;

const CONDITIONS = [
  { value: 'good', label: 'Baik', hint: 'Buku utuh dan dapat langsung dikembalikan ke rak.' },
  { value: 'damaged', label: 'Rusak', hint: 'Ada kerusakan fisik. Catatan rinci wajib diisi.' },
  { value: 'lost', label: 'Hilang', hint: 'Buku tidak ditemukan. Catatan rinci wajib diisi.' },
] as const;

type ReturnCondition = (typeof CONDITIONS)[number]['value'];

/** Everything that can shift once a loan changes state. */
const INVALIDATE = [['loans'], ['dashboard'], ['books'], ['activity']] as const;

interface RejectVars {
  id: number;
  reason: string;
}

interface ReturnVars {
  id: number;
  condition: ReturnCondition;
  note: string;
}

function useLoanMutations() {
  const approve = useApiMutation<number, Loan>({
    mutationFn: async (id) => (await api.post<Loan>(`/loans/${id}/approve`)).data,
    successMessage: 'Peminjaman disetujui. Satu eksemplar telah dicadangkan.',
    invalidate: INVALIDATE,
  });

  const reject = useApiMutation<RejectVars, Loan>({
    mutationFn: async ({ id, reason }) =>
      (await api.post<Loan>(`/loans/${id}/reject`, { reason })).data,
    successMessage: 'Permohonan peminjaman ditolak.',
    invalidate: INVALIDATE,
  });

  const confirmReturn = useApiMutation<ReturnVars, Loan>({
    mutationFn: async ({ id, condition, note }) =>
      (
        await api.post<Loan>(`/loans/${id}/return-confirm`, {
          condition,
          note: note.trim() || undefined,
        })
      ).data,
    successMessage: 'Pengembalian berhasil dicatat.',
    invalidate: INVALIDATE,
  });

  return { approve, reject, confirmReturn };
}

type LoanMutations = ReturnType<typeof useLoanMutations>;

export default function AdminLoansPage() {
  const defaults = React.useMemo(() => ({}), []);
  const { params, get, set, setMany, reset } = useListParams(defaults);

  const [term, setTerm] = React.useState(() => get('search'));
  const debouncedTerm = useDebounced(term, 350);

  const status = get('status', 'all');
  const sort = get('sort', 'requested_at');
  const direction = get('direction', 'DESC');
  const page = Number(get('page', '1')) || 1;
  const pageSize = Number(get('pageSize', '12')) || 12;

  // Mirror the debounced box into the address bar, but only when it differs,
  // so the effect can never fight itself into a loop.
  React.useEffect(() => {
    if ((params.get('search') ?? '') === debouncedTerm) return;
    setMany({ search: debouncedTerm || undefined, page: undefined });
  }, [debouncedTerm, params, setMany]);

  const query = React.useMemo(
    () => ({
      search: debouncedTerm || undefined,
      status,
      sort,
      direction,
      page,
      pageSize,
    }),
    [debouncedTerm, status, sort, direction, page, pageSize],
  );

  const loans = useLoans(query);
  const mutations = useLoanMutations();

  const reduce = useReducedMotion();
  const containerVariants = reduce ? STILL : staggerContainer(0.035);
  const rowVariants = reduce ? STILL : staggerItem;

  const items = loans.data?.items ?? [];
  const meta = loans.data?.meta;
  const hasFilters = Boolean(debouncedTerm) || status !== 'all';

  const clearFilters = () => {
    setTerm('');
    reset();
  };

  const toggleDirection = () => set('direction', direction === 'ASC' ? 'DESC' : 'ASC');
  const activeStatusLabel =
    STATUS_OPTIONS.find((o) => o.value === status)?.label ?? 'Semua status';

  return (
    <>
      <PageHeader
        eyebrow="Sirkulasi"
        title="Transaksi Peminjaman"
        description="Kelola alur peminjaman dan pengembalian: persetujuan, penyerahan buku, serta penerimaan kembali dengan verifikasi kondisi."
        breadcrumb={[
          { label: 'Dasbor', to: '/admin' },
          { label: 'Transaksi' },
        ]}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loans.refetch()}
            loading={loans.isFetching && !loans.isLoading}
          >
            <RefreshCw className="size-3.5" aria-hidden />
            Perbarui
          </Button>
        }
        meta={
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {loans.isLoading
              ? 'Memuat transaksi...'
              : `${formatNumber(meta?.total ?? 0)} transaksi tercatat`}
            {meta && meta.total > 0 ? (
              <>
                {' · halaman '}
                <span className="font-medium text-foreground">{meta.page}</span> dari{' '}
                <span className="font-medium text-foreground">{meta.totalPages}</span>
              </>
            ) : null}
          </p>
        }
      />

      <PageBody className="space-y-4">
        {/* ---------- Filter bar ---------- */}
        <div className="panel p-4">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto_auto] md:items-end">
            <Field label="Cari transaksi" htmlFor="loan-search">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  id="loan-search"
                  type="search"
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  placeholder="Cari kode transaksi, judul buku, atau nama anggota..."
                  className="pl-9"
                />
                {term ? (
                  <button
                    type="button"
                    onClick={() => setTerm('')}
                    aria-label="Bersihkan pencarian"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <X className="size-3.5" aria-hidden />
                  </button>
                ) : null}
              </div>
            </Field>

            <Field label="Status" htmlFor="loan-status" className="md:w-56">
              <Select
                id="loan-status"
                value={status}
                onChange={(e) => setMany({ status: e.target.value, page: undefined })}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Urutkan" htmlFor="loan-sort" className="md:w-52">
              <Select
                id="loan-sort"
                value={sort}
                onChange={(e) => setMany({ sort: e.target.value, page: undefined })}
              >
                {SORT_FIELDS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="flex items-end pb-0.5">
              <Button
                variant="outline"
                size="md"
                onClick={toggleDirection}
                aria-label={`Urutkan ${direction === 'ASC' ? 'menaik' : 'menurun'}`}
                className="w-full md:w-auto"
              >
                <ArrowUpDown className="size-4" aria-hidden />
                {direction === 'ASC' ? 'Naik' : 'Turun'}
              </Button>
            </div>
          </div>

          {hasFilters ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                <SlidersHorizontal className="size-3" aria-hidden />
                Filter aktif
              </span>
              {debouncedTerm ? (
                <Badge tone="info">
                  Kata kunci: {debouncedTerm}
                </Badge>
              ) : null}
              {status !== 'all' ? <Badge tone="violet">{activeStatusLabel}</Badge> : null}
              <button
                type="button"
                onClick={clearFilters}
                className="rounded text-2xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Atur ulang semua
              </button>
            </div>
          ) : null}
        </div>

        {/* ---------- Table ---------- */}
        <section className="panel overflow-hidden" aria-label="Daftar transaksi peminjaman">
          {loans.isFetching && !loans.isLoading ? (
            <div
              className="pointer-events-none h-0.5 overflow-hidden bg-border"
              aria-hidden
            >
              <div className="h-full w-1/3 animate-shimmer bg-primary" />
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] border-collapse text-sm">
              <caption className="sr-only">
                Transaksi peminjaman beserta status, jatuh tempo, dan tindakan petugas
              </caption>
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th
                    scope="col"
                    className="px-4 py-3 text-left text-2xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    Kode transaksi
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left text-2xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    Judul buku
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left text-2xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    Anggota
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left text-2xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    Status
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left text-2xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    Jatuh tempo
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-right text-2xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    Aksi
                  </th>
                </tr>
              </thead>

              {loans.isLoading ? (
                <tbody>
                  <tr>
                    <td colSpan={6} className="px-4 py-4">
                      <TableSkeleton rows={6} columns={4} />
                    </td>
                  </tr>
                </tbody>
              ) : loans.isError ? (
                <tbody>
                  <tr>
                    <td colSpan={6}>
                      <ErrorState
                        title="Gagal memuat transaksi"
                        message={loans.error?.message}
                        onRetry={() => void loans.refetch()}
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
                          description="Tidak ada transaksi yang cocok dengan status atau kata kunci pencarian."
                        />
                      ) : (
                        <EmptyState
                          icon={BookOpen}
                          title="Belum ada transaksi"
                          description="Permohonan peminjaman dari anggota akan muncul di sini untuk diproses petugas."
                        />
                      )}
                    </td>
                  </tr>
                </tbody>
              ) : (
                <motion.tbody
                  key={`${status}-${sort}-${direction}-${page}-${pageSize}-${debouncedTerm}`}
                  variants={containerVariants}
                  initial="hidden"
                  animate="show"
                >
                  {items.map((loan) => (
                    <motion.tr
                      key={loan.id}
                      variants={rowVariants}
                      className="border-b border-border transition-colors last:border-0 hover:bg-muted/40"
                    >
                      <td className="whitespace-nowrap px-4 py-3 align-top">
                        <span className="block font-mono text-xs font-semibold text-foreground">
                          {loan.loanCode}
                        </span>
                        <span className="mt-0.5 block text-2xs text-muted-foreground">
                          {formatDate(loan.requestedAt)}
                        </span>
                        {loan.quantity > 1 ? (
                          <span className="mt-1 block text-2xs text-muted-foreground">
                            {loan.quantity} eksemplar
                          </span>
                        ) : null}
                      </td>

                      <td className="px-4 py-3 align-top">
                        <div className="flex items-start gap-3">
                          <MiniCover
                            title={loan.book.title}
                            author={loan.book.author}
                            src={loan.book.coverPath}
                          />
                          <div className="min-w-0 max-w-[18rem]">
                            <p className="truncate font-display text-sm font-semibold text-foreground">
                              {loan.book.title}
                            </p>
                            <p className="truncate text-2xs text-muted-foreground">
                              {loan.book.author}
                            </p>
                            {loan.book.categoryName ? (
                              <p className="mt-1 truncate text-2xs text-muted-foreground/80">
                                {loan.book.categoryName}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3 align-top">
                        <p className="truncate text-sm font-medium text-foreground">
                          {loan.member.fullName}
                        </p>
                        <p className="truncate font-mono text-2xs text-muted-foreground">
                          {loan.member.memberCode ?? loan.member.username}
                        </p>
                      </td>

                      <td className="px-4 py-3 align-top">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <LoanStatusBadge status={loan.displayStatus} />
                          {loan.daysLate !== null && loan.daysLate > 0 ? (
                            <Badge tone="danger">
                              {formatNumber(loan.daysLate)} hari telat
                            </Badge>
                          ) : null}
                          {loan.lateFee !== null && loan.lateFee > 0 ? (
                            <Badge tone="warning">Denda {formatRupiah(loan.lateFee)}</Badge>
                          ) : null}
                        </div>
                        {loan.rejectedReason ? (
                          <p className="mt-1.5 max-w-[16rem] text-2xs leading-relaxed text-muted-foreground">
                            Alasan: {loan.rejectedReason}
                          </p>
                        ) : null}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 align-top">
                        {loan.dueAt ? (
                          <>
                            <p className="text-sm text-foreground">{formatDate(loan.dueAt)}</p>
                            <p
                              className={cn(
                                'mt-0.5 text-2xs',
                                relativeDays(loan.dueAt).startsWith('terlambat')
                                  ? 'font-semibold text-destructive'
                                  : 'text-muted-foreground',
                              )}
                            >
                              {relativeDays(loan.dueAt)}
                            </p>
                          </>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right align-top">
                        <LoanActions loan={loan} actions={mutations} />
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

function LoanActions({ loan, actions }: { loan: Loan; actions: LoanMutations }) {
  if (loan.status === 'pending') {
    return (
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        <ConfirmDialog>
          <ConfirmTrigger asChild>
            <Button size="sm" variant="success" disabled={actions.approve.isPending}>
              <Check className="size-3.5" aria-hidden />
              Setujui
            </Button>
          </ConfirmTrigger>
          <ConfirmContent
            title="Setujui peminjaman?"
            tone="primary"
            confirmLabel="Ya, setujui"
            cancelLabel="Batal"
            onConfirm={async () => {
              try {
                await actions.approve.mutateAsync(loan.id);
              } catch {
                // The toast already carries the server message.
              }
            }}
            description={
              <>
                Satu eksemplar <strong>{loan.book.title}</strong> akan dicadangkan untuk{' '}
                <strong>{loan.member.fullName}</strong>. Buku tetap harus diserahkan lewat tombol
                &ldquo;Serahkan&rdquo;.
              </>
            }
          >
            <p className="font-mono text-xs text-muted-foreground">Kode: {loan.loanCode}</p>
          </ConfirmContent>
        </ConfirmDialog>

        <RejectDialog loan={loan} actions={actions} />
      </div>
    );
  }

  if (loan.status === 'approved') {
    return (
      <ConfirmDialog>
        <ConfirmTrigger asChild>
          <Button size="sm" variant="primary" disabled={actions.approve.isPending}>
            <Handshake className="size-3.5" aria-hidden />
            Serahkan
          </Button>
        </ConfirmTrigger>
        <ConfirmContent
          title="Serahkan buku kepada peminjam?"
          tone="primary"
          confirmLabel="Ya, diserahkan"
          cancelLabel="Batal"
          onConfirm={async () => {
            try {
              await actions.approve.mutateAsync(loan.id);
            } catch {
              // The toast already carries the server message.
            }
          }}
          description={
            <>
              Tandai buku <strong>{loan.book.title}</strong> sudah fisik diterima oleh{' '}
              <strong>{loan.member.fullName}</strong>. Jatuh tempo dihitung sejak hari ini.
            </>
          }
        >
          <p className="font-mono text-xs text-muted-foreground">Kode: {loan.loanCode}</p>
        </ConfirmContent>
      </ConfirmDialog>
    );
  }

  if (loan.status === 'borrowed' || loan.status === 'return_requested') {
    return (
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        <ReturnDialog loan={loan} actions={actions} />
      </div>
    );
  }

  return (
    <span className="text-2xs text-muted-foreground">Tidak ada tindakan</span>
  );
}

function RejectDialog({ loan, actions }: { loan: Loan; actions: LoanMutations }) {
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState('');
  const [error, setError] = React.useState<string | undefined>(undefined);
  const reject = actions.reject;
  const fieldId = `reject-reason-${loan.id}`;

  const submit = async () => {
    const trimmed = reason.trim();
    if (trimmed.length < 3) {
      setError('Alasan penolakan minimal 3 karakter.');
      return;
    }
    setError(undefined);
    try {
      await reject.mutateAsync({ id: loan.id, reason: trimmed });
      setOpen(false);
      setReason('');
    } catch {
      // The toast already carries the server message; keep the dialog open so
      // the reason the officer typed is not lost.
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Ban className="size-3.5" aria-hidden />
        Tolak
      </Button>

      <DialogContent
        title="Tolak peminjaman"
        description={`Permohonan ${loan.loanCode} akan ditolak dan alasannya dapat dibaca anggota.`}
        size="sm"
        footer={
          <>
            <DialogClose asChild>
              <Button variant="outline" disabled={reject.isPending}>Batal</Button>
            </DialogClose>
            <Button
              variant="danger"
              loading={reject.isPending}
              onClick={() => {
                void submit();
              }}
            >
              Tolak peminjaman
            </Button>
          </>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <Field
            label="Alasan penolakan"
            htmlFor={fieldId}
            required
            error={error}
            hint="Contoh: stok tidak tersedia atau buku sedang dalam perbaikan."
          >
            <Textarea
              id={fieldId}
              rows={3}
              maxLength={255}
              value={reason}
              placeholder="Tuliskan alasan singkat..."
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${fieldId}-error` : `${fieldId}-hint`}
              onChange={(e) => {
                setReason(e.target.value);
                if (error) setError(undefined);
              }}
            />
          </Field>
          <button type="submit" className="sr-only">
            Tolak peminjaman
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ReturnDialog({ loan, actions }: { loan: Loan; actions: LoanMutations }) {
  const [open, setOpen] = React.useState(false);
  const [condition, setCondition] = React.useState<ReturnCondition>('good');
  const [note, setNote] = React.useState('');
  const [error, setError] = React.useState<string | undefined>(undefined);
  const confirm = actions.confirmReturn;
  const conditionId = `return-condition-${loan.id}`;
  const noteId = `return-note-${loan.id}`;

  const noteRequired = condition !== 'good';
  const current = CONDITIONS.find((c) => c.value === condition) ?? CONDITIONS[0];

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setCondition('good');
      setNote('');
      setError(undefined);
    }
  };

  const submit = async () => {
    if (noteRequired && note.trim().length < 3) {
      setError('Catatan wajib diisi minimal 3 karakter untuk kondisi rusak atau hilang.');
      return;
    }
    setError(undefined);
    try {
      await confirm.mutateAsync({ id: loan.id, condition, note: note.trim() });
      handleOpenChange(false);
    } catch {
      // Keep the dialog open so the officer can correct and retry.
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
        <PackageCheck className="size-3.5" aria-hidden />
        Terima Kembali
      </Button>

      <DialogContent
        title="Terima pengembalian"
        description={`Verifikasi fisik buku ${loan.book.title} dari ${loan.member.fullName}.`}
        size="sm"
        footer={
          <>
            <DialogClose asChild>
              <Button variant="outline" disabled={confirm.isPending}>Batal</Button>
            </DialogClose>
            <Button
              variant="success"
              loading={confirm.isPending}
              onClick={() => {
                void submit();
              }}
            >
              <PackageCheck className="size-4" aria-hidden />
              Simpan pengembalian
            </Button>
          </>
        }
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <Field label="Kondisi buku" htmlFor={conditionId} required hint={current.hint}>
            <Select
              id={conditionId}
              value={condition}
              onChange={(e) => {
                setCondition(e.target.value as ReturnCondition);
                setError(undefined);
              }}
              aria-describedby={`${conditionId}-hint`}
            >
              {CONDITIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Catatan verifikasi"
            htmlFor={noteId}
            required={noteRequired}
            error={error}
            hint={
              noteRequired
                ? 'Jelaskan kerusakan atau kronologi kehilangan (maksimal 255 karakter).'
                : 'Opsional. Catatan tersimpan pada riwayat peminjaman.'
            }
          >
            <Textarea
              id={noteId}
              rows={3}
              maxLength={255}
              value={note}
              placeholder={noteRequired ? 'Wajib diisi...' : 'Opsional...'}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${noteId}-error` : `${noteId}-hint`}
              onChange={(e) => {
                setNote(e.target.value);
                if (error) setError(undefined);
              }}
            />
          </Field>

          {loan.daysLate !== null && loan.daysLate > 0 ? (
            <p className="rounded-lg border border-warning/25 bg-warning-soft px-3 py-2 text-xs text-warning">
              Buku tercatat terlambat {formatNumber(loan.daysLate)} hari. Denda yang dihitung
              sistem: {formatRupiah(loan.lateFee ?? 0)}.
            </p>
          ) : null}

          <button type="submit" className="sr-only">
            Simpan pengembalian
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}