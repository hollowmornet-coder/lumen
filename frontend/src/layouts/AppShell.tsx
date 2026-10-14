import * as React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Bell,
  BookMarked,
  BookOpen,
  ChevronLeft,
  ClipboardList,
  FileSpreadsheet,
  LayoutDashboard,
  Library,
  LogOut,
  Menu,
  Search,
  Settings,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';
import { api } from '@/lib/api';
import { cn, initials } from '@/lib/utils';
import { collapseVariants, EASE_OUT, sidebarVariants, springSoft } from '@/lib/motion';
import { Button } from '@/components/ui/button';

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  end?: boolean;
}

const ADMIN_NAV: NavItem[] = [
  { to: '/admin', label: 'Dasbor', icon: LayoutDashboard, end: true },
  { to: '/admin/transaksi', label: 'Transaksi', icon: ClipboardList },
  { to: '/admin/buku', label: 'Kelola Buku', icon: BookOpen },
  { to: '/admin/anggota', label: 'Kelola Anggota', icon: Users },
  { to: '/katalog/seri', label: 'Katalog Seri', icon: Library },
  { to: '/admin/laporan', label: 'Laporan', icon: FileSpreadsheet },
  { to: '/admin/aktivitas', label: 'Aktivitas', icon: ShieldCheck },
  { to: '/admin/pengaturan', label: 'Pengaturan', icon: Settings },
];

const MEMBER_NAV: NavItem[] = [
  { to: '/perpustakaan', label: 'Beranda', icon: LayoutDashboard, end: true },
  { to: '/katalog', label: 'Katalog Buku', icon: BookMarked },
  { to: '/katalog/seri', label: 'Katalog Seri', icon: Library },
  { to: '/perpustakaan/pinjaman', label: 'Pinjaman Saya', icon: ClipboardList },
  { to: '/perpustakaan/riwayat', label: 'Riwayat', icon: BookOpen },
  { to: '/perpustakaan/profil', label: 'Profil', icon: Users },
];

/* ------------------------------------------------------------------ */

