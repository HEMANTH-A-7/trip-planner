// Shared between StopCard (badge labels) and the trip-overview chart, so the
// two don't drift out of sync with the category enum in lib/schema.js.
export const CATEGORY_LABELS = {
  food: "🍜 Food",
  sightseeing: "🏛️ Sightseeing",
  lodging: "🛏️ Lodging",
  transport: "🚆 Transport",
  activity: "🎟️ Activity",
  other: "📍 Other",
};

// Cycled deterministically from CATEGORY_LABELS' key order, so adding a
// category here never requires a second lookup table to stay in sync.
const ACCENT_CYCLE = [
  "var(--accent-peach)",
  "var(--accent-lavender)",
  "var(--accent-mint)",
  "var(--accent-gold)",
];

export const CATEGORY_COLORS = Object.fromEntries(
  Object.keys(CATEGORY_LABELS).map((key, i) => [key, ACCENT_CYCLE[i % ACCENT_CYCLE.length]])
);
