import * as React from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Library,
  Mail,
  ShieldQuestion,
} from 'lucide-react';
import { toast } from 'sonner';
import { ApiError, api } from '@/lib/api';
import { EASE_OUT } from '@/lib/motion';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const requestSchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(1, 'Username, email, atau kode anggota wajib diisi.')
    .max(120, 'Data terlalu panjang.'),
});

const resetSchema = z
  .object({
    token: z.string().trim().min(10, 'Token reset tidak valid.'),
    newPassword: z
      .string()
      .min(8, 'Kata sandi minimal 8 karakter.')
      .max(72)
      .regex(/[A-Za-z]/, 'Kata sandi harus mengandung huruf.')
      .regex(/[0-9]/, 'Kata sandi harus mengandung angka.'),
    confirmPassword: z.string().min(1, 'Konfirmasi kata sandi wajib diisi.'),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Konfirmasi kata sandi tidak cocok.',
    path: ['confirmPassword'],
  });

type RequestForm = z.infer<typeof requestSchema>;
type ResetForm = z.infer<typeof resetSchema>;

interface IssuedToken {
  token: string;
  expiresAt: string;
}

/**
 * Two-step password reset.
 *
 * This install has no mail server, so step one returns the token to the
 * browser and the UI shows it plainly with a copy button. The flow is written
 * as two steps anyway, because that is the shape it needs once mail exists:
 * only the "show the token" block would be replaced by "check your inbox".
 */
