import * as React from 'react';
import {
  CheckCircle2,
  ClipboardCheck,
  RefreshCw,
  Search,
  TriangleAlert,
} from 'lucide-react';
import { PageBody, PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/badge';
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
import { useApiMutation, useBooks, useDebounced, useListParams, useOpnames } from '@/hooks/useApi';
import { cn, formatDateTime, formatNumber } from '@/lib/utils';
import type { Opname } from '@/types';

const STATUS_OPTIONS = [
  { value: 'all', label: 'Semua sesi' },
  { value: 'pending', label: 'Belum diterapkan' },
  { value: 'applied', label: 'Sudah diterapkan' },
] as const;

export default function AdminOpnamePage() {
  const defaults = React.useMemo(() => ({ status: 'pending' }), []);
  const { get, set, setMany, reset } = useListParams(defaults);

  const status = get('status', 'pending');
  const page = Number(get('page', '1')) || 1;
  const pageSize = Number(get('pageSize', '20')) || 20;

  const query = React.useMemo(() => ({ status, page, pageSize }), [status, page, pageSize]);
  const opnames = useOpnames(query);

  const items = opnames.data?.items ?? [];
  const meta = opnames.data?.meta;

  // --- New session form ---
  const [open, setOpen] = React.useState(false);
  const [bookTerm, setBookTerm] = React.useState('');
  const debouncedTerm = useDebounced(bookTerm, 300);
  const [selectedBook, setSelectedBook] = React.useState<{
    id: number;
    title: string;
    available: number;
    damaged: number;
  } | null>(null);
  const [counted, setCounted] = React.useState('');
  const [note, setNote] = React.useState('');

  const bookSearch = useBooks(
    { search: debouncedTerm || undefined, page: 1, pageSize: 6 },
    { enabled: debouncedTerm.length >= 2 },
  );

  const createOpname = useApiMutation<{ bookId: number; counted: number; note?: string }, Opname>({
    mutationFn: async (body) => (await api.post<Opname>('/opnames', body)).data,
    invalidate: [['opnames'], ['books'], ['dashboard']],
    onSuccess: () => {
      setOpen(false);
      setBookTerm('');
      setSelectedBook(null);
      setCounted('');
      setNote('');
    },
  });

  const applyOpname = useApiMutation<number, Opname>({
    mutationFn: async (id) => (await api.post<Opname>(`/opnames/${id}/apply`)).data,
    successMessage: 'Selisih opname diterapkan ke stok.',
    invalidate: [['opnames'], ['books'], ['dashboard'], ['activity']],
  });

  const expected = selectedBook ? selectedBook.available + selectedBook.damaged : 0;
  const countedNum = counted === '' ? null : Number(counted);
  const difference = countedNum === null ? null : countedNum - expected;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedBook || countedNum === null) return;
    createOpname.mutate({
      bookId: selectedBook.id,
      counted: countedNum,
      note: note.trim() || undefined,
    });
  };

  return (
    <>
      <PageHeader
        eyebrow="Inventaris"
        title="Stok Opname"
        description="Hitung fisik buku di rak, lalu bandingkan dengan catatan sistem. Selisih tidak langsung mengubah stok — petugas harus menyetujuinya lebih dulu, karena hitungan manual bisa keliru."
        breadcrumb={[{ label: 'Dasbor', to: '/admin' }, { label: 'Stok Opname' }]}
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => setOpen(true)}>
              <ClipboardCheck className="size-3.5" aria-hidden />
              Sesi baru
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void opnames.refetch()}
              loading={opnames.isFetching && !opnames.isLoading}
            >
              <RefreshCw className="size-3.5" aria-hidden />
              Perbarui
            </Button>
          </div>
        }
        meta={
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {opnames.isLoading
              ? 'Memuat sesi opname...'
              : `${formatNumber(meta?.total ?? 0)} sesi tercatat`}
          </p>
        }
      />

      <PageBody className="space-y-4">
        <div className="panel flex flex-wrap items-center gap-3 p-4">
          <Field label="Status" htmlFor="opname-status" className="w-52">
            <Select
              id="opname-status"
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
          <p className="max-w-xl text-xs text-muted-foreground sm:ml-auto">
            Hanya buku yang <strong>fisik di rak</strong> yang dihitung. Eksemplar yang sedang
            dipinjam tidak termasuk, karena memang tidak ada di perpustakaan saat dihitung.
          </p>
        </div>

        <section className="panel overflow-hidden" aria-label="Daftar sesi opname">
          {opnames.isLoading ? (
            <TableSkeleton rows={6} columns={6} />
          ) : opnames.isError ? (
            <ErrorState
              message={opnames.error instanceof Error ? opnames.error.message : undefined}
              onRetry={() => void opnames.refetch()}
            />
          ) : items.length === 0 ? (
            status !== 'pending' ? (
              <NoResultsState onReset={reset} />
            ) : (
              <EmptyState
                icon={ClipboardCheck}
                title="Belum ada sesi opname"
                description="Mulai sesi baru untuk menghitung fisik satu judul buku."
              />
            )
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-sm">
                <caption className="sr-only">Sesi stok opname beserta selisihnya</caption>
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left text-2xs uppercase tracking-wider text-muted-foreground">
                    <th scope="col" className="px-4 py-2.5 font-semibold">Buku</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-semibold">Sistem</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-semibold">Fisik</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-semibold">Selisih</th>
                    <th scope="col" className="px-4 py-2.5 font-semibold">Dicatat</th>
                    <th scope="col" className="px-4 py-2.5 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((o) => (
                    <tr key={o.id} className="border-b border-border/60 last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <p className="font-medium">{o.bookTitle}</p>
                        <p className="font-mono text-2xs text-muted-foreground">{o.isbn}</p>
                        {o.note ? (
                          <p className="mt-0.5 text-2xs text-muted-foreground">{o.note}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{o.expected}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">{o.counted}</td>
                      <td className="px-4 py-3 text-right">
                        <DifferenceBadge difference={o.difference} />
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        <p>{o.createdByName}</p>
                        <p>{formatDateTime(o.createdAt)}</p>
                      </td>
                      <td className="px-4 py-3">
                        {o.appliedAt ? (
                          <div className="space-y-1">
                            <Badge tone="success">
                              <CheckCircle2 className="size-3" aria-hidden />
                              Diterapkan
                            </Badge>
                            <p className="text-2xs text-muted-foreground">
                              {o.appliedByName} · {formatDateTime(o.appliedAt)}
                            </p>
                          </div>
                        ) : (
                          <ConfirmDialog>
                            <ConfirmTrigger asChild>
                              <Button size="sm" variant="outline">
                                Terapkan
                              </Button>
                            </ConfirmTrigger>
                            <ConfirmContent
                              title="Terapkan selisih ke stok?"
                              description={
                                o.difference === 0
                                  ? 'Hitungan fisik sama dengan catatan sistem. Menerapkan akan menandai sesi ini selesai tanpa mengubah angka.'
                                  : `Stok sistem akan disesuaikan: total eksemplar berubah ${o.difference > 0 ? '+' : ''}${o.difference}. Tindakan ini tercatat di log aktivitas.`
                              }
                              confirmLabel="Ya, terapkan"
                              onConfirm={async () => {
                                try {
                                  await applyOpname.mutateAsync(o.id);
                                } catch {
                                  // The toast already carries the server message.
                                }
                              }}
                            >
                              <p className="text-xs text-muted-foreground">
                                Selisih akan tercatat di log aktivitas dan tidak dapat dibatalkan.
                              </p>
                            </ConfirmContent>
                          </ConfirmDialog>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {meta && meta.totalPages > 1 ? (
            <div className="p-3">
              <Pagination
                page={meta.page}
                totalPages={meta.totalPages}
                total={meta.total}
                pageSize={meta.pageSize}
                onPageChange={(p) => set('page', p)}
              />
            </div>
          ) : null}
        </section>
      </PageBody>

      {/* ---------- New session ---------- */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          title="Sesi opname baru"
          description="Pilih buku, lalu masukkan jumlah eksemplar yang benar-benar ada di rak."
        >
          <form onSubmit={submit} className="space-y-3">
            <Field label="Buku" htmlFor="opname-book">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  id="opname-book"
                  type="search"
                  value={selectedBook ? selectedBook.title : bookTerm}
                  onChange={(e) => {
                    setSelectedBook(null);
                    setBookTerm(e.target.value);
                  }}
                  placeholder="Judul, penulis, atau ISBN..."
                  className="pl-9"
                  autoComplete="off"
                />
              </div>
            </Field>

            {!selectedBook && debouncedTerm.length >= 2 ? (
              <div className="max-h-44 overflow-y-auto rounded-lg border border-border">
                {bookSearch.isLoading ? (
                  <p className="p-3 text-xs text-muted-foreground">Mencari buku...</p>
                ) : (bookSearch.data?.items ?? []).length === 0 ? (
                  <p className="p-3 text-xs text-muted-foreground">Buku tidak ditemukan.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {(bookSearch.data?.items ?? []).map((b) => (
                      <li key={b.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedBook({
                              id: b.id,
                              title: b.title,
                              available: b.availableCopies,
                              damaged: b.damagedCopies,
                            });
                            setBookTerm('');
                            setCounted(String(b.availableCopies + b.damagedCopies));
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                        >
                          <span className="min-w-0 flex-1 truncate">{b.title}</span>
                          <span className="shrink-0 text-2xs text-muted-foreground">
                            {b.availableCopies + b.damagedCopies} di rak
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}

            {selectedBook ? (
              <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs">
                <p className="flex justify-between">
                  <span className="text-muted-foreground">Tersedia</span>
                  <span className="font-medium tabular-nums">{selectedBook.available}</span>
                </p>
                <p className="mt-1 flex justify-between">
                  <span className="text-muted-foreground">Rusak (masih di rak)</span>
                  <span className="font-medium tabular-nums">{selectedBook.damaged}</span>
                </p>
                <p className="mt-1 flex justify-between border-t border-border pt-1">
                  <span className="font-medium">Seharusnya ada</span>
                  <span className="font-semibold tabular-nums">{expected}</span>
                </p>
              </div>
            ) : null}

            <Field label="Jumlah fisik di rak" htmlFor="opname-counted" required>
              <Input
                id="opname-counted"
                type="number"
                min={0}
                value={counted}
                onChange={(e) => setCounted(e.target.value)}
                disabled={!selectedBook}
                required
              />
            </Field>

            {difference !== null && difference !== 0 ? (
              <p
                className={cn(
                  'flex items-start gap-2 rounded-lg border p-2.5 text-xs',
                  difference < 0
                    ? 'border-destructive/30 bg-destructive-soft text-destructive'
                    : 'border-warning/30 bg-warning-soft text-warning-foreground',
                )}
              >
                <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                <span>
                  {difference < 0
                    ? `${Math.abs(difference)} eksemplar tidak ditemukan. Setelah diterapkan, total stok akan berkurang.`
                    : `${difference} eksemplar lebih banyak dari catatan. Setelah diterapkan, total stok akan bertambah.`}
                </span>
              </p>
            ) : null}

            <Field label="Catatan" htmlFor="opname-note" hint="Opsional. Misalnya: rusak berat di gudang.">
              <Textarea
                id="opname-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                maxLength={255}
              />
            </Field>

            <div className="flex justify-end gap-2 pt-1">
              <DialogClose asChild>
                <Button type="button" variant="ghost">
                  Batal
                </Button>
              </DialogClose>
              <Button
                type="submit"
                loading={createOpname.isPending}
                disabled={!selectedBook || countedNum === null}
              >
                Simpan hitungan
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function DifferenceBadge({ difference }: { difference: number }) {
  if (difference === 0) return <Badge tone="success">Cocok</Badge>;
  if (difference > 0) return <Badge tone="warning">+{difference}</Badge>;
  return <Badge tone="danger">{difference}</Badge>;
}
