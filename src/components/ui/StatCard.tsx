import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/cn';
import { Card } from './Card';

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'primary',
  className,
  onClick,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  tone?: 'primary' | 'success' | 'warning' | 'danger' | 'accent';
  className?: string;
  onClick?: () => void;
}) {
  const toneClass = {
    primary: 'bg-primary-soft text-primary',
    success: 'bg-success/15 text-success',
    warning: 'bg-warning/15 text-warning',
    danger: 'bg-danger/15 text-danger',
    accent: 'bg-accent/15 text-accent',
  }[tone];

  return (
    <Card
      interactive={Boolean(onClick)}
      className={cn('p-5', onClick && 'cursor-pointer', className)}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="truncate text-2xl font-semibold tracking-tight">{value}</p>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
        {Icon && (
          <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', toneClass)}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
    </Card>
  );
}
