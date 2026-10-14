import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { AlertCircle, ArrowLeft, ArrowRight, BookOpen, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';
import { ApiError } from '@/lib/api';
import { EASE_OUT, introLine, introWordmark } from '@/lib/motion';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';

const registerSchema = z
  .object({
    fullName: z.string().trim().min(3, 'Nama lengkap minimal 3 karakter.').max(100),
    username: z
      .string()
      .trim()
      .min(3, 'Username minimal 3 karakter.')
      .max(50)
      .regex(/^[a-zA-Z0-9._-]+$/, 'Hanya huruf, angka, titik, garis bawah, atau strip.'),
    email: z.string().trim().toLowerCase().email('Format email tidak valid.'),
    className: z.string().trim().max(50).optional(),
    phone: z
      .string()
      .trim()
      .regex(/^[0-9+\-\s()]{8,30}$/, 'Nomor telepon tidak valid.')
      .optional()
      .or(z.literal('')),
    password: z
      .string()
      .min(8, 'Kata sandi minimal 8 karakter.')
      .max(72)
      .regex(/[A-Za-z]/, 'Kata sandi harus mengandung huruf.')
      .regex(/[0-9]/, 'Kata sandi harus mengandung angka.'),
    confirmPassword: z.string().min(1, 'Konfirmasi kata sandi wajib diisi.'),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Konfirmasi kata sandi tidak cocok.',
    path: ['confirmPassword'],
  });

type RegisterForm = z.infer<typeof registerSchema>;

export function RegisterPage() {
  const { register: signUp, login } = useAuth();
  const navigate = useNavigate();
  const reduce = useReducedMotion();

  const [showPassword, setShowPassword] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: '',
      username: '',
      email: '',
      className: '',
      phone: '',
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      const user = await signUp(values);
      setDone(user.memberCode ?? '');
      toast.success('Pendaftaran berhasil. Silakan masuk.');

      // Small pause so the success state is visible before navigating.
      setTimeout(async () => {
        try {
          await login(values.username, values.password);
          navigate('/perpustakaan', { replace: true });
        } catch {
          navigate('/masuk', { replace: true });
        }
      }, 900);
    } catch (err) {
      if (err instanceof ApiError) {
        setServerError(err.message);
        if (err.fields) {
          // Surface the first field error next to its input.
          const first = Object.values(err.fields)[0];
          if (first) setServerError(first);
        }
      } else {
        setServerError('Tidak dapat terhubung ke server.');
      }
    }
  });

  const password = getValues('password');

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      {/* Visual panel */}
      <section className="relative hidden overflow-hidden bg-navy-950 lg:block">
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(100% 80% at 20% 10%, hsl(248 62% 62% / 0.28) 0%, transparent 55%),' +
              'radial-gradient(90% 90% at 90% 90%, hsl(199 89% 52% / 0.22) 0%, transparent 55%),' +
              'linear-gradient(160deg, hsl(222 54% 9%), hsl(222 54% 6%))',
          }}
        />
        <div className="grain absolute inset-0 opacity-40" aria-hidden />

        <div className="relative flex h-full flex-col justify-between p-12">
          <motion.div
            variants={introWordmark}
            initial={reduce ? false : 'initial'}
            animate="animate"
            className="flex items-center gap-3"
          >
            <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-secondary shadow-glow">
              <BookOpen className="size-5 text-white" aria-hidden />
            </div>
            <span className="font-display text-xl font-semibold tracking-tight text-white">
              LUMEN
            </span>
          </motion.div>

          <motion.div
            variants={introLine}
            initial={reduce ? false : 'initial'}
            animate="animate"
            transition={{ delay: 0.25 }}
            className="max-w-md space-y-5"
          >
            <h2 className="font-display text-4xl font-semibold leading-tight text-white text-balance">
              Bergabunglah dengan komunitas pembaca sekolah.
            </h2>
            <ul className="space-y-3">
              {[
                'Pinjam buku langsung dari katalog digital',
                'Pantau status peminjaman secara transparan',
                'Ajukan pengembalian tanpa antre di loket',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-navy-muted">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </motion.div>

          <p className="text-2xs text-navy-subtle">
            Pendaftaran terbuka untuk siswa. Akun petugas dibuat oleh administrator perpustakaan.
          </p>
        </div>
      </section>

      {/* Form panel */}
      <section className="flex items-center justify-center bg-background px-5 py-10 sm:px-8">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EASE_OUT }}
          className="w-full max-w-[440px]"
        >
          <div className="mb-6 flex items-center gap-2.5 lg:hidden">
            <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-secondary">
              <BookOpen className="size-[18px] text-white" aria-hidden />
            </div>
            <span className="font-display text-lg font-semibold">LUMEN</span>
          </div>

          <Link
            to="/masuk"
            className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            Kembali ke halaman masuk
          </Link>

          <h1 className="font-display text-[26px] font-semibold tracking-tight">Daftar keanggotaan</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Isi data berikut untuk membuat akun siswa baru.
          </p>

          {done ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-6 rounded-xl border border-success/25 bg-success-soft p-5 text-center"
              role="status"
            >
              <CheckCircle2 className="mx-auto size-8 text-success" aria-hidden />
              <p className="mt-2 font-display text-lg font-semibold text-success">
                Pendaftaran berhasil
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Kode anggota Anda:{' '}
                <span className="font-mono font-semibold text-foreground">{done}</span>
              </p>
              <p className="mt-3 text-xs text-muted-foreground">Mengalihkan ke beranda...</p>
            </motion.div>
          ) : (
            <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
              {serverError ? (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  role="alert"
                  className="flex items-start gap-2 overflow-hidden rounded-lg border border-destructive/25 bg-destructive-soft px-3.5 py-3"
                >
                  <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
                  <p className="text-sm font-medium text-destructive">{serverError}</p>
                </motion.div>
              ) : null}

              <Field label="Nama Lengkap" htmlFor="fullName" error={errors.fullName?.message} required>
                <Input
                  id="fullName"
                  autoComplete="name"
                  placeholder="Nama sesuai identitas sekolah"
                  aria-invalid={Boolean(errors.fullName)}
                  {...register('fullName')}
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Username" htmlFor="username" error={errors.username?.message} required>
                  <Input
                    id="username"
                    autoComplete="username"
                    placeholder="mis. andira"
                    aria-invalid={Boolean(errors.username)}
                    {...register('username')}
                  />
                </Field>
                <Field label="Kelas" htmlFor="className" error={errors.className?.message}>
                  <Input id="className" placeholder="XII RPL 1" {...register('className')} />
                </Field>
              </div>

              <Field label="Email" htmlFor="email" error={errors.email?.message} required>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="nama@sekolah.sch.id"
                  aria-invalid={Boolean(errors.email)}
                  {...register('email')}
                />
              </Field>

              <Field
                label="Nomor Telepon"
                htmlFor="phone"
                error={errors.phone?.message}
                hint="Opsional, untuk keperluan pemberitahuan."
              >
                <Input id="phone" inputMode="tel" placeholder="08xxxxxxxxxx" {...register('phone')} />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Kata Sandi" htmlFor="password" error={errors.password?.message} required>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      className="pr-10"
                      aria-invalid={Boolean(errors.password)}
                      {...register('password')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                      className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md p-2 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </Field>

                <Field
                  label="Konfirmasi Kata Sandi"
                  htmlFor="confirmPassword"
                  error={errors.confirmPassword?.message}
                  required
                >
                  <Input
                    id="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    aria-invalid={Boolean(errors.confirmPassword)}
                    {...register('confirmPassword')}
                  />
                </Field>
              </div>

              {/* Live password strength feedback. */}
              {password ? (
                <div className="space-y-1.5">
                  <div className="flex gap-1" aria-hidden>
                    {[0, 1, 2, 3].map((i) => {
                      const score = passwordStrength(password);
                      return (
                        <span
                          key={i}
                          className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                            i < score ? strengthColor(score) : 'bg-muted'
                          }`}
                        />
                      );
                    })}
                  </div>
                  <p className="text-2xs text-muted-foreground">
                    Kekuatan kata sandi: {strengthLabel(passwordStrength(password))}
                  </p>
                </div>
              ) : null}

              <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
                {!isSubmitting ? (
                  <>
                    Buat akun
                    <ArrowRight className="size-4" aria-hidden />
                  </>
                ) : null}
              </Button>

              <p className="text-center text-2xs text-muted-foreground">
                Dengan mendaftar, Anda menyetujui ketentuan peminjaman perpustakaan sekolah.
              </p>
            </form>
          )}
        </motion.div>
      </section>
    </div>
  );
}

function passwordStrength(pw: string): number {
  let score = 0;
  if (pw.length >= 8) score += 1;
  if (pw.length >= 12) score += 1;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score += 1;
  if (/[0-9]/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score += 1;
  return Math.min(score, 4);
}

function strengthColor(score: number): string {
  if (score <= 1) return 'bg-destructive';
  if (score === 2) return 'bg-warning';
  if (score === 3) return 'bg-cyan';
  return 'bg-success';
}

function strengthLabel(score: number): string {
  return ['Sangat lemah', 'Lemah', 'Cukup', 'Kuat', 'Sangat kuat'][score];
}
