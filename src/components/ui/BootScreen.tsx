export function BootScreen({ label = 'Loading RemindrX' }: { label?: string }) {
  return (
    <div className="app-canvas flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-foreground" role="status" aria-live="polite">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-card shadow-[var(--shadow)]">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary/25 border-t-primary" />
      </div>
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
    </div>
  );
}
