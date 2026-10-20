import * as React from 'react';
import { CalendarDays, CalendarOff, Plus, Trash2 } from 'lucide-react';
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
import { Field, Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { api } from '@/lib/api';
import { useApiMutation, useHolidays } from '@/hooks/useApi';
import { cn, formatDate } from '@/lib/utils';
import type { Holiday } from '@/types';

const MONTHS = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

/** Day-of-week in Indonesian, computed locally. */
function dayName(iso: string): string {
  const names = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const date = new Date(`${iso}T00:00:00`);
  return names[date.getDay()] ?? '';
}

function isSunday(iso: string): boolean {
  return new Date(`${iso}T00:00:00`).getDay() === 0;
}

export default function AdminHolidaysPage() {
  const thisYear = new Date().getFullYear();
  const [year, setYear] = React.useState(thisYear);
  const holidays = useHolidays(year);

  const [open, setOpen] = React.useState(false);
  const [date, setDate] = React.useState('');
  const [name, setName] = React.useState('');

  const create = useApiMutation<{ date: string; name: string }, Holiday>({
    mutationFn: async (body) => (await api.post<Holiday>('/holidays', body)).data,
    successMessage: 'Hari libur ditambahkan.',
    invalidate: [['holidays']],
    onSuccess: () => {
      setOpen(false);
      setDate('');
      setName('');
    },
  });

  const remove = useApiMutation<number, unknown>({
    mutationFn: async (id) => (await api.delete(`/holidays/${id}`)).data,
    successMessage: 'Hari libur dihapus.',
    invalidate: [['holidays']],
  });

  const items = React.useMemo(
    () => [...(holidays.data ?? [])].sort((a, b) => a.date.localeCompare(b.date)),
    [holidays.data],
  );

  const byMonth = React.useMemo(() => {
    const groups = new Map<number, Holiday[]>();
    for (const holiday of items) {
      const month = Number(holiday.date.slice(5, 7)) - 1;
      const list = groups.get(month) ?? [];
      list.push(holiday);
      groups.set(month, list);
    }
    return Array.from(groups.entries()).sort((a, b) => a[0] - b[0]);
  }, [items]);

  const years = [thisYear - 1, thisYear, thisYear + 1];

  return (
    <>
      <PageHeader
        eyebrow="Kalender"
        title="Hari Libur"
        description="Tanggal di daftar ini tidak dihitung sebagai hari keterlambatan. Bila jatuh tempo sebuah peminjaman mengenai hari libur atau hari Minggu, tenggatnya digeser otomatis ke hari kerja berikutnya."
        breadcrumb={[{ label: 'Dasbor', to: '/admin' }, { label: 'Hari Libur' }]}
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => setOpen(true)}>
              <Plus className="size-3.5" aria-hidden />
              Tambah tanggal
            </Button>
          </div>
        }
        meta={
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {holidays.isLoading
              ? 'Memuat kalender...'
              : `${items.length} hari libur tercatat pada ${year}`}
          </p>
        }
      />

      <PageBody className="space-y-4">
        <div className="panel flex flex-wrap items-center gap-2 p-4">
          <span className="text-xs font-medium text-muted-foreground">Tahun</span>
          <div className="flex items-center gap-1">
            {years.map((y) => (
              <Button
                key={y}
                size="sm"
                variant={y === year ? 'primary' : 'outline'}
                onClick={() => setYear(y)}
              >
                {y}
              </Button>
            ))}
          </div>
          <p className="max-w-lg text-xs text-muted-foreground sm:ml-auto">
            Hari Minggu selalu digeser walau tidak ada di daftar ini. Sabtu tetap dihitung sebagai
            hari kerja, sesuai jam operasional sekolah.
          </p>
        </div>

        {holidays.isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : holidays.isError ? (
          <ErrorState
            message={holidays.error instanceof Error ? holidays.error.message : undefined}
            onRetry={() => void holidays.refetch()}
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon={CalendarOff}
            title={`Belum ada hari libur pada ${year}`}
            description="Tambahkan tanggal libur nasional atau libur sekolah agar jatuh tempo tidak jatuh pada hari yang mustahil."
            action={
              <Button size="sm" onClick={() => setOpen(true)}>
                <Plus className="size-3.5" aria-hidden />
                Tambah tanggal
              </Button>
            }
          />
        ) : (
          <div className="space-y-4">
            {byMonth.map(([month, list]) => (
              <section key={month} className="panel overflow-hidden" aria-label={MONTHS[month]}>
                <header className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-2">
                  <CalendarDays className="size-3.5 text-muted-foreground" aria-hidden />
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {MONTHS[month]}
                  </h2>
                  <Badge tone="neutral" className="ml-auto">
                    {list.length} hari
                  </Badge>
                </header>

                <ul className="divide-y divide-border">
                  {list.map((holiday) => (
                    <li
                      key={holiday.id}
                      className="flex flex-wrap items-center gap-3 px-4 py-2.5"
                    >
                      <span className="w-24 shrink-0 font-mono text-xs text-muted-foreground">
                        {formatDate(holiday.date)}
                      </span>
                      <span className="min-w-0 flex-1 text-sm font-medium">{holiday.name}</span>
                      <span
                        className={cn(
                          'shrink-0 text-2xs',
                          isSunday(holiday.date) ? 'text-warning' : 'text-muted-foreground',
                        )}
                      >
                        {dayName(holiday.date)}
                      </span>

                      <ConfirmDialog>
                        <ConfirmTrigger asChild>
                          <Button size="icon-sm" variant="ghost" aria-label="Hapus hari libur">
                            <Trash2 className="size-3.5" aria-hidden />
                          </Button>
                        </ConfirmTrigger>
                        <ConfirmContent
                          title="Hapus hari libur?"
                          description={
                            <>
                              <strong>{holiday.name}</strong> ({formatDate(holiday.date)}) akan
                              dihapus. Jatuh tempo yang sudah terlanjur dibuat tidak berubah —
                              hanya perhitungan berikutnya yang terpengaruh.
                            </>
                          }
                          confirmLabel="Ya, hapus"
                          onConfirm={async () => {
                            try {
                              await remove.mutateAsync(holiday.id);
                            } catch {
                              // Toast already shown.
                            }
                          }}
                        >
                          <p className="text-xs text-muted-foreground">
                            {formatDate(holiday.date)} · {dayName(holiday.date)}
                          </p>
                        </ConfirmContent>
                      </ConfirmDialog>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </PageBody>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          title="Tambah hari libur"
          description="Tanggal ini akan dilewati saat menghitung jatuh tempo peminjaman baru."
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              create.mutate({ date, name: name.trim() });
            }}
            className="space-y-3"
          >
            <Field label="Tanggal" htmlFor="holiday-date" required>
              <Input
                id="holiday-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </Field>

            <Field label="Nama hari libur" htmlFor="holiday-name" required>
              <Input
                id="holiday-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: Hari Raya Idul Fitri"
                maxLength={120}
                required
              />
            </Field>

            {date && isSunday(date) ? (
              <p className="rounded-lg border border-warning/30 bg-warning-soft p-2.5 text-xs text-warning-foreground">
                Tanggal ini hari Minggu — sudah otomatis dilewati. Menambahkannya tidak berbahaya,
                tetapi tidak mengubah apa pun.
              </p>
            ) : null}

            <div className="flex justify-end gap-2 pt-1">
              <DialogClose asChild>
                <Button type="button" variant="ghost">
                  Batal
                </Button>
              </DialogClose>
              <Button type="submit" loading={create.isPending} disabled={!date || name.trim().length < 3}>
                Simpan
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
