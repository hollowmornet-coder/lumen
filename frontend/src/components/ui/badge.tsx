import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-2xs font-semibold tracking-wide transition-colors duration-200 [&_svg]:size-3',
  {
    variants: {
      tone: {
        neutral: 'border-border bg-muted text-muted-foreground',
        info: 'border-primary/20 bg-electric-soft text-primary',
        violet: 'border-secondary/20 bg-violet-soft text-secondary',
        cyan: 'border-cyan/25 bg-cyan-soft text-cyan',
        success: 'border-success/25 bg-success-soft text-success',
        warning: 'border-warning/25 bg-warning-soft text-warning',
        danger: 'border-destructive/25 bg-destructive-soft text-destructive',
        outline: 'border-border bg-transparent text-muted-foreground',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

/* ------------------------------------------------------------------
   Domain badges. Colour is a function of status, never decorative.
   ------------------------------------------------------------------ */

export type LoanTone = 'info' | 'success' | 'warning' | 'danger' | 'neutral' | 'violet';

const LOAN_STATUS: Record<string, { label: string; tone: LoanTone }> = {
  pending: { label: 'Menunggu', tone: 'warning' },
  approved: { label: 'Disetujui', tone: 'info' },
  rejected: { label: 'Ditolak', tone: 'neutral' },
  borrowed: { label: 'Dipinjam', tone: 'info' },
  return_requested: { label: 'Minta Kembali', tone: 'violet' },
  returned: { label: 'Selesai', tone: 'success' },
  cancelled: { label: 'Dibatalkan', tone: 'neutral' },
  overdue: { label: 'Terlambat', tone: 'danger' },
};

export function LoanStatusBadge({ status }: { status: string }) {
  const meta = LOAN_STATUS[status] ?? { label: status, tone: 'neutral' as LoanTone };
  return (
    <Badge tone={meta.tone}>
      <span
        className="size-1.5 rounded-full bg-current"
        aria-hidden
      />
      {meta.label}
    </Badge>
  );
}

export function BookStatusBadge({ status }: { status: string }) {
  return status === 'active' ? (
    <Badge tone="success">Aktif</Badge>
  ) : (
    <Badge tone="neutral">Nonaktif</Badge>
  );
}

export function StockBadge({ available, total }: { available: number; total: number }) {
  if (available === 0) {
    return <Badge tone="danger">Stok Habis</Badge>;
  }
  if (available <= Math.max(1, Math.floor(total / 3))) {
    return <Badge tone="warning">Sisa {available}</Badge>;
  }
  return <Badge tone="success">Tersedia {available}</Badge>;
}

export function RoleBadge({ role }: { role: string }) {
  return role === 'admin' ? (
    <Badge tone="violet">Petugas</Badge>
  ) : (
    <Badge tone="outline">Siswa</Badge>
  );
}

export { badgeVariants };
