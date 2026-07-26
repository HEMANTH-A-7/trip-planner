// Shown in place of the generic spinner while the first generation streams
// in. Deliberately a raw-text preview rather than attempting to parse and
// render partial JSON as structured cards - incrementally repairing
// truncated JSON is fragile, and the validated ItinerarySchema pass (same as
// the non-streaming path) still runs on the complete text once the stream
// ends, so this is purely a "something is happening" view, not a shortcut
// around validation.
export default function StreamingPreview({ text }) {
  return (
    <div className="rounded-2xl border border-hairline bg-surface p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-ink-subtle">
        Generating…
      </p>
      <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap break-words font-mono text-xs text-ink-muted">
        {text}
        <span className="animate-pulse">▍</span>
      </pre>
    </div>
  );
}
