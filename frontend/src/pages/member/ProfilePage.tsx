import * as React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Hash,
  Info,
  KeyRound,
  LogIn,
  Mail,
  PencilLine,
  Phone,
  RefreshCw,
  School,
  ShieldCheck,
  User,
} from 'lucide-react';
import { PageBody, PageHeader } from '@/components/layout/PageHeader';
import { Badge, RoleBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { QrCode } from '@/components/ui/qr-code';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/states';
import { useAuth } from '@/features/auth/AuthContext';
import { api } from '@/lib/api';
import { useApiMutation } from '@/hooks/useApi';
import { cn, formatDateTime, initials } from '@/lib/utils';
import { EASE_OUT } from '@/lib/motion';
import type { User as UserRecord } from '@/types';

/**
 * Field rules mirror the server schema (`updateProfileSchema`): the client
 * rejects what the API would reject, so the message language stays identical.
 */
const profileSchema = z.object({
  fullName: z.string().trim().min(3, 'Nama lengkap minimal 3 karakter.').max(100),
  className: z.string().trim().max(50, 'Kelas maksimal 50 karakter.').optional().or(z.literal('')),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s()]{8,30}$/, 'Nomor telepon tidak valid.')
    .optional()
    .or(z.literal('')),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Kata sandi saat ini wajib diisi.'),
    newPassword: z
      .string()
      .min(8, 'Kata sandi minimal 8 karakter.')
      .max(72, 'Kata sandi maksimal 72 karakter.')
      .regex(/[A-Za-z]/, 'Kata sandi harus mengandung huruf.')
      .regex(/[0-9]/, 'Kata sandi harus mengandung angka.'),
    confirmPassword: z.string().min(1, 'Konfirmasi kata sandi wajib diisi.'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Konfirmasi kata sandi tidak cocok.',
    path: ['confirmPassword'],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'Kata sandi baru harus berbeda dari kata sandi saat ini.',
    path: ['newPassword'],
  });

type ProfileValues = z.infer<typeof profileSchema>;
type PasswordValues = z.infer<typeof passwordSchema>;

/** Identity facts come from the server as-is; empty means "not on file". */
function fact(value: string | null | undefined, fallback = 'Belum diisi'): string {
  const text = value?.trim();
  return text && text.length > 0 ? text : fallback;
}

export default function ProfilePage() {
  const { user, status, refresh } = useAuth();
  const reduce = useReducedMotion();

  return (
    <>
      <PageHeader
        eyebrow="Akun"
        title="Profil Saya"
        description="Data keanggotaan yang tersimpan di server, beserta formulir untuk memperbarui data diri dan kata sandi."
        breadcrumb={[
          { label: 'Beranda', to: '/perpustakaan' },
          { label: 'Profil' },
        ]}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void refresh();
            }}
            loading={status === 'loading'}
          >
            <RefreshCw className="size-3.5" aria-hidden />
            Muat ulang
          </Button>
        }
      />

      <PageBody className="space-y-5">
        {status === 'loading' ? (
          <ProfileSkeleton />
        ) : !user ? (
          <div className="panel">
            <ErrorState
              title="Profil tidak dapat dimuat"
              message="Sesi Anda mungkin sudah berakhir. Muat ulang data atau masuk kembali."
              onRetry={() => {
                void refresh();
              }}
            />
          </div>
        ) : (
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, ease: EASE_OUT }}
            className="grid gap-5 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:items-start"
          >
            <IdentityCard user={user} />
            <div className="space-y-5">
              <ProfileForm user={user} />
              <PasswordForm />
            </div>
          </motion.div>
        )}
      </PageBody>
    </>
  );
}

/* ------------------------------------------------------------------ */

