import * as React from 'react';
import { Megaphone, Pin, Plus, RefreshCw, Trash2 } from 'lucide-react';
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
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { api } from '@/lib/api';
import { useAnnouncements, useApiMutation, useListParams } from '@/hooks/useApi';
import { cn, formatDateTime } from '@/lib/utils';
import type { Announcement, AnnouncementAudience } from '@/types';

const AUDIENCE_LABEL: Record<AnnouncementAudience, string> = {
  all: 'Semua pengguna',
  user: 'Siswa saja',
  admin: 'Petugas saja',
};

const AUDIENCE_TONE: Record<AnnouncementAudience, 'info' | 'violet' | 'warning'> = {
  all: 'info',
  user: 'violet',
  admin: 'warning',
};

interface FormState {
  title: string;
  body: string;
  audience: AnnouncementAudience;
  pinned: boolean;
  expiresAt: string;
}

const EMPTY_FORM: FormState = {
  title: '',
  body: '',
  audience: 'all',
  pinned: false,
  expiresAt: '',
};

export default function AdminAnnouncementsPage() {
  const { get, set } = useListParams();
  const page = Number(get('page', '1')) || 1;
  const pageSize = Number(get('pageSize', '10')) || 10;

  const query = React.useMemo(() => ({ page, pageSize }), [page, pageSize]);
  const announcements = useAnnouncements(query);

  const items = announcements.data?.items ?? [];
  const meta = announcements.data?.meta;

  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Announcement | null>(null);
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM);

  const invalidate = [['announcements']];

  const save = useApiMutation<FormState & { id?: number }, Announcement>({
    mutationFn: async (payload) => {
      const body = {
        title: payload.title,
        body: payload.body,
        audience: payload.audience,
        pinned: payload.pinned,
        // `datetime-local` gives "2026-10-21T14:30"; MySQL accepts it as-is.
        expiresAt: payload.expiresAt ? payload.expiresAt.replace('T', ' ') : null,
      };
      if (payload.id) {
        return (await api.patch<Announcement>(`/announcements/${payload.id}`, body)).data;
      }
      return (await api.post<Announcement>('/announcements', body)).data;
    },
    invalidate,
    onSuccess: () => {
      setOpen(false);
      setEditing(null);
      setForm(EMPTY_FORM);
    },
  });

  const remove = useApiMutation<number, unknown>({
    mutationFn: async (id) => (await api.delete(`/announcements/${id}`)).data,
    successMessage: 'Pengumuman dihapus.',
    invalidate,
  });

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  };

  const openEdit = (a: Announcement) => {
    setEditing(a);
    setForm({
      title: a.title,
      body: a.body,
      audience: a.audience,
      pinned: a.pinned,
      // Trim to minutes: the input type does not accept seconds.
      expiresAt: a.expiresAt ? a.expiresAt.slice(0, 16).replace(' ', 'T') : '',
    });
    setOpen(true);
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    save.mutate({ ...form, id: editing?.id });
  };

  return (
    <>
      <PageHeader
        eyebrow="Komunikasi"
        title="Pengumuman"
        description="Pesan yang tampil di beranda siswa, misalnya perubahan jam buka atau pengumuman libur. Pengumuman yang sudah kedaluwarsa tetap tersimpan sebagai riwayat tetapi tidak lagi ditampilkan."
        breadcrumb={[{ label: 'Dasbor', to: '/admin' }, { label: 'Pengumuman' }]}
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={openCreate}>
              <Plus className="size-3.5" aria-hidden />
              Tulis pengumuman
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void announcements.refetch()}
              loading={announcements.isFetching && !announcements.isLoading}
            >
              <RefreshCw className="size-3.5" aria-hidden />
              Perbarui
            </Button>
          </div>
        }
        meta={
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {announcements.isLoading
              ? 'Memuat pengumuman...'
              : `${items.filter((a) => !a.expired).length} pengumuman aktif di halaman ini`}
          </p>
        }
      />

      <PageBody className="space-y-4">
        {announcements.isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-28 w-full" />
            ))}
          </div>
        ) : announcements.isError ? (
          <ErrorState
            message={announcements.error instanceof Error ? announcements.error.message : undefined}
            onRetry={() => void announcements.refetch()}
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon={Megaphone}
            title="Belum ada pengumuman"
            description="Pengumuman yang Anda tulis akan tampil di beranda siswa sesuai sasarannya."
            action={
              <Button size="sm" onClick={openCreate}>
                <Plus className="size-3.5" aria-hidden />
                Tulis pengumuman
              </Button>
            }
          />
        ) : (
          <ul className="space-y-3">
            {items.map((a) => (
              <li
                key={a.id}
                className={cn(
                  'panel p-4',
                  a.expired && 'opacity-60',
                  a.pinned && !a.expired && 'border-primary/40',
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {a.pinned ? (
                        <Pin className="size-3.5 text-primary" aria-label="Disematkan" />
                      ) : null}
                      <h2 className="font-display text-base font-semibold">{a.title}</h2>
                      <Badge tone={AUDIENCE_TONE[a.audience]}>{AUDIENCE_LABEL[a.audience]}</Badge>
                      {a.expired ? <Badge tone="neutral">Kedaluwarsa</Badge> : null}
                    </div>
                    <p className="mt-1.5 whitespace-pre-line text-sm text-muted-foreground">
                      {a.body}
                    </p>
                    <p className="mt-2 text-2xs text-muted-foreground">
                      {a.createdByName} · {formatDateTime(a.createdAt)}
                      {a.expiresAt ? ` · berlaku sampai ${formatDateTime(a.expiresAt)}` : ''}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(a)}>
                      Ubah
                    </Button>
                    <ConfirmDialog>
                      <ConfirmTrigger asChild>
                        <Button size="sm" variant="ghost" aria-label="Hapus pengumuman">
                          <Trash2 className="size-3.5" aria-hidden />
                        </Button>
                      </ConfirmTrigger>
                      <ConfirmContent
                        title="Hapus pengumuman?"
                        description={
                          <>
                            &ldquo;{a.title}&rdquo; akan hilang dari beranda siswa dan tidak dapat
                            dikembalikan.
                          </>
                        }
                        confirmLabel="Ya, hapus"
                        onConfirm={async () => {
                          try {
                            await remove.mutateAsync(a.id);
                          } catch {
                            // Toast already shown.
                          }
                        }}
                      >
                        <p className="text-xs text-muted-foreground">
                          Bila hanya ingin menyembunyikannya, ubah tanggal kedaluwarsa menjadi hari
                          ini.
                        </p>
                      </ConfirmContent>
                    </ConfirmDialog>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {meta && meta.totalPages > 1 ? (
          <Pagination
            page={meta.page}
            totalPages={meta.totalPages}
            total={meta.total}
            pageSize={meta.pageSize}
            onPageChange={(p) => set('page', p)}
          />
        ) : null}
      </PageBody>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          title={editing ? 'Ubah pengumuman' : 'Pengumuman baru'}
          description="Tulis singkat dan jelas. Siswa membaca ini di beranda, bukan di halaman terpisah."
        >
          <form onSubmit={submit} className="space-y-3">
            <Field label="Judul" htmlFor="ann-title" required>
              <Input
                id="ann-title"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                maxLength={150}
                required
              />
            </Field>

            <Field label="Isi" htmlFor="ann-body" required>
              <Textarea
                id="ann-body"
                value={form.body}
                onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                rows={4}
                maxLength={2000}
                required
              />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Sasaran" htmlFor="ann-audience">
                <Select
                  id="ann-audience"
                  value={form.audience}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, audience: e.target.value as AnnouncementAudience }))
                  }
                >
                  <option value="all">Semua pengguna</option>
                  <option value="user">Siswa saja</option>
                  <option value="admin">Petugas saja</option>
                </Select>
              </Field>

              <Field
                label="Berlaku sampai"
                htmlFor="ann-expires"
                hint="Kosongkan bila tidak pernah kedaluwarsa."
              >
                <Input
                  id="ann-expires"
                  type="datetime-local"
                  value={form.expiresAt}
                  onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
                />
              </Field>
            </div>

            <label className="flex items-start gap-2 rounded-lg border border-border p-3 text-sm">
              <input
                type="checkbox"
                checked={form.pinned}
                onChange={(e) => setForm((f) => ({ ...f, pinned: e.target.checked }))}
                className="mt-0.5 size-4 rounded border-border"
              />
              <span>
                <span className="font-medium">Sematkan di atas</span>
                <span className="block text-xs text-muted-foreground">
                  Pengumuman tersemat selalu tampil lebih dulu, di atas yang terbaru.
                </span>
              </span>
            </label>

            <div className="flex justify-end gap-2 pt-1">
              <DialogClose asChild>
                <Button type="button" variant="ghost">
                  Batal
                </Button>
              </DialogClose>
              <Button type="submit" loading={save.isPending}>
                {editing ? 'Simpan perubahan' : 'Terbitkan'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
