import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-border bg-card/70 p-6 shadow-[var(--shadow)] backdrop-blur-xl sm:p-8',
        className
      )}
    >
      <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-2">
          {eyebrow && (
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">{eyebrow}</p>
          )}
          <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{title}</h1>
          {description && (
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">{description}</p>
          )}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