function IdentityCard({ user }: { user: UserRecord }) {
  return (
    <section className="panel p-5" aria-label="Data keanggotaan">
      <div className="flex items-start gap-3">
        <span
          className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-secondary font-display text-sm font-semibold text-white"
          aria-hidden
        >
          {initials(fact(user.fullName, '?'))}
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-base font-semibold text-foreground">
            {fact(user.fullName)}
          </h2>
          <p className="truncate text-xs text-muted-foreground">
            {fact(user.username)} · {fact(user.email)}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <RoleBadge role={user.role} />
            {user.status === 'active' ? (
              <Badge tone="success">Aktif</Badge>
            ) : user.status === 'inactive' ? (
              <Badge tone="danger">Nonaktif</Badge>
            ) : (
              <Badge tone="neutral">Status tidak tersedia</Badge>
            )}
          </div>
        </div>
      </div>

      <hr className="rule my-4" aria-hidden />

      {/* The code the desk scanner reads. Only meaningful for students; an
          admin account has no member code to print on a card. */}
      {user.memberCode && user.role === 'user' ? (
        <div className="mb-4 flex flex-col items-center gap-2 rounded-xl border border-border bg-background/40 p-4">
          <QrCode
            value={user.memberCode}
            caption={user.memberCode}
            label={`Kartu anggota ${user.fullName}`}
            size={148}
          />
          <p className="text-center text-2xs leading-relaxed text-muted-foreground">
            Tunjukkan kode ini di meja sirkulasi. Petugas memindainya untuk membuka data
            keanggotaan Anda tanpa mengetik.
          </p>
        </div>
      ) : null}

      <dl className="space-y-3">
        <FactRow icon={Hash} label="Kode anggota" value={fact(user.memberCode, 'Belum tersedia')} mono />
        <FactRow icon={User} label="Nama lengkap" value={fact(user.fullName)} />
        <FactRow icon={ShieldCheck} label="Username" value={fact(user.username)} mono />
        <FactRow icon={Mail} label="Email" value={fact(user.email)} />
        <FactRow icon={School} label="Kelas" value={fact(user.className)} />
        <FactRow icon={Phone} label="Nomor telepon" value={fact(user.phone)} />
        <FactRow icon={LogIn} label="Terakhir masuk" value={formatDateTime(user.lastLoginAt)} />
      </dl>

      <div className="mt-4 flex items-start gap-2 rounded-lg border border-border bg-background/40 p-3">
        <Info className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <p className="text-2xs leading-relaxed text-muted-foreground">
          Username, email, dan peran diisi serta dikelola oleh petugas perpustakaan, sehingga tidak
          dapat diubah dari halaman ini.
        </p>
      </div>
    </section>
  );
}

