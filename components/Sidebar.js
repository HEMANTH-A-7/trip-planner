"use client";

import { CalendarDays, Compass, FileText, History, Plus, X } from "lucide-react";

const NAV_ITEMS = [
  { id: "itinerary", label: "Itinerary", icon: CalendarDays },
  { id: "summary", label: "Summary", icon: FileText },
];

function relativeDay(timestamp) {
  if (!timestamp) return null;
  const days = Math.floor((Date.now() - timestamp) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

// One responsive markup rather than a desktop and a mobile copy: below `lg`
// this is a header strip with the nav and days scrolling horizontally, at
// `lg` and up it becomes the fixed left rail from the reference design.
//
// Renders with or without a trip. Before one exists the nav and days sections
// are still shown - disabled and empty respectively - so the shape of the app
// is visible from the landing page rather than appearing out of nowhere.
export default function Sidebar({
  itinerary,
  view,
  onViewChange,
  selectedDayId,
  onSelectDay,
  onStartOver,
  history = [],
  activeTripId,
  onLoadTrip,
  onDeleteTrip,
}) {
  return (
    <aside className="border-b border-hairline bg-surface lg:sticky lg:top-0 lg:flex lg:h-[100dvh] lg:w-64 lg:shrink-0 lg:flex-col lg:border-b-0 lg:border-r">
      <div className="flex flex-col gap-4 p-4 lg:flex-1 lg:overflow-y-auto">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink"
            style={{
              background: "color-mix(in oklab, var(--accent-lavender) 25%, transparent)",
            }}
          >
            <Compass size={18} />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-semibold tracking-tight text-ink">
              Trip Planner
            </span>
            <span className="block truncate text-[11px] text-ink-subtle">
              Your AI trip concierge
            </span>
          </span>
        </div>

        <button
          type="button"
          onClick={onStartOver}
          className="flex items-center justify-center gap-2 rounded-xl border border-hairline-strong bg-surface-2 px-3 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-lavender"
        >
          <Plus size={16} aria-hidden />
          New trip
        </button>

        {history.length > 0 && (
          <div className="min-w-0">
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-ink-subtle">
              <History size={12} aria-hidden />
              Trip history
            </p>
            <ul className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:gap-0.5 lg:overflow-x-visible lg:pb-0">
              {history.map((trip) => {
                const active = trip.id === activeTripId;
                return (
                  <li key={trip.id} className="group/trip relative shrink-0 lg:shrink">
                    <button
                      type="button"
                      onClick={() => onLoadTrip(trip)}
                      aria-current={active ? "true" : undefined}
                      className={`w-full rounded-xl py-2 pl-3 pr-8 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-lavender ${
                        active
                          ? "bg-surface-2 text-ink"
                          : "text-ink-muted hover:bg-surface-2 hover:text-ink"
                      }`}
                    >
                      <span className="block truncate whitespace-nowrap text-sm font-medium">
                        {trip.destination}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-ink-subtle">
                        {[
                          relativeDay(trip.savedAt),
                          `${trip.itinerary.days.length} ${
                            trip.itinerary.days.length === 1 ? "day" : "days"
                          }`,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteTrip(trip.id)}
                      aria-label={`Remove "${trip.destination}" from history`}
                      className="absolute right-1 top-1 flex h-8 w-8 sm:right-1.5 sm:top-1.5 sm:h-6 sm:w-6 items-center justify-center rounded-lg text-ink-subtle transition hover:bg-danger-bg hover:text-danger focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger sm:opacity-0 sm:group-hover/trip:opacity-100"
                    >
                      <X size={13} aria-hidden />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <nav aria-label="Views" className="flex gap-2 lg:flex-col lg:gap-1">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
            const active = Boolean(itinerary) && view === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onViewChange(id)}
                disabled={!itinerary}
                aria-current={active ? "page" : undefined}
                className={`flex flex-1 items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-lavender disabled:cursor-not-allowed disabled:opacity-40 lg:flex-none ${
                  active
                    ? "bg-surface-2 text-ink"
                    : "text-ink-muted enabled:hover:bg-surface-2 enabled:hover:text-ink"
                }`}
              >
                <Icon size={16} aria-hidden className="shrink-0" />
                {label}
              </button>
            );
          })}
        </nav>

        <div className="min-w-0">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-ink-subtle">
            Days
          </p>
          {itinerary ? (
            /* Horizontal scroller on narrow screens, stacked list on the rail. */
            <ul className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:gap-0.5 lg:overflow-x-visible lg:pb-0">
              {itinerary.days.map((day) => {
                const active = day.id === selectedDayId && view === "itinerary";
                return (
                  <li key={day.id} className="shrink-0 lg:shrink">
                    <button
                      type="button"
                      onClick={() => onSelectDay(day.id)}
                      aria-current={active ? "true" : undefined}
                      className={`w-full rounded-xl px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-lavender ${
                        active
                          ? "bg-surface-2 text-ink"
                          : "text-ink-muted hover:bg-surface-2 hover:text-ink"
                      }`}
                    >
                      <span className="block whitespace-nowrap text-sm font-medium lg:whitespace-normal">
                        Day {day.day}
                        {day.title ? `: ${day.title}` : ""}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-ink-subtle">
                        {day.stops.length}{" "}
                        {day.stops.length === 1 ? "stop" : "stops"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-3 py-2 text-xs text-ink-subtle">
              Plan a trip to see its days here.
            </p>
          )}
        </div>
      </div>
    </aside>
  );
}
