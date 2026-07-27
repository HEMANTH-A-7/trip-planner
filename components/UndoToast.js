export default function UndoToast({ stopName, onUndo }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="animate-fade-in fixed inset-x-0 bottom-4 z-50 mx-auto flex w-fit max-w-[calc(100%-2rem)] items-center gap-3 rounded-full border border-hairline-strong bg-surface px-4 py-2 text-sm shadow-lg"
    >
      <span className="truncate text-ink-muted">Removed &ldquo;{stopName}&rdquo;</span>
      <button
        type="button"
        onClick={onUndo}
        className="shrink-0 font-medium text-ink underline underline-offset-2 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        Undo
      </button>
    </div>
  );
}
