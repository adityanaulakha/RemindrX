import { BrandMark } from '../BrandMark';

export function BootScreen({ label = 'Loading RemindrX' }: { label?: string }) {
  return (
    <div
      className="app-canvas flex min-h-screen flex-col items-center justify-center gap-5 p-8 text-foreground"
      role="status"
      aria-live="polite"
    >
      <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-card shadow-[var(--shadow)]">
        <BrandMark size={40} alt="" className="rounded-[20%]" />
        <span className="absolute -bottom-1 -right-1 h-4 w-4 animate-spin rounded-full border-2 border-primary/25 border-t-primary bg-card" />
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold tracking-tight">RemindrX</p>
        <p className="mt-1 text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
