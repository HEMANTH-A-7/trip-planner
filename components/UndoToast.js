export default function UndoToast({ stopName, onUndo }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="animate-fade-in fixed inset-x-0 bottom-4 z-50 mx-auto flex w-fit max-w-[calc(100%-2rem)] items-center gap-3 rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm shadow-lg dark:border-zinc-700 dark:bg-zinc-800"
    >
      <span className="truncate text-zinc-700 dark:text-zinc-200">
        Removed &ldquo;{stopName}&rdquo;
      </span>
      <button
        type="button"
        onClick={onUndo}
        className="shrink-0 font-medium text-zinc-900 underline underline-offset-2 hover:text-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:text-zinc-50 dark:hover:text-zinc-300"
      >
        Undo
      </button>
    </div>
  );
}