function Wordmark({ collapsed }: { collapsed: boolean }) {
  return (
    <div className="flex items-center gap-2.5 overflow-hidden">
      <div className="relative flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-secondary shadow-glow">
        <BookOpen className="size-[18px] text-white" aria-hidden />
        <span className="absolute inset-0 animate-pulse-ring rounded-xl border border-primary/50" aria-hidden />
      </div>
      <AnimatePresence initial={false}>
        {!collapsed ? (
          <motion.span
            key="wordmark"
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -6 }}
            transition={springSoft}
            className="font-display text-lg font-semibold tracking-tight text-white"
          >
            LUMEN
          </motion.span>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function SidebarNav({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const { isAdmin } = useAuth();
  const items = isAdmin ? ADMIN_NAV : MEMBER_NAV;

  return (
    <nav className="flex-1 space-y-0.5 px-3" aria-label="Navigasi utama">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          title={collapsed ? item.label : undefined}
          className={({ isActive }) =>
            cn(
              'group relative flex items-center gap-3 rounded-lg py-2.5 pl-4 pr-3 text-sm font-medium transition-colors duration-200',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary',
              isActive
                ? 'bg-white/12 font-semibold text-white'
                : 'text-navy-muted hover:bg-white/8 hover:text-white',
            )
          }
        >
          {({ isActive }) => (
            <>
              {/* Active indicator, flush with the sidebar edge. */}
              {isActive ? (
                <motion.span
                  layoutId="nav-indicator"
                  transition={springSoft}
                  className="absolute -left-3 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-primary"
                  aria-hidden
                />
              ) : null}
              <item.icon
                className={cn(
                  'size-[18px] shrink-0 transition-transform duration-200 group-hover:scale-110',
                  isActive ? 'text-primary' : 'text-navy-subtle group-hover:text-navy-muted',
                )}
                aria-hidden
              />
              {!collapsed ? <span className="truncate">{item.label}</span> : null}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

/* ------------------------------------------------------------------ */

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [profileOpen, setProfileOpen] = React.useState(false);
  const [notificationsOpen, setNotificationsOpen] = React.useState(false);
  const profileRef = React.useRef<HTMLDivElement>(null);

  // Collapse automatically on medium screens, expand on large ones.
  React.useEffect(() => {
    const mq = window.matchMedia('(min-width: 1280px)');
    const apply = () => setCollapsed(!mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  // Close the mobile drawer whenever the route changes.
  React.useEffect(() => setMobileOpen(false), [location.pathname]);

  // Dismiss the profile menu on outside click / Escape.
  React.useEffect(() => {
    if (!profileOpen) return;
    const onClick = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setProfileOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [profileOpen]);

  const handleLogout = async () => {
    await logout();
    navigate('/masuk', { replace: true });
  };

  return (
    <div className="min-h-dvh bg-background">
      {/* Static ambient wash - gives the glass layers something to refract.
          Fixed and non-animated so it never triggers a full-screen repaint. */}
      <div className="lumen-canvas" aria-hidden />

      {/* ---------- Desktop sidebar ---------- */}
      <motion.aside
        variants={sidebarVariants}
        animate={collapsed ? 'collapsed' : 'expanded'}
        initial={false}
        className="fixed inset-y-0 left-0 z-40 hidden flex-col overflow-hidden border-r border-white/5 bg-navy-950 md:flex"
      >        <div className="grain pointer-events-none absolute inset-0 opacity-[0.35]" aria-hidden />

        <div className="relative flex h-16 shrink-0 items-center border-b border-white/5 px-4">
          <Wordmark collapsed={collapsed} />
        </div>

        <div className="relative flex min-h-0 flex-1 flex-col py-4">
          <SidebarNav collapsed={collapsed} />
        </div>

        <div className="relative border-t border-white/5 p-3">
          <Button
            variant="ghost"
            size={collapsed ? 'icon' : 'sm'}
            onClick={() => setCollapsed((c) => !c)}
            className={cn(
              'text-navy-muted hover:bg-white/8 hover:text-white',
              !collapsed && 'w-full justify-start gap-3',
            )}
            aria-label={collapsed ? 'Perluas sidebar' : 'Ciutkan sidebar'}
          >
            <ChevronLeft
              className={cn('size-4 transition-transform duration-300', collapsed && 'rotate-180')}
              aria-hidden
            />
            {!collapsed ? <span>Ciutkan</span> : null}
          </Button>
        </div>
      </motion.aside>

      {/* ---------- Mobile drawer ---------- */}
      <AnimatePresence>
        {mobileOpen ? (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 z-40 bg-navy-950/50 md:hidden"
              aria-hidden
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={springSoft}
              className="fixed inset-y-0 left-0 z-50 flex w-[272px] flex-col bg-navy-950 md:hidden"
            >
              <div className="flex h-16 items-center justify-between border-b border-white/5 px-4">
                <Wordmark collapsed={false} />
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="rounded-md p-1.5 text-navy-muted hover:bg-white/8 hover:text-white focus-visible:ring-2 focus-visible:ring-primary"
                  aria-label="Tutup menu"
                >
                  <X className="size-4" />
                </button>
              </div>
              <div className="flex min-h-0 flex-1 flex-col py-4">
                <SidebarNav collapsed={false} onNavigate={() => setMobileOpen(false)} />
              </div>
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>

      {/* ---------- Main column ---------- */}
      <div
        className={cn(
          'flex min-h-dvh flex-col transition-[padding] duration-300 ease-out',
          collapsed ? 'md:pl-[76px]' : 'md:pl-[272px]',
        )}
      >
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-border/60 bg-background/70 px-4 backdrop-blur-xl backdrop-saturate-150 sm:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Buka menu"
          >
            <Menu />
          </Button>

          <GlobalSearch />

          <div className="ml-auto flex items-center gap-1.5">
            <NotificationBell
              open={notificationsOpen}
              onOpenChange={setNotificationsOpen}
              isAdmin={isAdmin}
            />

            <div className="relative" ref={profileRef}>
              <button
                type="button"
                onClick={() => setProfileOpen((o) => !o)}
                aria-expanded={profileOpen}
                aria-haspopup="menu"
                className="flex items-center gap-2 rounded-lg px-1.5 py-1 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary text-xs font-semibold text-white">
                  {initials(user?.fullName ?? '?')}
                </span>
                <span className="hidden text-left leading-tight sm:block">
                  <span className="block text-sm font-medium text-foreground">
                    {user?.fullName}
                  </span>
                  <span className="block text-2xs text-muted-foreground">
                    {isAdmin ? 'Petugas Perpustakaan' : user?.className ?? 'Siswa'}
                  </span>
                </span>
              </button>

              <AnimatePresence>
                {profileOpen ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.96, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98, y: -2 }}
                    transition={{ duration: 0.16, ease: EASE_OUT }}
                    role="menu"
                    className="absolute right-0 top-full z-50 mt-2 w-56 origin-top-right overflow-hidden rounded-xl border border-border bg-card p-1.5 shadow-lift"
                  >
                    <div className="px-3 py-2">
                      <p className="truncate text-sm font-medium">{user?.fullName}</p>
                      <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                    </div>
                    <div className="my-1 h-px bg-border" />
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setProfileOpen(false);
                        navigate(isAdmin ? '/admin/pengaturan' : '/perpustakaan/profil');
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Settings className="size-4 text-muted-foreground" aria-hidden />
                      {isAdmin ? 'Pengaturan' : 'Profil Saya'}
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-left text-destructive transition-colors hover:bg-destructive-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <LogOut className="size-4" aria-hidden />
                      Keluar
                    </button>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </div>
        </header>

        <main className="flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.26, ease: EASE_OUT }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function GlobalSearch() {
  const navigate = useNavigate();
  const [term, setTerm] = React.useState('');

  // Cmd/Ctrl+K opens the search field.
  React.useEffect(() => {
    const input = document.getElementById('global-search') as HTMLInputElement | null;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        input?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(`/katalog?q=${encodeURIComponent(term)}`);
  };

  return (
    <form onSubmit={submit} className="relative w-full max-w-md" role="search">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <input
        id="global-search"
        type="search"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder="Cari judul, penulis, ISBN..."
        aria-label="Pencarian global"
        className="h-9 w-full rounded-lg border border-border bg-card pl-9 pr-14 text-sm shadow-xs transition-[border-color,box-shadow] focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
      />
      <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:block">
        Ctrl K
      </kbd>
    </form>
  );
}

function NotificationBell({
  open,
  onOpenChange,
  isAdmin,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  isAdmin: boolean;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const data = usePendingCount(isAdmin);

  React.useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOpenChange(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onOpenChange(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onOpenChange]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        aria-label={data && data.count > 0 ? `Notifikasi, ${data.count} baru` : 'Notifikasi'}
        className="relative rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Bell className="size-4" aria-hidden />
        {data && data.count > 0 ? (
          <motion.span
            key={data.count}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={springSoft}
            className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-semibold text-white"
          >
            {data.count > 9 ? '9+' : data.count}
          </motion.span>
        ) : null}
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -2 }}
            transition={{ duration: 0.16, ease: EASE_OUT }}
            className="absolute right-0 top-full z-50 mt-2 w-72 origin-top-right overflow-hidden rounded-xl border border-border bg-card shadow-lift"
          >
            <div className="border-b border-border px-4 py-2.5">
              <p className="text-sm font-medium">Notifikasi</p>
            </div>
            <div className="p-2">
              {!data || data.count === 0 ? (
                <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                  Tidak ada hal yang perlu ditindaklanjuti.
                </p>
              ) : (
                <ul className="space-y-1">
                  {(data?.items ?? []).map((n) => (
                    <li
                      key={n.key}
                      className="flex items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-sm"
                    >
                      <span className="text-foreground">{n.label}</span>
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary tabular-nums">
                        {n.value}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/** Small hook so the bell always reflects real backend counters. */
function usePendingCount(isAdmin: boolean) {
  const { user } = useAuth();
  const enabled = Boolean(user);
  const [state, setState] = React.useState<{ count: number; items: Array<{ key: string; label: string; value: number }> } | null>(null);

  React.useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const load = async () => {
      try {
        const items: Array<{ key: string; label: string; value: number }> = [];
        let count = 0;

        if (isAdmin) {
          const res = await api.get<{
            pendingApprovals: number;
            returnRequests: number;
            overdueLoans: number;
          }>('/dashboard/admin/overview');
          const d = res.data;
          if (d.pendingApprovals > 0) {
            items.push({ key: 'pending', label: 'Permohonan menunggu', value: d.pendingApprovals });
          }
          if (d.returnRequests > 0) {
            items.push({ key: 'returns', label: 'Pengembalian masuk', value: d.returnRequests });
          }
          if (d.overdueLoans > 0) {
            items.push({ key: 'overdue', label: 'Peminjaman terlambat', value: d.overdueLoans });
          }
        } else {
          const res = await api.get<{
            pendingRequests: number;
            returnRequested: number;
            overdueLoans: number;
          }>('/dashboard/member/overview');
          const d = res.data;
          if (d.pendingRequests > 0) {
            items.push({ key: 'pending', label: 'Permohonan diproses', value: d.pendingRequests });
          }
          if (d.returnRequested > 0) {
            items.push({ key: 'returns', label: 'Menunggu verifikasi', value: d.returnRequested });
          }
          if (d.overdueLoans > 0) {
            items.push({ key: 'overdue', label: 'Peminjaman terlambat', value: d.overdueLoans });
          }
        }

        count = items.reduce((sum, i) => sum + i.value, 0);
        if (!cancelled) setState({ count, items });
      } catch {
        // Notifications are non-critical; a failure just shows an empty bell.
        if (!cancelled) setState(null);
      }
    };

    void load();
    const timer = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [enabled, isAdmin]);

  return state;
}

export { collapseVariants };
