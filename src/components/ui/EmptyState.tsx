import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/40 px-6 py-16 text-center backdrop-blur-xl',
        className
      )}
    >
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-primary-soft text-primary shadow-[var(--shadow)]">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
      {description && (
        <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
