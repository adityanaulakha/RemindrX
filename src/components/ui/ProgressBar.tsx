import { cn } from '../../lib/cn';

export function ProgressBar({
  value,
  className,
  tone,
}: {
  value: number;
  className?: string;
  tone?: 'auto' | 'primary' | 'success' | 'warning' | 'danger';
}) {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  const autoTone =
    clamped >= 75 ? 'bg-success' : clamped >= 60 ? 'bg-warning' : 'bg-danger';
  const bar =
    tone === 'primary'
      ? 'bg-primary'
      : tone === 'success'
        ? 'bg-success'
        : tone === 'warning'
          ? 'bg-warning'
          : tone === 'danger'
            ? 'bg-danger'
            : autoTone;

  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-muted', className)}>
      <div
        className={cn('h-full rounded-full transition-all duration-700 ease-out', bar)}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
