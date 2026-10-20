import * as React from 'react';
import { Link, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { AlertCircle, ArrowRight, BookOpen, Eye, EyeOff, Library, Sparkles } from 'lucide-react';
import { useAuth, homePathFor } from '@/features/auth/AuthContext';
import { ApiError } from '@/lib/api';

import { EASE_OUT, introLine, introWordmark, staggerContainer, staggerItem } from '@/lib/motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const loginSchema = z.object({
  identifier: z.string().min(1, 'Username atau email wajib diisi.'),
  password: z.string().min(1, 'Kata sandi wajib diisi.'),
});

type LoginForm = z.infer<typeof loginSchema>;

/* ==================================================================
   Left panel: layered gradient + abstract 3D stack of books.
   CSS 3D only - no WebGL, no remote assets, no webfont requests.
   ================================================================== */

function BookStackScene() {
  const reduce = useReducedMotion();

  const books = [
    { w: 132, h: 168, hue: 224, x: -86, y: 40, z: -60, r: -9 },
    { w: 116, h: 152, hue: 248, x: -18, y: -22, z: 10, r: 4 },
    { w: 146, h: 176, hue: 199, x: 58, y: 28, z: 48, r: 12 },
  ];

  return (
    <div
      className="relative h-full w-full"
      style={{ perspective: '1100px', transformStyle: 'preserve-3d' }}
      aria-hidden
    >
      <div className="absolute inset-0 grid place-items-center">
        <div style={{ transformStyle: 'preserve-3d' }}>
          {books.map((b, i) => (
            <motion.div
              key={b.hue}
              initial={reduce ? false : { opacity: 0, y: 34, rotateX: 18 }}
              animate={
                reduce
                  ? { opacity: 1, y: b.y, rotateX: 0, rotateZ: b.r }
                  : { opacity: 1, y: b.y, rotateX: 0, rotateZ: b.r }
              }
              transition={{
                duration: 0.85,
                delay: reduce ? 0 : 0.25 + i * 0.11,
                ease: EASE_OUT,
              }}
              className="absolute"
              style={{
                width: b.w,
                height: b.h,
                transform: `translate3d(${b.x}px, ${b.y}px, ${b.z}px) rotateZ(${b.r}deg)`,
                transformStyle: 'preserve-3d',
              }}
            >
              <div
                className="size-full rounded-[5px] shadow-2xl"
                style={{
                  background: `linear-gradient(145deg,
                    hsl(${b.hue} 72% 58%),
                    hsl(${b.hue} 62% 38%))`,
                  boxShadow: '0 26px 50px -18px hsl(222 60% 4% / 0.75)',
                }}
              >
                {/* spine highlight */}
                <div className="absolute inset-y-0 left-0 w-[6px] rounded-l-[5px] bg-black/25" />
                <div className="absolute inset-0 rounded-[5px] bg-gradient-to-br from-white/20 to-transparent" />
                <div className="flex h-full flex-col justify-between p-3 pl-4">
                  <div className="h-[2px] w-10 rounded-full bg-white/45" />
                  <div className="space-y-1.5">
                    <div className="h-[3px] w-full rounded-full bg-white/30" />
                    <div className="h-[3px] w-4/5 rounded-full bg-white/25" />
                    <div className="h-[3px] w-2/3 rounded-full bg-white/20" />
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* ambient glow */}
      <div className="absolute left-1/2 top-1/2 size-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/20 blur-[90px]" />
    </div>
  );
}

/** Decorative shapes that drift slowly. Disabled under reduced motion. */
function AmbientShapes() {
  const reduce = useReducedMotion();
  if (reduce) return null;

  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden>
      <motion.div
        className="absolute -left-24 top-1/4 size-72 rounded-full border border-white/5"
        animate={{ y: [0, -22, 0], rotate: [0, 8, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -right-16 bottom-1/4 size-80 rounded-full border border-white/5"
        animate={{ y: [0, 20, 0], rotate: [0, -6, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute left-1/3 top-16 size-2 rounded-full bg-primary/40"
        animate={{ y: [0, -40, 0], opacity: [0.3, 0.8, 0.3] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
}

/* ================================================================== */

export function LoginPage() {
  const { login, user, status } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showPassword, setShowPassword] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const reduce = useReducedMotion();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: '', password: '' },
  });

  // Already signed in? Go straight through.
  if (status === 'authenticated' && user) {
    return <Navigate to={homePathFor(user.role)} replace />;
  }

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const signedIn = await login(values.identifier, values.password);
      toast.success(`Selamat datang, ${signedIn.fullName}.`);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from ?? homePathFor(signedIn.role), { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(err.message);
        // Field-level messages from Zod, if the server sent any.
        if (err.fields?.identifier) setFormError(err.fields.identifier);
      } else {
        setFormError('Tidak dapat terhubung ke server. Pastikan backend berjalan.');
      }
    }
  });

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      {/* ---------------- Visual panel ---------------- */}
      <section className="relative hidden overflow-hidden bg-navy-950 lg:block">
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(120% 90% at 10% 0%, hsl(224 100% 58% / 0.30) 0%, transparent 55%),' +
              'radial-gradient(90% 80% at 100% 100%, hsl(248 62% 62% / 0.26) 0%, transparent 60%),' +
              'linear-gradient(160deg, hsl(222 54% 8%) 0%, hsl(222 54% 6%) 100%)',
          }}
        />
        <div className="grain absolute inset-0 opacity-40" aria-hidden />
        <AmbientShapes />

        <div className="relative flex h-full flex-col justify-between p-10 xl:p-14">
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

          <div className="flex flex-1 items-center">
            <BookStackScene />
          </div>

          <motion.div
            variants={staggerContainer(0.08, 0.25)}
            initial={reduce ? false : 'hidden'}
            animate="show"
            className="max-w-lg space-y-4"
          >
            <motion.p variants={introLine} className="eyebrow text-primary/80">
              Perpustakaan Sekolah Digital
            </motion.p>
            <motion.h2
              variants={staggerItem}
              className="font-display text-4xl font-semibold leading-[1.12] tracking-tight text-white text-balance xl:text-5xl"
            >
              Setiap halaman adalah gerbang menuju pengetahuan.
            </motion.h2>
            <motion.p
              variants={staggerItem}
              className="max-w-md text-sm leading-relaxed text-navy-muted"
            >
              Kelola koleksi, proses peminjaman, dan pantau aktivitas perpustakaan
              dalam satu sistem yang terhubung langsung ke database sekolah.
            </motion.p>

            <motion.div variants={staggerItem} className="flex flex-wrap gap-2 pt-1">
              {[
                { icon: Library, label: 'Katalog Terpusat' },
                { icon: Sparkles, label: 'Pencarian Instan' },
                { icon: BookOpen, label: 'Peminjaman Online' },
              ].map(({ icon: Icon, label }) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-navy-muted backdrop-blur-sm"
                >
                  <Icon className="size-3.5 text-primary" aria-hidden />
                  {label}
                </span>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ---------------- Form panel ---------------- */}
      <section className="flex items-center justify-center bg-background px-5 py-10 sm:px-8">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EASE_OUT, delay: reduce ? 0 : 0.1 }}
          className="w-full max-w-[400px]"
        >
          {/* Mobile wordmark */}
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-secondary">
              <BookOpen className="size-[18px] text-white" aria-hidden />
            </div>
            <span className="font-display text-lg font-semibold tracking-tight">LUMEN</span>
          </div>

          <div className="mb-8 space-y-2">
            <h1 className="font-display text-[28px] font-semibold tracking-tight text-foreground">
              Masuk ke akun Anda
            </h1>
            <p className="text-sm text-muted-foreground">
              Gunakan username atau email yang terdaftar di perpustakaan.
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <AnimatePresence>
              {formError ? (
                <motion.div
                  initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                  animate={{ opacity: 1, height: 'auto', marginBottom: 4 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  transition={{ duration: 0.2 }}
                  role="alert"
                  className="flex items-start gap-2 overflow-hidden rounded-lg border border-destructive/25 bg-destructive-soft px-3.5 py-3"
                >
                  <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
                  <p className="text-sm font-medium text-destructive">{formError}</p>
                </motion.div>
              ) : null}
            </AnimatePresence>

            <div className="space-y-1.5">
              <Input
                id="identifier"
                aria-label="Username atau Email"
                autoComplete="username"
                placeholder="Username atau Email"
                aria-invalid={Boolean(errors.identifier)}
                aria-describedby={errors.identifier ? 'identifier-error' : undefined}
                {...register('identifier')}
              />
              {errors.identifier ? (
                <p className="text-xs font-medium text-destructive">{errors.identifier.message}</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Masukkan kata sandi"
                  className="pr-10"
                  aria-invalid={Boolean(errors.password)}
                  aria-describedby={errors.password ? 'password-error' : undefined}
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                  className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md p-2 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {errors.password ? (
                <p className="text-xs font-medium text-destructive">{errors.password.message}</p>
              ) : null}
              <div className="flex justify-end">
                <Link
                  to="/lupa-sandi"
                  className="rounded text-xs font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Lupa kata sandi?
                </Link>
              </div>
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full"
              loading={isSubmitting}
            >
              {!isSubmitting ? (
                <>
                  Masuk
                  <ArrowRight className="size-4" aria-hidden />
                </>
              ) : null}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Belum punya akun?{' '}
            <Link
              to="/daftar"
              className="font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            >
              Daftar sebagai siswa
            </Link>
          </p>

        </motion.div>
      </section>
    </div>
  );
}
