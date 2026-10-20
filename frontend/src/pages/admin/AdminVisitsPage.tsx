import * as React from 'react';
import {
  CalendarDays,
  DoorOpen,
  RefreshCw,
  Search,
  UserRound,
  Users,
} from 'lucide-react';
import { PageBody, PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { TableSkeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState, NoResultsState } from '@/components/ui/states';
import { useApiMutation, useDebounced, useListParams, useMembers, useVisits, useVisitSummary } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { formatDateTime, formatNumber } from '@/lib/utils';
import type { VisitPurpose } from '@/types';

const PURPOSE_OPTIONS: Array<{ value: VisitPurpose; label: string }> = [
  { value: 'read', label: 'Membaca' },
  { value: 'borrow', label: 'Meminjam' },
  { value: 'return', label: 'Mengembalikan' },
  { value: 'study', label: 'Belajar' },
  { value: 'other', label: 'Lainnya' },
];

const PURPOSE_LABEL: Record<string, string> = Object.fromEntries(
  PURPOSE_OPTIONS.map((o) => [o.value, o.label]),
);

/** Local calendar date, so "today" matches the librarian's wall clock. */
function todayIso(): string {
  const now = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

export default function AdminVisitsPage() {
  const defaults = React.useMemo(() => ({ from: todayIso(), to: todayIso() }), []);
  const { get, set, setMany, reset } = useListParams(defaults);

  const from = get('from');
  const to = get('to');
  const page = Number(get('page', '1')) || 1;
  const pageSize = Number(get('pageSize', '20')) || 20;

  const query = React.useMemo(
    () => ({ from: from || undefined, to: to || undefined, page, pageSize }),
    [from, to, page, pageSize],
  );

  const visits = useVisits(query);
  const summary = useVisitSummary();

  const items = visits.data?.items ?? [];
  const meta = visits.data?.meta;

  // --- Check-in form ---
  const [memberTerm, setMemberTerm] = React.useState('');
  const debouncedTerm = useDebounced(memberTerm, 300);
  const [selectedMember, setSelectedMember] = React.useState<{ id: number; fullName: string } | null>(null);
  const [purpose, setPurpose] = React.useState<VisitPurpose>('read');
  const [guestName, setGuestName] = React.useState('');

  const memberSearch = useMembers(
    { search: debouncedTerm || undefined, page: 1, pageSize: 6, role: 'user', status: 'active' },
    { enabled: debouncedTerm.length >= 2 },
  );

  const checkIn = useApiMutation<
    { userId?: number; guestName?: string; purpose: VisitPurpose },
    unknown
  >({
    mutationFn: (body) => api.post('/visits', body),
    invalidate: [['visits']],
    onSuccess: () => {
      setMemberTerm('');
      setSelectedMember(null);
      setGuestName('');
      setPurpose('read');
    },
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (selectedMember) {
      checkIn.mutate({ userId: selectedMember.id, purpose });
      return;
    }
    if (guestName.trim().length >= 2) {
      checkIn.mutate({ guestName: guestName.trim(), purpose });
    }
  };

  const canSubmit = Boolean(selectedMember) || guestName.trim().length >= 2;

  return (
    <>
      <PageHeader
        eyebrow="Layanan"
        title="Kunjungan Perpustakaan"
        description="Catat siapa yang datang hari ini. Satu anggota dihitung sekali per hari walau kartunya dipindai berulang kali, sehingga angka kunjungan tidak bisa digelembungkan."
        breadcrumb={[{ label: 'Dasbor', to: '/admin' }, { label: 'Kunjungan' }]}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => void visits.refetch()}
            loading={visits.isFetching && !visits.isLoading}
          >
            <RefreshCw className="size-3.5" aria-hidden />
            Perbarui
          </Button>
        }
        meta={
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {visits.isLoading
              ? 'Memuat kunjungan...'
              : `${formatNumber(meta?.total ?? 0)} kunjungan pada periode ini`}
          </p>
        }
      />

      <PageBody className="space-y-4">
        {/* ---------- Today at a glance ---------- */}
        <section className="grid gap-3 sm:grid-cols-3" aria-label="Ringkasan kunjungan">
          <StatTile
            label="Kunjungan hari ini"
            value={formatNumber(summary.data?.today ?? 0)}
            hint="termasuk tamu tanpa kartu"
            icon={DoorOpen}
          />
          <StatTile
            label="Anggota unik hari ini"
            value={formatNumber(summary.data?.uniqueToday ?? 0)}
            hint="satu orang dihitung sekali"
            icon={Users}
          />
          <StatTile
            label="Bulan ini"
            value={formatNumber(summary.data?.thisMonth ?? 0)}
            hint="akumulasi bulan berjalan"
            icon={CalendarDays}
          />
        </section>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
          {/* ---------- Check-in ---------- */}
          <section className="panel h-fit p-4" aria-labelledby="visit-form-title">
            <h2 id="visit-form-title" className="font-display text-base font-semibold">
              Catat kunjungan
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Cari anggota, atau isi nama tamu bila tidak membawa kartu.
            </p>

            <form onSubmit={submit} className="mt-4 space-y-3">
              <Field label="Anggota" htmlFor="visit-member">
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                  <Input
                    id="visit-member"
                    type="search"
                    value={selectedMember ? selectedMember.fullName : memberTerm}
                    onChange={(e) => {
                      setSelectedMember(null);
                      setMemberTerm(e.target.value);
                    }}
                    placeholder="Nama, username, atau kode anggota..."
                    className="pl-9"
                    autoComplete="off"
                  />
                </div>
              </Field>

              {!selectedMember && debouncedTerm.length >= 2 ? (
                <div className="max-h-48 overflow-y-auto rounded-lg border border-border">
                  {memberSearch.isLoading ? (
                    <p className="p-3 text-xs text-muted-foreground">Mencari anggota...</p>
                  ) : (memberSearch.data?.items ?? []).length === 0 ? (
                    <p className="p-3 text-xs text-muted-foreground">
                      Anggota tidak ditemukan. Isi nama tamu di bawah bila bukan anggota.
                    </p>
                  ) : (
                    <ul className="divide-y divide-border">
                      {(memberSearch.data?.items ?? []).map((m) => (
                        <li key={m.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedMember({ id: m.id, fullName: m.fullName });
                              setMemberTerm('');
                            }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                          >
                            <UserRound className="size-3.5 text-muted-foreground" aria-hidden />
                            <span className="min-w-0 flex-1 truncate">{m.fullName}</span>
                            <span className="shrink-0 text-2xs text-muted-foreground">
                              {m.className ?? m.memberCode ?? '-'}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : null}

              {!selectedMember ? (
                <Field label="Atau nama tamu" htmlFor="visit-guest" hint="Untuk pengunjung non-anggota.">
                  <Input
                    id="visit-guest"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="Nama pengunjung"
                    maxLength={100}
                  />
                </Field>
              ) : null}

              <Field label="Keperluan" htmlFor="visit-purpose">
                <Select
                  id="visit-purpose"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value as VisitPurpose)}
                >
                  {PURPOSE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </Field>

              <Button type="submit" className="w-full" loading={checkIn.isPending} disabled={!canSubmit}>
                <DoorOpen className="size-4" aria-hidden />
                Catat kunjungan
              </Button>
            </form>
          </section>

          {/* ---------- Log ---------- */}
          <section className="panel overflow-hidden" aria-label="Daftar kunjungan">
            <div className="grid gap-3 border-b border-border p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <Field label="Dari" htmlFor="visit-from">
                <Input
                  id="visit-from"
                  type="date"
                  value={from}
                  max={to || undefined}
                  onChange={(e) => setMany({ from: e.target.value, page: undefined })}
                />
              </Field>
              <Field label="Sampai" htmlFor="visit-to">
                <Input
                  id="visit-to"
                  type="date"
                  value={to}
                  min={from || undefined}
                  onChange={(e) => setMany({ to: e.target.value, page: undefined })}
                />
              </Field>
              <Button variant="ghost" size="sm" onClick={reset} className="sm:mb-0.5">
                Hari ini
              </Button>
            </div>

            {visits.isLoading ? (
              <TableSkeleton rows={6} columns={4} />
            ) : visits.isError ? (
              <ErrorState
                message={visits.error instanceof Error ? visits.error.message : undefined}
                onRetry={() => void visits.refetch()}
              />
            ) : items.length === 0 ? (
              from || to ? (
                <NoResultsState onReset={reset} />
              ) : (
                <EmptyState
                  icon={DoorOpen}
                  title="Belum ada kunjungan"
                  description="Kunjungan yang dicatat akan muncul di sini."
                />
              )
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] border-collapse text-sm">
                  <caption className="sr-only">Daftar kunjungan perpustakaan</caption>
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-left text-2xs uppercase tracking-wider text-muted-foreground">
                      <th scope="col" className="px-4 py-2.5 font-semibold">Waktu</th>
                      <th scope="col" className="px-4 py-2.5 font-semibold">Pengunjung</th>
                      <th scope="col" className="px-4 py-2.5 font-semibold">Kelas</th>
                      <th scope="col" className="px-4 py-2.5 font-semibold">Keperluan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((v) => (
                      <tr key={v.id} className="border-b border-border/60 last:border-0 hover:bg-muted/30">
                        <td className="whitespace-nowrap px-4 py-2.5 text-xs text-muted-foreground">
                          {formatDateTime(v.createdAt)}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="font-medium">{v.memberName}</span>
                          {v.guestName ? (
                            <Badge tone="neutral" className="ml-2">
                              Tamu
                            </Badge>
                          ) : null}
                          {v.memberCode ? (
                            <span className="ml-2 font-mono text-2xs text-muted-foreground">
                              {v.memberCode}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">{v.className ?? '-'}</td>
                        <td className="px-4 py-2.5">
                          <Badge tone="info">{PURPOSE_LABEL[v.purpose] ?? v.purpose}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {meta && meta.totalPages > 1 ? (
              <div className="border-t border-border p-3">
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
        </div>
      </PageBody>
    </>
  );
}

function StatTile({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="panel flex items-start gap-3 p-4">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-electric-soft text-primary">
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="font-display text-xl font-semibold tabular-nums">{value}</p>
        <p className="text-2xs text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}
