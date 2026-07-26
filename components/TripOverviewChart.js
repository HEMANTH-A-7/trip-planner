import { CATEGORY_LABELS } from "@/lib/categories";

// A single-series magnitude comparison (stop count per category), so per the
// data-viz method this gets one accent hue rather than a categorical palette
// - color isn't encoding identity across series here, just "how much". Value
// is labeled directly at the tip of each bar rather than relying on a shared
// axis, since there are only ever a handful of categories.
function computeCategoryCounts(itinerary) {
  const counts = new Map();
  for (const day of itinerary.days) {
    for (const stop of day.stops) {
      const key = stop.category ?? "other";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);
}

export default function TripOverviewChart({ itinerary }) {
  const rows = computeCategoryCounts(itinerary);
  if (rows.length === 0) return null;
  const max = Math.max(...rows.map((r) => r.count));

  return (
    <figure className="rounded-2xl border border-hairline bg-surface p-4">
      <figcaption className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-subtle">
        Stops by category
      </figcaption>
      <ul className="flex flex-col gap-2">
        {rows.map(({ category, count }) => (
          <li
            key={category}
            className="grid grid-cols-[8.5rem_1fr_1.5rem] items-center gap-2 text-sm"
            aria-label={`${CATEGORY_LABELS[category] ?? category}: ${count}`}
          >
            <span className="truncate text-ink-muted">
              {CATEGORY_LABELS[category] ?? category}
            </span>
            <span aria-hidden className="h-5 rounded-full bg-surface-2">
              <span
                className="block h-full rounded-full bg-accent-lavender"
                style={{ width: `${(count / max) * 100}%` }}
              />
            </span>
            <span aria-hidden className="text-right text-ink-muted tabular-nums">
              {count}
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
