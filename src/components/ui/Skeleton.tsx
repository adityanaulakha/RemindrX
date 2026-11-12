import { cn } from '../../lib/cn';

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('shimmer rounded-2xl bg-muted/70', className)} />;
}

export function PageSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-6 page-enter" aria-hidden>
      <Skeleton className="h-36 w-full" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-40" />
        ))}
      </div>
    </div>
  );
}
