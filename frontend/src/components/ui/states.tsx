import * as React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Inbox, RefreshCw, SearchX } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EASE_OUT } from '@/lib/motion';
import { Button } from './button';

/** Illustrated empty state with an optional next action. */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: EASE_OUT }}
      className={cn(
        'flex flex-col items-center justify-center gap-3 px-6 py-14 text-center',
        className,
      )}
    >
      <div className="relative">
        <div className="absolute inset-0 -z-10 rounded-full bg-electric/10 blur-2xl" aria-hidden />
        <div className="flex size-14 items-center justify-center rounded-2xl border border-border bg-muted/60">
          <Icon className="size-6 text-muted-foreground" aria-hidden />
        </div>
      </div>
      <div className="space-y-1">
        <h3 className="font-display text-base font-semibold text-foreground">{title}</h3>
        {description ? (
          <p className="mx-auto max-w-sm text-sm text-muted-foreground text-pretty">
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </motion.div>
  );
}

/** Empty state specialised for "your filters matched nothing". */
export function NoResultsState({
  onReset,
  description = 'Tidak ada data yang cocok dengan filter atau kata kunci pencarian.',
}: {
  onReset?: () => void;
  description?: string;
}) {
  return (
    <EmptyState
      icon={SearchX}
      title="Tidak ada hasil"
      description={description}
      action={
        onReset ? (
          <Button variant="outline" size="sm" onClick={onReset}>
            <RefreshCw className="size-3.5" />
            Atur ulang filter
          </Button>
        ) : undefined
      }
    />
  );
}

/** Error state that always offers a retry. */
export function ErrorState({
  title = 'Gagal memuat data',
  message,
  onRetry,
  className,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center gap-3 px-6 py-12 text-center',
        className,
      )}
    >
      <div className="flex size-12 items-center justify-center rounded-2xl border border-destructive/20 bg-destructive-soft">
        <AlertTriangle className="size-5 text-destructive" aria-hidden />
      </div>
      <div className="space-y-1">
        <h3 className="font-display text-base font-semibold text-foreground">{title}</h3>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">
          {message ?? 'Terjadi kesalahan saat menghubungi server. Silakan coba lagi.'}
        </p>
      </div>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="size-3.5" />
          Coba lagi
        </Button>
      ) : null}
    </div>
  );
}
