import * as React from 'react';
import { motion, useReducedMotion, type Variants } from 'framer-motion';
import { toast } from 'sonner';
import {
  Copy,
  Download,
  FileDown,
  IdCard,
  KeyRound,
  Pencil,
  Plus,
  Power,
  PowerOff,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Upload,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { PageBody, PageHeader } from '@/components/layout/PageHeader';
import { Badge, BookStatusBadge, RoleBadge } from '@/components/ui/badge';
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
import { QrCode } from '@/components/ui/qr-code';
import { TableSkeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState, NoResultsState } from '@/components/ui/states';
import { api, ApiError, downloadFile, type ApiSuccess } from '@/lib/api';
import {
  useApiMutation,
  useDebounced,
  useListParams,
  useMembers,
} from '@/hooks/useApi';
import { formatDate, formatNumber, initials } from '@/lib/utils';
import { staggerContainer, staggerItem } from '@/lib/motion';
import type { Member } from '@/types';
import { MemberImportDialog } from './MemberImportDialog';

/** Motion collapses to a static state when the OS asks for less movement. */
const STILL: Variants = { hidden: {}, show: {} };

/** Mirrors the `status` enum accepted by GET /api/members. */
const STATUS_OPTIONS = [
  { value: 'all', label: 'Semua status' },
  { value: 'active', label: 'Aktif' },
  { value: 'inactive', label: 'Nonaktif' },
] as const;

/** Everything that can shift once a member record changes. */
const INVALIDATE = [['members'], ['dashboard'], ['activity'], ['loans']] as const;

interface MemberForm {
  username: string;
  email: string;
  fullName: string;
  className: string;
  phone: string;
  address: string;
  password: string;
}

type MemberFormErrors = Partial<Record<keyof MemberForm, string>>;

const EMPTY_FORM: MemberForm = {
  username: '',
  email: '',
  fullName: '',
  className: '',
  phone: '',
  address: '',
  password: '',
};

/** Mirrors resetPasswordSchema on the server. */
function passwordProblem(value: string): string | undefined {
  if (value.length < 8) return 'Kata sandi minimal 8 karakter.';
  if (value.length > 72) return 'Kata sandi maksimal 72 karakter.';
  if (!/[A-Za-z]/.test(value)) return 'Kata sandi harus mengandung huruf.';
  if (!/[0-9]/.test(value)) return 'Kata sandi harus mengandung angka.';
  return undefined;
}

function validateMemberForm(form: MemberForm, isCreate: boolean): MemberFormErrors {
  const errors: MemberFormErrors = {};
  const username = form.username.trim();

  if (isCreate) {
    if (username.length < 3) {
      errors.username = 'Username minimal 3 karakter.';
    } else if (!/^[a-zA-Z0-9._-]+$/.test(username)) {
      errors.username =
        'Username hanya boleh berisi huruf, angka, titik, garis bawah, atau strip.';
    }
  }

  const email = form.email.trim();
  if (!email) {
    errors.email = 'Email wajib diisi.';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'Format email tidak valid.';
  }

  const fullName = form.fullName.trim();
  if (fullName.length < 3) {
    errors.fullName = 'Nama lengkap minimal 3 karakter.';
  } else if (fullName.length > 100) {
    errors.fullName = 'Nama lengkap maksimal 100 karakter.';
  }

  if (form.className.trim().length > 50) errors.className = 'Kelas maksimal 50 karakter.';

  const phone = form.phone.trim();
  if (phone && !/^[0-9+\-\s()]{8,30}$/.test(phone)) {
    errors.phone = 'Nomor telepon tidak valid.';
  }

  if (form.address.trim().length > 200) errors.address = 'Alamat maksimal 200 karakter.';

  if (isCreate && form.password) {
    const problem = passwordProblem(form.password);
    if (problem) errors.password = problem;
  }

  return errors;
}

/** Mirrors the server's generated format so the officer can read it aloud. */
function suggestPassword(): string {
  const bytes = new Uint8Array(2);
  crypto.getRandomValues(bytes);
  const suffix = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  const digits = String(100 + Math.floor(Math.random() * 900));
  return `Lum${digits}-${suffix}`;
}

function useMemberMutations() {
  const create = useApiMutation<MemberForm, ApiSuccess<Member>>({
    mutationFn: async (form) => {
      const payload: Record<string, string> = {
        username: form.username.trim(),
        email: form.email.trim(),
        fullName: form.fullName.trim(),
      };
      if (form.className.trim()) payload.className = form.className.trim();
      if (form.phone.trim()) payload.phone = form.phone.trim();
      if (form.address.trim()) payload.address = form.address.trim();
      if (form.password) payload.password = form.password;
      return api.post<Member>('/members', payload);
    },
    successMessage: (res) => res.message ?? 'Anggota berhasil ditambahkan.',
    invalidate: [['members']],
  });

  const update = useApiMutation<{ id: number; form: MemberForm }, ApiSuccess<Member>>({
    mutationFn: async ({ id, form }) => {
      const payload: Record<string, string> = {
        fullName: form.fullName.trim(),
        email: form.email.trim(),
      };
      if (form.className.trim()) payload.className = form.className.trim();
      if (form.phone.trim()) payload.phone = form.phone.trim();
      if (form.address.trim()) payload.address = form.address.trim();
      return api.patch<Member>(`/members/${id}`, payload);
    },
    successMessage: (res) => res.message ?? 'Data anggota berhasil diperbarui.',
    invalidate: [['members']],
  });

  const setStatus = useApiMutation<
    { id: number; status: 'active' | 'inactive' },
    ApiSuccess<Member>
  >({
    mutationFn: async ({ id, status }) => api.patch<Member>(`/members/${id}/status`, { status }),
    successMessage: (res) => res.message ?? 'Status anggota diperbarui.',
    invalidate: INVALIDATE,
  });

  const resetPassword = useApiMutation<
    { id: number; newPassword: string },
    ApiSuccess<Member | null>
  >({
    mutationFn: async ({ id, newPassword }) =>
      api.post<Member | null>(`/members/${id}/reset-password`, { newPassword }),
    successMessage: () => 'Kata sandi anggota berhasil diatur ulang.',
    invalidate: [['activity']],
  });

  const remove = useApiMutation<number, ApiSuccess<{ deleted: boolean; softDeleted: boolean }>>({
    mutationFn: async (id) =>
      api.delete<{ deleted: boolean; softDeleted: boolean }>(`/members/${id}`),
    successMessage: (res) => res.message ?? 'Anggota berhasil dihapus.',
    invalidate: INVALIDATE,
  });

  return { create, update, setStatus, resetPassword, remove };
}

type MemberMutations = ReturnType<typeof useMemberMutations>;

export default function AdminMembersPage() {
  const defaults = React.useMemo(() => ({}), []);
  const { params, get, set, setMany, reset } = useListParams(defaults);

  const [term, setTerm] = React.useState(() => get('search'));
  const debouncedTerm = useDebounced(term, 350);

  const status = get('status', 'all');
  const page = Number(get('page', '1')) || 1;
  const pageSize = Number(get('pageSize', '12')) || 12;

  React.useEffect(() => {
    if ((params.get('search') ?? '') === debouncedTerm) return;
    setMany({ search: debouncedTerm || undefined, page: undefined });
  }, [debouncedTerm, params, setMany]);

  const query = React.useMemo(
    () => ({
      search: debouncedTerm || undefined,
      status,
      page,
      pageSize,
    }),
    [debouncedTerm, status, page, pageSize],
  );

  const members = useMembers(query);
  const mutations = useMemberMutations();

  const reduce = useReducedMotion();
  const containerVariants = reduce ? STILL : staggerContainer(0.035);
  const rowVariants = reduce ? STILL : staggerItem;

  const [createOpen, setCreateOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Member | null>(null);
  const [credentials, setCredentials] = React.useState<{
    member: Member;
    temporaryPassword?: string;
  } | null>(null);
  const [exporting, setExporting] = React.useState(false);
  const [importOpen, setImportOpen] = React.useState(false);

  const items = members.data?.items ?? [];
  const meta = members.data?.meta;
  const hasFilters = Boolean(debouncedTerm) || status !== 'all';
  const activeStatusLabel = STATUS_OPTIONS.find((o) => o.value === status)?.label ?? 'Semua status';

  const clearFilters = () => {
    setTerm('');
    reset();
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await downloadFile('/excel/export/members', {
        search: debouncedTerm || undefined,
        status: status === 'all' ? undefined : status,
      });
      toast.success('Berkas Excel anggota berhasil diunduh.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Gagal mengunduh berkas Excel.');
    } finally {
      setExporting(false);
    }
  };

  const handleTemplate = async () => {
    try {
      await downloadFile('/excel/template/members', undefined, 'lumen-template-impor-anggota.xlsx');
      toast.success('Template impor diunduh.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Gagal mengunduh template.');
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Keanggotaan"
        title="Kelola Anggota"
        description="Daftarkan siswa, perbarui kontak, atur ulang kata sandi, dan nonaktifkan akun. Kode anggota dibuat otomatis oleh sistem."
        breadcrumb={[
          { label: 'Dasbor', to: '/admin' },
          { label: 'Anggota' },
        ]}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => void handleTemplate()}>
              <FileDown className="size-3.5" aria-hidden />
              Template
            </Button>
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <Upload className="size-3.5" aria-hidden />
              Impor Excel
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleExport()}
              loading={exporting}
            >
              <Download className="size-3.5" aria-hidden />
              Ekspor Excel
            </Button>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <UserPlus className="size-3.5" aria-hidden />
              Tambah Anggota
            </Button>
          </>
        }
        meta={
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {members.isLoading
              ? 'Memuat anggota...'
              : `${formatNumber(meta?.total ?? 0)} anggota terdaftar`}
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
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-end">
            <Field
              label="Cari anggota"
              htmlFor="member-search"
              hint="Mencocokkan nama, username, kode anggota, atau email."
            >
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  id="member-search"
                  type="search"
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  placeholder="Cari nama, kode anggota, atau email..."
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

            <Field label="Status" htmlFor="member-status" className="md:w-48">
              <Select
                id="member-status"
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

            <div className="flex items-end pb-0.5">
              <Button
                variant="outline"
                size="md"
                onClick={() => void members.refetch()}
                loading={members.isFetching && !members.isLoading}
                className="w-full md:w-auto"
              >
                <RefreshCw className="size-4" aria-hidden />
                Perbarui
              </Button>
            </div>
          </div>

          {hasFilters ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                <SlidersHorizontal className="size-3" aria-hidden />
                Filter aktif
              </span>
              {debouncedTerm ? <Badge tone="info">Kata kunci: {debouncedTerm}</Badge> : null}
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
        <section className="panel overflow-hidden" aria-label="Daftar anggota perpustakaan">
          {members.isFetching && !members.isLoading ? (
            <div className="pointer-events-none h-0.5 overflow-hidden bg-border" aria-hidden>
              <div className="h-full w-1/3 animate-shimmer bg-primary" />
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] border-collapse text-sm">
              <caption className="sr-only">
                Daftar anggota beserta kontak, kelas, jumlah peminjaman, status, dan tindakan petugas
              </caption>
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th
                    scope="col"
                    className="px-4 py-3 text-left text-2xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    Nama
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left text-2xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    Kode Anggota
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left text-2xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    Username
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left text-2xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    Email
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left text-2xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    Kelas
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left text-2xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    Peminjaman
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left text-2xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    Status
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-right text-2xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    Aksi
                  </th>
                </tr>
              </thead>

              {members.isLoading ? (
                <tbody>
                  <tr>
                    <td colSpan={8} className="px-4 py-4">
                      <TableSkeleton rows={6} columns={4} />
                    </td>
                  </tr>
                </tbody>
              ) : members.isError ? (
                <tbody>
                  <tr>
                    <td colSpan={8}>
                      <ErrorState
                        title="Gagal memuat daftar anggota"
                        message={members.error?.message}
                        onRetry={() => void members.refetch()}
                      />
                    </td>
                  </tr>
                </tbody>
              ) : items.length === 0 ? (
                <tbody>
                  <tr>
                    <td colSpan={8}>
                      {hasFilters ? (
                        <NoResultsState
                          onReset={clearFilters}
                          description="Tidak ada anggota yang cocok dengan status atau kata kunci pencarian."
                        />
                      ) : (
                        <EmptyState
                          icon={Users}
                          title="Belum ada anggota"
                          description="Daftarkan anggota pertama agar siswa dapat meminjam buku."
                          action={
                            <Button size="sm" onClick={() => setCreateOpen(true)}>
                              <UserPlus className="size-3.5" aria-hidden />
                              Tambah Anggota
                            </Button>
                          }
                        />
                      )}
                    </td>
                  </tr>
                </tbody>
              ) : (
                <motion.tbody
                  key={`${status}-${page}-${pageSize}-${debouncedTerm}`}
                  variants={containerVariants}
                  initial="hidden"
                  animate="show"
                >
                  {items.map((member) => (
                    <motion.tr
                      key={member.id}
                      variants={rowVariants}
                      className="border-b border-border transition-colors last:border-0 hover:bg-muted/40"
                    >
                      <td className="px-4 py-3 align-top">
                        <div className="flex items-center gap-3">
                          <MemberAvatar name={member.fullName} />
                          <div className="min-w-0 max-w-[14rem]">
                            <p className="truncate text-sm font-medium text-foreground">
                              {member.fullName}
                            </p>
                            <p className="truncate text-2xs text-muted-foreground">
                              Terdaftar {formatDate(member.createdAt)}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 align-top">
                        {member.memberCode ? (
                          <span className="font-mono text-xs font-semibold text-foreground">
                            {member.memberCode}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 align-top">
                        <span className="font-mono text-xs text-foreground">
                          {member.username}
                        </span>
                      </td>

                      <td className="px-4 py-3 align-top">
                        <p className="max-w-[15rem] truncate text-xs text-foreground">
                          {member.email}
                        </p>
                        {member.phone ? (
                          <p className="mt-0.5 max-w-[15rem] truncate text-2xs text-muted-foreground">
                            {member.phone}
                          </p>
                        ) : null}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 align-top">
                        {member.className ? (
                          <span className="text-xs text-foreground">{member.className}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 align-top">
                        <p className="text-sm font-semibold tabular-nums text-foreground">
                          {member.activeLoans}
                          <span className="font-normal text-muted-foreground">
                            /{member.totalLoans}
                          </span>
                        </p>
                        <p className="text-2xs text-muted-foreground">aktif / total</p>
                      </td>

                      <td className="px-4 py-3 align-top">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <BookStatusBadge status={member.status} />
                          <RoleBadge role={member.role} />
                        </div>
                      </td>

                      <td className="px-4 py-3 text-right align-top">
                        <MemberActions
                          member={member}
                          actions={mutations}
                          onEdit={(m) => {
                            setEditing(m);
                          }}
                        />
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

      <MemberFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        create={mutations.create}
        onCreated={(result) => setCredentials(result)}
      />

      <MemberImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={() => void members.refetch()}
      />

      <EditMemberDialog
        member={editing}
        onClose={() => setEditing(null)}
        update={mutations.update}
      />

      <TemporaryPasswordDialog
        payload={credentials}
        onClose={() => setCredentials(null)}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */

function MemberAvatar({ name }: { name: string }) {
  return (
    <span
      aria-hidden
      className="flex size-9 shrink-0 items-center justify-center rounded-full bg-electric-soft font-display text-xs font-semibold text-primary"
    >
      {initials(name)}
    </span>
  );
}

function MemberActions({
  member,
  actions,
  onEdit,
}: {
  member: Member;
  actions: MemberMutations;
  onEdit: (member: Member) => void;
}) {
  const isAdmin = member.role === 'admin';
  const isActive = member.status === 'active';
  const busy = actions.setStatus.isPending || actions.remove.isPending;

  if (isAdmin) {
    return (
      <span className="text-2xs text-muted-foreground">
        Akun petugas dikelola dari halaman pengaturan
      </span>
    );
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => onEdit(member)}
        aria-label={`Ubah data anggota ${member.fullName}`}
        title="Ubah data anggota"
      >
        <Pencil className="size-3.5" aria-hidden />
      </Button>

      <ResetPasswordDialog member={member} resetPassword={actions.resetPassword} />

      <MemberCardDialog member={member} />

      <Button
        variant="ghost"
        size="icon-sm"
        disabled={busy}
        onClick={() => {
          void actions.setStatus
            .mutateAsync({ id: member.id, status: isActive ? 'inactive' : 'active' })
            .catch(() => {
              // 409 (still holding books) arrives here; the toast carries it.
            });
        }}
        aria-label={
          isActive ? `Nonaktifkan akun ${member.fullName}` : `Aktifkan akun ${member.fullName}`
        }
        title={isActive ? 'Nonaktifkan akun' : 'Aktifkan akun'}
      >
        {isActive ? (
          <PowerOff className="size-3.5" aria-hidden />
        ) : (
          <Power className="size-3.5" aria-hidden />
        )}
      </Button>

      <ConfirmDialog>
        <ConfirmTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-destructive hover:bg-destructive-soft hover:text-destructive"
            aria-label={`Hapus anggota ${member.fullName}`}
            title="Hapus anggota"
          >
            <Trash2 className="size-3.5" aria-hidden />
          </Button>
        </ConfirmTrigger>
        <ConfirmContent
          title="Hapus anggota ini?"
          confirmLabel="Ya, hapus"
          cancelLabel="Batal"
          onConfirm={async () => {
            try {
              await actions.remove.mutateAsync(member.id);
            } catch {
              // 409 (active loans) / 403 (petugas) arrive here; toast carries it.
            }
          }}
          description={
            <>
              <strong>{member.fullName}</strong> akan dihapus bila belum pernah meminjaman buku.
              Anggota yang masih memegang buku tidak dapat dihapus, dan anggota yang sudah punya
              riwayat transaksi hanya dinonaktifkan. Server mengembalikan pesan yang sebenarnya terjadi.
            </>
          }
        >
          <p className="font-mono text-xs text-muted-foreground">
            {member.memberCode ?? member.username} · {member.activeLoans} peminjaman aktif
          </p>
        </ConfirmContent>
      </ConfirmDialog>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function MemberFormDialog({
  open,
  onOpenChange,
  create,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  create: MemberMutations['create'];
  onCreated: (result: { member: Member; temporaryPassword?: string }) => void;
}) {
  const [form, setForm] = React.useState<MemberForm>(EMPTY_FORM);
  const [errors, setErrors] = React.useState<MemberFormErrors>({});

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
    if (!next) {
      setForm(EMPTY_FORM);
      setErrors({});
    }
  };

  React.useEffect(() => {
    if (!open) return;
    setForm(EMPTY_FORM);
    setErrors({});
  }, [open]);

  const setField = <K extends keyof MemberForm>(key: K, value: MemberForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  };

  const submit = async () => {
    const found = validateMemberForm(form, true);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    try {
      const res = await create.mutateAsync(form);
      handleOpenChange(false);
      onCreated({
        member: res.data,
        temporaryPassword: res.temporaryPassword,
      });
    } catch (err) {
      // 409 (username/email taken) arrives here; keep the typed values.
      if (err instanceof ApiError) setErrors(mapFieldErrors(err));
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        title="Tambah Anggota"
        description="Kata sandi boleh dikosongkan. Bila dikosongkan, sistem membuatkan kata sandi sementara yang perlu diserahkan secara langsung."
        size="lg"
        footer={
          <>
            <DialogClose asChild>
              <Button variant="outline" disabled={create.isPending}>
                Batal
              </Button>
            </DialogClose>
            <Button
              onClick={() => {
                void submit();
              }}
              loading={create.isPending}
            >
              <UserPlus className="size-4" aria-hidden />
              Simpan anggota
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
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Username"
              htmlFor="member-form-username"
              required
              error={errors.username}
              hint="Huruf, angka, titik, garis bawah, atau strip."
            >
              <Input
                id="member-form-username"
                value={form.username}
                onChange={(e) => setField('username', e.target.value)}
                placeholder="siswa.2024"
                className="font-mono"
                autoComplete="off"
                aria-invalid={errors.username ? true : undefined}
                aria-describedby={
                  errors.username ? 'member-form-username-error' : 'member-form-username-hint'
                }
              />
            </Field>

            <Field label="Email" htmlFor="member-form-email" required error={errors.email}>
              <Input
                id="member-form-email"
                type="email"
                value={form.email}
                onChange={(e) => setField('email', e.target.value)}
                placeholder="siswa@sekolah.sch.id"
                autoComplete="off"
                aria-invalid={errors.email ? true : undefined}
                aria-describedby={errors.email ? 'member-form-email-error' : undefined}
              />
            </Field>
          </div>

          <Field
            label="Nama Lengkap"
            htmlFor="member-form-name"
            required
            error={errors.fullName}
          >
            <Input
              id="member-form-name"
              value={form.fullName}
              onChange={(e) => setField('fullName', e.target.value)}
              placeholder="Nama lengkap sesuai data sekolah"
              aria-invalid={errors.fullName ? true : undefined}
              aria-describedby={errors.fullName ? 'member-form-name-error' : undefined}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Kelas" htmlFor="member-form-class" error={errors.className} hint="Contoh: X IPA 1.">
              <Input
                id="member-form-class"
                value={form.className}
                onChange={(e) => setField('className', e.target.value)}
                placeholder="X IPA 1"
                aria-invalid={errors.className ? true : undefined}
                aria-describedby={
                  errors.className ? 'member-form-class-error' : 'member-form-class-hint'
                }
              />
            </Field>

            <Field
              label="Telepon"
              htmlFor="member-form-phone"
              error={errors.phone}
              hint="Opsional. Hanya angka, spasi, tanda hubung, dan kurung."
            >
              <Input
                id="member-form-phone"
                type="tel"
                value={form.phone}
                onChange={(e) => setField('phone', e.target.value)}
                placeholder="0812 3456 7890"
                aria-invalid={errors.phone ? true : undefined}
                aria-describedby={
                  errors.phone ? 'member-form-phone-error' : 'member-form-phone-hint'
                }
              />
            </Field>
          </div>

          <Field label="Alamat" htmlFor="member-form-address" error={errors.address} hint="Opsional, maksimal 200 karakter.">
            <Textarea
              id="member-form-address"
              rows={2}
              value={form.address}
              onChange={(e) => setField('address', e.target.value)}
              placeholder="Alamat tempat tinggal anggota"
              aria-invalid={errors.address ? true : undefined}
              aria-describedby={
                errors.address ? 'member-form-address-error' : 'member-form-address-hint'
              }
            />
          </Field>

          <Field
            label="Kata Sandi"
            htmlFor="member-form-password"
            error={errors.password}
            hint="Opsional. Minimal 8 karakter dan harus mengandung huruf serta angka. Bila dikosongkan, sistem menerbitkan kata sandi sementara."
          >
            <div className="flex gap-2">
              <Input
                id="member-form-password"
                type="password"
                value={form.password}
                onChange={(e) => setField('password', e.target.value)}
                placeholder="Kosongkan untuk memakai kata sandi sementara"
                autoComplete="new-password"
                aria-invalid={errors.password ? true : undefined}
                aria-describedby={
                  errors.password ? 'member-form-password-error' : 'member-form-password-hint'
                }
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => setField('password', suggestPassword())}
              >
                <KeyRound className="size-4" aria-hidden />
                Buat acak
              </Button>
            </div>
          </Field>

          <p className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            Kode anggota dibuat otomatis oleh sistem dan tidak dapat diubah dari halaman ini.
          </p>

          <button type="submit" className="sr-only">
            Simpan anggota
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */

function EditMemberDialog({
  member,
  onClose,
  update,
}: {
  member: Member | null;
  onClose: () => void;
  update: MemberMutations['update'];
}) {
  const [form, setForm] = React.useState<MemberForm>(EMPTY_FORM);
  const [errors, setErrors] = React.useState<MemberFormErrors>({});
  const [seededFor, setSeededFor] = React.useState<number | null>(null);

  // Seed once per opened member so typing is never overwritten.
  React.useEffect(() => {
    if (!member || seededFor === member.id) return;
    setSeededFor(member.id);
    setForm({
      username: member.username,
      email: member.email,
      fullName: member.fullName,
      className: member.className ?? '',
      phone: member.phone ?? '',
      address: '',
      password: '',
    });
    setErrors({});
  }, [member, seededFor]);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setSeededFor(null);
      onClose();
    }
  };

  const setField = <K extends keyof MemberForm>(key: K, value: MemberForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  };

  const submit = async () => {
    if (!member) return;
    const found = validateMemberForm(form, false);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    try {
      await update.mutateAsync({ id: member.id, form });
      handleOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError) setErrors(mapFieldErrors(err));
    }
  };

  return (
    <Dialog open={member !== null} onOpenChange={handleOpenChange}>
      <DialogContent
        title="Ubah Data Anggota"
        description={
          member
            ? `${member.fullName}${member.memberCode ? ` · ${member.memberCode}` : ''}. Username dan kata sandi dikelola lewat tombol khusus.`
            : undefined
        }
        footer={
          <>
            <DialogClose asChild>
              <Button variant="outline" disabled={update.isPending}>
                Batal
              </Button>
            </DialogClose>
            <Button
              onClick={() => {
                void submit();
              }}
              loading={update.isPending}
            >
              Simpan perubahan
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
          <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 p-3">
            <MemberAvatar name={member?.fullName ?? ''} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{member?.username}</p>
              <p className="truncate font-mono text-2xs text-muted-foreground">
                {member?.memberCode ?? 'Tanpa kode anggota'}
              </p>
            </div>
          </div>

          <Field
            label="Nama Lengkap"
            htmlFor="edit-member-name"
            required
            error={errors.fullName}
          >
            <Input
              id="edit-member-name"
              value={form.fullName}
              onChange={(e) => setField('fullName', e.target.value)}
              aria-invalid={errors.fullName ? true : undefined}
              aria-describedby={errors.fullName ? 'edit-member-name-error' : undefined}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Email" htmlFor="edit-member-email" required error={errors.email}>
              <Input
                id="edit-member-email"
                type="email"
                value={form.email}
                onChange={(e) => setField('email', e.target.value)}
                aria-invalid={errors.email ? true : undefined}
                aria-describedby={errors.email ? 'edit-member-email-error' : undefined}
              />
            </Field>

            <Field label="Kelas" htmlFor="edit-member-class" error={errors.className}>
              <Input
                id="edit-member-class"
                value={form.className}
                onChange={(e) => setField('className', e.target.value)}
                placeholder="X IPA 1"
                aria-invalid={errors.className ? true : undefined}
                aria-describedby={errors.className ? 'edit-member-class-error' : undefined}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Telepon" htmlFor="edit-member-phone" error={errors.phone}>
              <Input
                id="edit-member-phone"
                type="tel"
                value={form.phone}
                onChange={(e) => setField('phone', e.target.value)}
                aria-invalid={errors.phone ? true : undefined}
                aria-describedby={errors.phone ? 'edit-member-phone-error' : undefined}
              />
            </Field>

            <Field
              label="Alamat"
              htmlFor="edit-member-address"
              error={errors.address}
              hint="Alamat lama tidak ditampilkan. Isi hanya bila ingin memperbarui."
            >
              <Input
                id="edit-member-address"
                value={form.address}
                onChange={(e) => setField('address', e.target.value)}
                aria-invalid={errors.address ? true : undefined}
                aria-describedby={
                  errors.address ? 'edit-member-address-error' : 'edit-member-address-hint'
                }
              />
            </Field>
          </div>

          <button type="submit" className="sr-only">
            Simpan perubahan
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */

/**
 * Printable member card.
 *
 * The QR payload is the member code alone, not a URL: a URL would encode the
 * deployment host, so every card printed before a domain change would stop
 * scanning. The desk resolves the code server-side instead.
 */
function MemberCardDialog({ member }: { member: Member }) {
  const [open, setOpen] = React.useState(false);

  if (!member.memberCode) {
    return (
      <Button
        variant="ghost"
        size="icon-sm"
        disabled
        aria-label={`Kartu anggota ${member.fullName} tidak tersedia`}
        title="Anggota ini belum memiliki kode anggota"
      >
        <IdCard className="size-3.5" aria-hidden />
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => setOpen(true)}
        aria-label={`Tampilkan kartu anggota ${member.fullName}`}
        title="Kartu anggota (QR)"
      >
        <IdCard className="size-3.5" aria-hidden />
      </Button>

      <DialogContent
        title="Kartu Anggota"
        description="Tunjukkan atau cetak kartu ini. Petugas memindai kode QR di meja sirkulasi."
        size="sm"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                void navigator.clipboard
                  ?.writeText(member.memberCode ?? '')
                  .then(() => toast.success('Kode anggota disalin.'))
                  .catch(() => toast.error('Gagal menyalin kode.'));
              }}
            >
              <Copy className="size-4" aria-hidden />
              Salin kode
            </Button>
            <DialogClose asChild>
              <Button>Tutup</Button>
            </DialogClose>
          </>
        }
      >
        <div className="flex flex-col items-center gap-3">
          <QrCode
            value={member.memberCode}
            caption={member.memberCode}
            label={`Kartu anggota ${member.fullName}`}
            size={200}
          />

          <div className="text-center">
            <p className="font-display text-sm font-semibold text-foreground">
              {member.fullName}
            </p>
            <p className="text-2xs text-muted-foreground">
              {[member.className, member.username].filter(Boolean).join(' · ')}
            </p>
          </div>

          <p className="text-center text-2xs leading-relaxed text-muted-foreground">
            Kode QR hanya memuat kode anggota, bukan data pribadi. Pindai di{' '}
            <span className="font-medium text-foreground">Meja Sirkulasi</span> untuk mengisi
            data anggota secara otomatis.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({
  member,
  resetPassword,
}: {
  member: Member;
  resetPassword: MemberMutations['resetPassword'];
}) {
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState('');
  const [error, setError] = React.useState<string | undefined>(undefined);
  const [applied, setApplied] = React.useState<string | null>(null);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setValue('');
      setError(undefined);
      setApplied(null);
    }
  };

  const submit = async () => {
    const problem = passwordProblem(value);
    if (problem) {
      setError(problem);
      return;
    }
    setError(undefined);
    try {
      await resetPassword.mutateAsync({ id: member.id, newPassword: value });
      setApplied(value);
      setValue('');
    } catch {
      // Keep the dialog open; the toast carries the server message.
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => setOpen(true)}
        aria-label={`Atur ulang kata sandi anggota ${member.fullName}`}
        title="Atur ulang kata sandi"
      >
        <KeyRound className="size-3.5" aria-hidden />
      </Button>

      <DialogContent
        title="Atur Ulang Kata Sandi"
        description={`Kata sandi baru untuk ${member.fullName}. Sandi lama langsung tidak berlaku.`}
        size="sm"
        footer={
          applied ? (
            <Button
              onClick={() => {
                handleOpenChange(false);
              }}
            >
              Selesai
            </Button>
          ) : (
            <>
              <DialogClose asChild>
                <Button variant="outline" disabled={resetPassword.isPending}>
                  Batal
                </Button>
              </DialogClose>
              <Button
                onClick={() => {
                  void submit();
                }}
                loading={resetPassword.isPending}
              >
                Atur ulang
              </Button>
            </>
          )
        }
      >
        {applied ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Kata sandi baru sudah aktif. Serahkan langsung kepada anggota; nilai ini tidak
              disimpan di mana pun setelah dialog ditutup.
            </p>
            <div className="flex items-center gap-2 rounded-lg border border-success/25 bg-success-soft px-3 py-2.5">
              <code className="min-w-0 flex-1 truncate font-mono text-sm font-semibold text-success">
                {applied}
              </code>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  void navigator.clipboard
                    .writeText(applied)
                    .then(() => toast.success('Kata sandi disalin ke papan klip.'))
                    .catch(() => toast.error('Penyalinan otomatis tidak tersedia di peramban ini.'));
                }}
                aria-label="Salin kata sandi ke papan klip"
              >
                <Copy className="size-3.5" aria-hidden />
                Salin
              </Button>
            </div>
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <Field
              label="Kata sandi baru"
              htmlFor={`reset-password-${member.id}`}
              required
              error={error}
              hint="Minimal 8 karakter, mengandung huruf dan angka."
            >
              <Input
                id={`reset-password-${member.id}`}
                type="text"
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  if (error) setError(undefined);
                }}
                placeholder="Contoh: Lum123-abcd"
                className="font-mono"
                autoComplete="new-password"
                aria-invalid={error ? true : undefined}
                aria-describedby={
                  error ? `reset-password-${member.id}-error` : `reset-password-${member.id}-hint`
                }
              />
            </Field>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setValue(suggestPassword())}
            >
              <Plus className="size-3.5" aria-hidden />
              Buat kata sandi acak
            </Button>

            <p className="flex items-start gap-2 rounded-lg border border-warning/25 bg-warning-soft px-3 py-2.5 text-xs leading-relaxed text-warning">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              Sesi anggota yang sedang terbuka tidak langsung keluar; anggota harus masuk ulang
              dengan kata sandi baru.
            </p>

            <button type="submit" className="sr-only">
              Atur ulang kata sandi
            </button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */

function TemporaryPasswordDialog({
  payload,
  onClose,
}: {
  payload: { member: Member; temporaryPassword?: string } | null;
  onClose: () => void;
}) {
  const temporary = payload?.temporaryPassword;

  return (
    <Dialog open={payload !== null} onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <DialogContent
        title={temporary ? 'Kata sandi sementara' : 'Anggota ditambahkan'}
        description={
          payload
            ? `${payload.member.fullName}${payload.member.memberCode ? ` · ${payload.member.memberCode}` : ''}`
            : undefined
        }
        size="sm"
        footer={
          <Button
            onClick={() => {
              onClose();
            }}
          >
            Saya sudah mencatatnya
          </Button>
        }
      >
        {temporary ? (
          <div className="space-y-3">
            <p className="text-sm leading-relaxed text-muted-foreground">
              Serahkan kata sandi ini kepada anggota secara langsung. Nilai ini hanya ditampilkan
              sekali dan tidak pernah disimpan di server maupun peramban.
            </p>
            <div className="flex items-center gap-2 rounded-lg border border-primary/25 bg-electric-soft px-3 py-3">
              <code className="min-w-0 flex-1 break-all font-mono text-lg font-semibold tracking-wide text-primary">
                {temporary}
              </code>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  void navigator.clipboard
                    .writeText(temporary)
                    .then(() => toast.success('Kata sandi disalin ke papan klip.'))
                    .catch(() => toast.error('Penyalinan otomatis tidak tersedia di peramban ini.'));
                }}
                aria-label="Salin kata sandi sementara ke papan klip"
              >
                <Copy className="size-3.5" aria-hidden />
                Salin
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm leading-relaxed text-muted-foreground">
            Data anggota tersimpan dengan kata sandi yang Anda tentukan. Ajarkan anggota untuk
            menggantinya setelah masuk pertama kali.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */

/** Maps the server's per-field messages onto the form. */
function mapFieldErrors(err: ApiError): MemberFormErrors {
  const map: Record<string, keyof MemberForm> = {
    username: 'username',
    email: 'email',
    fullName: 'fullName',
    className: 'className',
    phone: 'phone',
    address: 'address',
    password: 'password',
  };
  const out: MemberFormErrors = {};
  for (const [key, message] of Object.entries(err.fields ?? {})) {
    const target = map[key];
    if (target) out[target] = message;
  }
  return out;
}
