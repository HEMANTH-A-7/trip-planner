"use client";

const MAX_LENGTH = 2000;

// Controlled (value/onChange come from the parent) so the same component can
// restore a saved prompt on reload and be reused for the refinement-loop
// input, which needs its own value alongside the main one.
export default function TripForm({
  id = "trip-prompt",
  label = "Describe your trip",
  placeholder = "e.g. 4 days in Kyoto in April, mostly temples and food, budget-friendly, no early mornings",
  value,
  onChange,
  onSubmit,
  disabled,
  submitLabel = "Plan my trip",
  pendingLabel = "Planning…",
}) {
  function handleSubmit(e) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSubmit(trimmed);
  }

  function handleKeyDown(e) {
    // Cmd/Ctrl+Enter submits without leaving the textarea - plain Enter
    // stays a newline since trip descriptions are often multi-line.
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      handleSubmit(e);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-3">
      <label htmlFor={id} className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {label}
      </label>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        maxLength={MAX_LENGTH}
        rows={3}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full resize-none rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base text-zinc-900 shadow-sm outline-none transition focus-visible:border-zinc-500 focus-visible:ring-2 focus-visible:ring-zinc-300 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus-visible:border-zinc-500 dark:focus-visible:ring-zinc-700"
      />
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-zinc-400 dark:text-zinc-500">
          {value.length}/{MAX_LENGTH}
        </span>
        <button
          type="submit"
          disabled={disabled || !value.trim()}
          className="rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 dark:focus-visible:ring-offset-black"
        >
          {disabled ? pendingLabel : submitLabel}
        </button>
      </div>
    </form>
  );
}
