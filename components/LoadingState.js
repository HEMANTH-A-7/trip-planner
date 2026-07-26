export default function LoadingState() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-hairline-strong py-12 text-center text-ink-muted"
    >
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-hairline-strong border-t-accent-lavender" />
      <p className="text-sm">Planning your trip… this can take a few seconds.</p>
    </div>
  );
}
