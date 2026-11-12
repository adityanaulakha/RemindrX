import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

type BadgeTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'accent';

const tones: Record<BadgeTone, string> = {
  neutral: 'bg-muted text-muted-foreground border-border',
  primary: 'bg-primary-soft text-primary border-primary/20',
  success: 'bg-success/15 text-success border-success/25',
  warning: 'bg-warning/15 text-warning border-warning/25',
  danger: 'bg-danger/15 text-danger border-danger/25',
  accent: 'bg-accent/15 text-accent border-accent/25',
};

export function Badge({
  className,
  tone = 'neutral',
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] font-semibold tracking-wide',
        tones[tone],
        className
      )}
      {...props}
    />
  );
}
