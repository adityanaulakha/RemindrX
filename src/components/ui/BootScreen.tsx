export function BootScreen({ label = 'Loading RemindrX' }: { label?: string }) {
  return (
    <div
      className="app-canvas flex min-h-screen flex-col items-center justify-center gap-5 p-8 text-foreground"
      role="status"
      aria-live="polite"
    >
      <div className="relative">
        <div className="absolute inset-0 rounded-2xl bg-primary/30 blur-xl motion-glow" />
        <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-card shadow-[var(--shadow-lg)] backdrop-blur-xl">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary/25 border-t-primary" />
        </div>
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold tracking-tight">RemindrX</p>
        <p className="mt-1 text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
