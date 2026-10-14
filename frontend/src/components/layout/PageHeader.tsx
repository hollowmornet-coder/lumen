import * as React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EASE_OUT, staggerContainer, staggerItem } from '@/lib/motion';

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  breadcrumb?: Array<{ label: string; to?: string }>;
  actions?: React.ReactNode;
  meta?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  breadcrumb,
  actions,
  meta,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn('border-b border-border bg-background/60 px-4 py-6 sm:px-6 lg:px-8', className)}>
      <div className="mx-auto w-full max-w-[1400px]">
        {breadcrumb && breadcrumb.length > 0 ? (
          <nav aria-label="Breadcrumb" className="mb-2">
            <ol className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
              {breadcrumb.map((crumb, i) => (
                <li key={`${crumb.label}-${i}`} className="flex items-center gap-1">
                  {i > 0 ? (
                    <ChevronRight className="size-3 opacity-50" aria-hidden />
                  ) : null}
                  {crumb.to ? (
                    <Link
                      to={crumb.to}
                      className="rounded transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="font-medium text-foreground" aria-current="page">
                      {crumb.label}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        ) : null}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <motion.div
            variants={staggerContainer(0.05)}
            initial="hidden"
            animate="show"
            className="min-w-0 space-y-1.5"
          >
            {eyebrow ? (
              <motion.p variants={staggerItem} className="eyebrow">
                {eyebrow}
              </motion.p>
            ) : null}
            <motion.h1
              variants={staggerItem}
              className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl"
            >
              {title}
            </motion.h1>
            {description ? (
              <motion.p
                variants={staggerItem}
                className="max-w-2xl text-sm text-muted-foreground text-pretty"
              >
                {description}
              </motion.p>
            ) : null}
            {meta ? (
              <motion.div variants={staggerItem} className="pt-1">
                {meta}
              </motion.div>
            ) : null}
          </motion.div>

          {actions ? (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, delay: 0.08, ease: EASE_OUT }}
              className="flex flex-wrap items-center gap-2"
            >
              {actions}
            </motion.div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Standard page body: max width + padding, so every page lines up. */
export function PageBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8', className)}>
      {children}
    </div>
  );
}