export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  // A token in the query string means the user pasted a reset link.
  const [step, setStep] = React.useState<'request' | 'reset'>(
    params.get('token') ? 'reset' : 'request',
  );
  const [issued, setIssued] = React.useState<IssuedToken | null>(null);
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [showPassword, setShowPassword] = React.useState(false);
  const [done, setDone] = React.useState(false);

  const requestForm = useForm<RequestForm>({
    resolver: zodResolver(requestSchema),
    defaultValues: { identifier: '' },
  });

  const resetForm = useForm<ResetForm>({
    resolver: zodResolver(resetSchema),
    defaultValues: {
      token: params.get('token') ?? '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const onRequest = requestForm.handleSubmit(async (values) => {
    setServerError(null);
    try {
      const res = await api.post<IssuedToken>('/auth/forgot-password', values);
      setIssued(res.data);
      resetForm.setValue('token', res.data.token);
      setStep('reset');
      toast.success('Token reset dibuat. Berlaku 30 menit.');
    } catch (err) {
      if (err instanceof ApiError) {
        setServerError(err.fields ? Object.values(err.fields)[0] ?? err.message : err.message);
      } else {
        setServerError('Tidak dapat terhubung ke server.');
      }
    }
  });

  const onReset = resetForm.handleSubmit(async (values) => {
    setServerError(null);
    try {
      await api.post('/auth/reset-password', values);
      setDone(true);
      toast.success('Kata sandi berhasil diganti.');
    } catch (err) {
      if (err instanceof ApiError) {
        setServerError(err.fields ? Object.values(err.fields)[0] ?? err.message : err.message);
      } else {
        setServerError('Tidak dapat terhubung ke server.');
      }
    }
  });

  const copyToken = async () => {
    if (!issued) return;
    try {
      await navigator.clipboard.writeText(issued.token);
      toast.success('Token disalin ke papan klip.');
    } catch {
      toast.error('Browser memblokir akses papan klip. Salin manual.');
    }
  };

  return (
    <div className="grid min-h-dvh place-items-center bg-background px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: EASE_OUT }}
        className="w-full max-w-md"
      >
        <Link
          to="/masuk"
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Kembali ke halaman masuk
        </Link>

        <div className="panel p-6 sm:p-8">
          <div className="mb-6 flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl bg-electric-soft text-primary">
              <Library className="size-5" aria-hidden />
            </span>
            <div>
              <p className="eyebrow">LUMEN</p>
              <h1 className="font-display text-xl font-semibold text-foreground">
                {done
                  ? 'Kata sandi diperbarui'
                  : step === 'request'
                    ? 'Lupa kata sandi'
                    : 'Buat kata sandi baru'}
              </h1>
            </div>
          </div>

          {serverError ? (
            <div
              role="alert"
              className="mb-4 flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive-soft px-3 py-2.5 text-xs text-destructive"
            >
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span>{serverError}</span>
            </div>
          ) : null}

          {/* ---------- Done ---------- */}
          {done ? (
            <div className="space-y-5">
              <div className="flex items-start gap-3 rounded-lg border border-success/25 bg-success-soft px-4 py-3">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
                <div>
                  <p className="text-sm font-semibold text-foreground">Kata sandi sudah diganti</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                    Semua sesi lama pada akun ini sudah tidak berlaku. Silakan masuk dengan kata
                    sandi baru Anda.
                  </p>
                </div>
              </div>
              <Button className="w-full" onClick={() => navigate('/masuk', { replace: true })}>
                Masuk sekarang
                <ArrowRight className="size-4" aria-hidden />
              </Button>
            </div>
          ) : step === 'request' ? (
            /* ---------- Step 1 ---------- */
            <form className="space-y-5" onSubmit={onRequest} noValidate>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Masukkan username, email, atau kode anggota yang terdaftar. Sistem akan membuat
                token reset sekali pakai yang berlaku 30 menit.
              </p>

              <Field
                label="Username / email / kode anggota"
                htmlFor="identifier"
                required
                error={requestForm.formState.errors.identifier?.message}
              >
                <div className="relative">
                  <Mail
                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                  <Input
                    id="identifier"
                    autoComplete="username"
                    autoFocus
                    placeholder="andira atau andira@sekolah.sch.id"
                    className="pl-9"
                    aria-invalid={requestForm.formState.errors.identifier ? true : undefined}
                    {...requestForm.register('identifier')}
                  />
                </div>
              </Field>

              <Button
                type="submit"
                className="w-full"
                loading={requestForm.formState.isSubmitting}
              >
                <ShieldQuestion className="size-4" aria-hidden />
                Buat token reset
              </Button>
            </form>
          ) : (
            /* ---------- Step 2 ---------- */
            <form className="space-y-5" onSubmit={onReset} noValidate>
              {issued ? (
                <div className="rounded-lg border border-primary/25 bg-electric-soft px-4 py-3">
                  <p className="text-xs font-semibold text-primary">Token reset Anda</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <code className="min-w-0 flex-1 truncate rounded border border-primary/20 bg-card px-2 py-1.5 font-mono text-xs text-foreground">
                      {issued.token}
                    </code>
                    <Button type="button" size="sm" variant="outline" onClick={copyToken}>
                      <Copy className="size-3.5" aria-hidden />
                      Salin
                    </Button>
                  </div>
                  <p className="mt-1.5 text-2xs text-primary/80">
                    Berlaku sampai {issued.expiresAt}. Jangan bagikan token ini kepada siapa pun.
                  </p>
                </div>
              ) : (
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Tempel token reset yang Anda terima, lalu tentukan kata sandi baru.
                </p>
              )}

              <Field
                label="Token reset"
                htmlFor="token"
                required
                error={resetForm.formState.errors.token?.message}
                hint="Token panjang berisi huruf dan angka."
              >
                <div className="relative">
                  <KeyRound
                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                  <Input
                    id="token"
                    autoComplete="one-time-code"
                    placeholder="Tempel token di sini"
                    className="pl-9 font-mono text-xs"
                    aria-invalid={resetForm.formState.errors.token ? true : undefined}
                    {...resetForm.register('token')}
                  />
                </div>
              </Field>

              <Field
                label="Kata sandi baru"
                htmlFor="newPassword"
                required
                error={resetForm.formState.errors.newPassword?.message}
                hint="Minimal 8 karakter, mengandung huruf dan angka."
              >
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    className="pr-10"
                    aria-invalid={resetForm.formState.errors.newPassword ? true : undefined}
                    {...resetForm.register('newPassword')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {showPassword ? (
                      <EyeOff className="size-4" aria-hidden />
                    ) : (
                      <Eye className="size-4" aria-hidden />
                    )}
                  </button>
                </div>
              </Field>

              <Field
                label="Ulangi kata sandi baru"
                htmlFor="confirmPassword"
                required
                error={resetForm.formState.errors.confirmPassword?.message}
              >
                <Input
                  id="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  aria-invalid={resetForm.formState.errors.confirmPassword ? true : undefined}
                  {...resetForm.register('confirmPassword')}
                />
              </Field>

              <Button type="submit" className="w-full" loading={resetForm.formState.isSubmitting}>
                Simpan kata sandi baru
              </Button>

              <button
                type="button"
                onClick={() => {
                  setStep('request');
                  setIssued(null);
                  setServerError(null);
                }}
                className={cn(
                  'w-full text-center text-xs font-medium text-muted-foreground underline-offset-2',
                  'hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                )}
              >
                Minta token baru
              </button>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-xs leading-relaxed text-muted-foreground">
          Tetap tidak bisa masuk? Hubungi petugas perpustakaan di sekolah untuk reset manual.
        </p>
      </motion.div>
    </div>
  );
}