function FactRow({
  icon: Icon,
  label,
  value,
  mono = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <span
        className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"
        aria-hidden
      >
        <Icon className="size-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <dt className="text-2xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </dt>
        <dd
          className={cn(
            'break-words text-sm text-foreground',
            mono && 'font-mono text-xs font-semibold',
          )}
        >
          {value}
        </dd>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function ProfileForm({ user }: { user: UserRecord }) {
  const { setUser } = useAuth();

  const saveProfile = useApiMutation<ProfileValues, UserRecord>({
    mutationFn: async (values) => (await api.patch<UserRecord>('/auth/profile', values)).data,
    successMessage: 'Profil berhasil diperbarui.',
    onSuccess: (data) => {
      // The PATCH response is the full, freshly-read record: adopt it as the
      // new baseline so the form goes back to "nothing to save".
      setUser(data);
      reset({
        fullName: data.fullName ?? '',
        className: data.className ?? '',
        phone: data.phone ?? '',
      });
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: user.fullName ?? '',
      className: user.className ?? '',
      phone: user.phone ?? '',
    },
  });

  // `isDirty` compares the form against the values the server last confirmed,
  // so an unchanged form can never be submitted.
  const dirty = isDirty;

  const onSubmit = handleSubmit(async (values) => {
    try {
      await saveProfile.mutateAsync({
        fullName: values.fullName,
        className: values.className ?? '',
        phone: values.phone ?? '',
      });
    } catch {
      // useApiMutation already surfaced the server message in a toast.
    }
  });

  return (
    <section className="panel p-5" aria-label="Ubah profil">
      <header className="mb-4 flex items-start gap-3">
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-electric-soft text-primary"
          aria-hidden
        >
          <PencilLine className="size-4" />
        </span>
        <div>
          <h2 className="font-display text-base font-semibold text-foreground">Ubah Profil</h2>
          <p className="text-xs text-muted-foreground">
            Hanya data diri ini yang dapat Anda ubah. Perubahan langsung disimpan di server.
          </p>
        </div>
      </header>

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field
          label="Nama Lengkap"
          htmlFor="profile-fullName"
          error={errors.fullName?.message}
          required
        >
          <Input
            id="profile-fullName"
            autoComplete="name"
            placeholder="Nama sesuai identitas sekolah"
            aria-invalid={Boolean(errors.fullName)}
            {...register('fullName')}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Kelas" htmlFor="profile-className" error={errors.className?.message}>
            <Input
              id="profile-className"
              placeholder="XII RPL 1"
              aria-invalid={Boolean(errors.className)}
              {...register('className')}
            />
          </Field>

          <Field
            label="Nomor Telepon"
            htmlFor="profile-phone"
            error={errors.phone?.message}
            hint="Opsional, untuk keperluan pemberitahuan."
          >
            <Input
              id="profile-phone"
              inputMode="tel"
              placeholder="08xxxxxxxxxx"
              aria-invalid={Boolean(errors.phone)}
              {...register('phone')}
            />
          </Field>
        </div>

        <p className="text-2xs leading-relaxed text-muted-foreground">
          Username, email, kode anggota, dan peran dikelola petugas perpustakaan dan tidak dapat
          diubah dari halaman ini.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" size="md" loading={isSubmitting} disabled={!dirty}>
            {!isSubmitting ? <CheckCircle2 className="size-4" aria-hidden /> : null}
            Simpan perubahan
          </Button>
          {!dirty ? (
            <p className="text-2xs text-muted-foreground">
              Tidak ada perubahan yang perlu disimpan.
            </p>
          ) : null}
        </div>
      </form>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function PasswordForm() {
  const [show, setShow] = React.useState(false);

  const changePassword = useApiMutation<PasswordValues, void>({
    mutationFn: async (values) => {
      await api.post('/auth/change-password', values);
    },
    successMessage: 'Kata sandi berhasil diperbarui.',
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await changePassword.mutateAsync(values);
      reset();
      setShow(false);
    } catch {
      // useApiMutation already surfaced the server message in a toast.
    }
  });

  return (
    <section className="panel p-5" aria-label="Ubah kata sandi">
      <header className="mb-4 flex items-start gap-3">
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-warning-soft text-warning"
          aria-hidden
        >
          <KeyRound className="size-4" />
        </span>
        <div>
          <h2 className="font-display text-base font-semibold text-foreground">
            Ubah Kata Sandi
          </h2>
          <p className="text-xs text-muted-foreground">
            Gunakan kombinasi huruf dan angka, minimal 8 karakter.
          </p>
        </div>
      </header>

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field
          label="Kata Sandi Saat Ini"
          htmlFor="password-current"
          error={errors.currentPassword?.message}
          required
        >
          <Input
            id="password-current"
            type={show ? 'text' : 'password'}
            autoComplete="current-password"
            aria-invalid={Boolean(errors.currentPassword)}
            {...register('currentPassword')}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Kata Sandi Baru"
            htmlFor="password-new"
            error={errors.newPassword?.message}
            required
          >
            <div className="relative">
              <Input
                id="password-new"
                type={show ? 'text' : 'password'}
                autoComplete="new-password"
                className="pr-10"
                aria-invalid={Boolean(errors.newPassword)}
                {...register('newPassword')}
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                aria-label={show ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                aria-pressed={show}
                className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md p-2 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {show ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
              </button>
            </div>
          </Field>

          <Field
            label="Konfirmasi Kata Sandi Baru"
            htmlFor="password-confirm"
            error={errors.confirmPassword?.message}
            required
          >
            <Input
              id="password-confirm"
              type={show ? 'text' : 'password'}
              autoComplete="new-password"
              aria-invalid={Boolean(errors.confirmPassword)}
              {...register('confirmPassword')}
            />
          </Field>
        </div>

        <p className="flex items-start gap-2 rounded-lg border border-border bg-background/40 p-3 text-2xs leading-relaxed text-muted-foreground">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            Kata sandi hanya disimpan dalam bentuk terenkripsi (hash) dan tidak pernah dikirim
            kembali ke peramban, sehingga tidak dapat ditampilkan di halaman ini. Jika lupa, minta
            petugas mengatur ulang kata sandi.
          </span>
        </p>

        <Button type="submit" size="md" loading={isSubmitting}>
          {!isSubmitting ? <KeyRound className="size-4" aria-hidden /> : null}
          Perbarui kata sandi
        </Button>
      </form>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function ProfileSkeleton() {
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:items-start">
      <div className="panel space-y-4 p-5" role="status" aria-label="Memuat profil">
        <div className="flex items-center gap-3">
          <Skeleton className="size-12 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3 w-44" />
          </div>
        </div>
        <hr className="rule" aria-hidden />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="size-7 shrink-0 rounded-md" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-2.5 w-20" />
              <Skeleton className="h-3 w-36" />
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-5">
        {[0, 1].map((section) => (
          <div key={section} className="panel space-y-4 p-5" role="status" aria-label="Memuat formulir">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-10 w-full" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
            <Skeleton className="h-10 w-40" />
          </div>
        ))}
      </div>
    </div>
  );
}
