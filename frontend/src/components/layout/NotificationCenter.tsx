import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, BellOff, CheckCheck, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useApiMutation, useNotifications, useUnreadNotifications } from '@/hooks/useApi';
import { cn, formatDateTime } from '@/lib/utils';
import { EASE_OUT, springSoft } from '@/lib/motion';
import { Button } from '@/components/ui/button';
import type { Notification } from '@/types';

const INVALIDATE = [['notifications']] as const;

/** Notification types get a colour so the list can be scanned, not read. */
function toneOf(type: string): string {
  if (type.startsWith('fine.')) return 'bg-destructive';
  if (type.startsWith('reservation.')) return 'bg-secondary';
  if (type === 'loan.overdue') return 'bg-destructive';
  if (type === 'loan.due_soon') return 'bg-warning';
  if (type === 'loan.renewed') return 'bg-cyan';
  return 'bg-primary';
}

/**
 * In-app notification centre.
 *
 * Replaces the old bell, which only ever showed aggregate counters from the
 * dashboard. This one lists real messages the member can act on: approvals,
 * due-date reminders, fines, and reservation holds.
 *
 * Unread state lives on the server, so the badge is the same on every device
 * and survives a refresh. The count is polled, the list is fetched on open.
 */
export function NotificationCenter() {
  const navigate = useNavigate();
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  const unread = useUnreadNotifications();
  const list = useNotifications({ pageSize: 12 }, open);

  const markAll = useApiMutation<void, { unread: number }>({
    mutationFn: async () => (await api.post<{ unread: number }>('/notifications/read-all')).data,
    successMessage: 'Semua notifikasi ditandai terbaca.',
    invalidate: INVALIDATE,
  });

  const markOne = useApiMutation<number, { unread: number }>({
    mutationFn: async (id) => (await api.post<{ unread: number }>(`/notifications/${id}/read`)).data,
    invalidate: INVALIDATE,
  });

  const remove = useApiMutation<number, { unread: number }>({
    mutationFn: async (id) => (await api.delete<{ unread: number }>(`/notifications/${id}`)).data,
    invalidate: INVALIDATE,
  });

  // Dismiss on outside click / Escape.
  React.useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const count = unread.data ?? 0;
  const items = list.data?.items ?? [];

  const openItem = (n: Notification) => {
    if (!n.readAt) void markOne.mutate(n.id);
    setOpen(false);
    if (n.link) navigate(n.link);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={count > 0 ? `Notifikasi, ${count} belum dibaca` : 'Notifikasi'}
        className="relative rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Bell className="size-4" aria-hidden />
        {count > 0 ? (
          <motion.span
            key={count}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={springSoft}
            className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-4 text-white"
          >
            {count > 9 ? '9+' : count}
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
            role="dialog"
            aria-label="Notifikasi"
            className="absolute right-0 top-full z-50 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] origin-top-right overflow-hidden rounded-xl border border-border bg-card shadow-lift"
          >
            <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-medium">Notifikasi</p>
                <p className="text-2xs text-muted-foreground">
                  {count > 0 ? `${count} belum dibaca` : 'Semua sudah terbaca'}
                </p>
              </div>
              {count > 0 ? (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={markAll.isPending}
                  onClick={() => markAll.mutate()}
                  className="shrink-0"
                >
                  <CheckCheck className="size-3.5" aria-hidden />
                  Tandai semua
                </Button>
              ) : null}
            </header>

            <div className="max-h-[24rem] overflow-y-auto scrollbar-thin">
              {list.isLoading ? (
                <div className="space-y-2 p-3" role="status" aria-label="Memuat notifikasi">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-14 rounded-lg skeleton" />
                  ))}
                </div>
              ) : items.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
                  <BellOff className="size-6 text-muted-foreground" aria-hidden />
                  <p className="text-sm font-medium text-foreground">Belum ada notifikasi</p>
                  <p className="text-xs text-muted-foreground">
                    Pengingat jatuh tempo, persetujuan, dan denda akan muncul di sini.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {items.map((n) => (
                    <li key={n.id} className="group relative">
                      <button
                        type="button"
                        onClick={() => openItem(n)}
                        className={cn(
                          'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                          !n.readAt && 'bg-electric-soft/40',
                        )}
                      >
                        <span
                          className={cn('mt-1.5 size-2 shrink-0 rounded-full', toneOf(n.type))}
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1 pr-6">
                          <span className="flex items-baseline justify-between gap-2">
                            <span
                              className={cn(
                                'truncate text-sm',
                                n.readAt ? 'font-medium text-foreground' : 'font-semibold text-foreground',
                              )}
                            >
                              {n.title}
                            </span>
                          </span>
                          {n.body ? (
                            <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                              {n.body}
                            </span>
                          ) : null}
                          <span className="mt-1 block text-2xs text-muted-foreground/80">
                            {formatDateTime(n.createdAt)}
                          </span>
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => remove.mutate(n.id)}
                        aria-label={`Hapus notifikasi: ${n.title}`}
                        className="absolute right-2 top-2 rounded-md p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-destructive focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100"
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                      </button>
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
