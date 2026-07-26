export default function ErrorState({ message, onRetry }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-2xl border border-danger/30 bg-danger-bg py-10 text-center"
    >
      <p className="max-w-sm text-sm text-danger">{message}</p>
      <button
        onClick={onRetry}
        className="rounded-full border border-danger/40 bg-surface px-4 py-1.5 text-sm font-medium text-danger transition hover:bg-danger-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger"
      >
        Try again
      </button>
    </div>
  );
}
