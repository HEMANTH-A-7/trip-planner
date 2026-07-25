export default function ErrorState({ message, onRetry }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-xl border border-red-200 bg-red-50 py-10 text-center dark:border-red-900/50 dark:bg-red-950/30"
    >
      <p className="max-w-sm text-sm text-red-700 dark:text-red-300">{message}</p>
      <button
        onClick={onRetry}
        className="rounded-full border border-red-300 bg-white px-4 py-1.5 text-sm font-medium text-red-700 transition hover:bg-red-100 dark:border-red-800 dark:bg-transparent dark:text-red-300 dark:hover:bg-red-950/50"
      >
        Try again
      </button>
    </div>
  );
}
