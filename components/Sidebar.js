"use client";

import { CalendarDays, Compass, FileText, History, Plus, X } from "lucide-react";
import EdgeScroller from "./EdgeScroller";

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
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-hairline bg-surface-2 text-accent"
          >
            <Compass size={17} />
          </span>
          <span className="min-w-0">
            <span className="type-heading block truncate text-[15px] text-ink">
              Trip Planner
            </span>
            <span className="block truncate text-[11px] text-ink-subtle">
              Your AI trip concierge
            </span>
          </span>
        </div>

        {/* The reference's primary action: a solid pill, ink on canvas. */}
        <button
          type="button"
          onClick={onStartOver}
          className="pill-active flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
        >
          <Plus size={16} aria-hidden />
          New trip
        </button>

        {/* A segmented control, not a third pill list. Three stacked groups of
            identical pills gave trip history the same weight as the day
            navigation; this is a mode switch and should look like one. */}
        <nav
          aria-label="Views"
          className="flex gap-1 rounded-full border border-hairline bg-surface-2 p-1"
        >
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
            const active = Boolean(itinerary) && view === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onViewChange(id)}
                disabled={!itinerary}
                aria-current={active ? "page" : undefined}
                className={`flex flex-1 items-center justify-center gap-2 rounded-full px-3 py-2 text-[13.5px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-40 ${
                  active
                    ? "pill-active"
                    : "text-ink-subtle enabled:hover:text-ink"
                }`}
              >
                <Icon size={15} aria-hidden className="shrink-0" />
                {label}
              </button>
            );
          })}
        </nav>

        <div className="min-w-0">
          <p className="type-label mb-2.5 text-ink-muted">Days</p>
          {itinerary ? (
            /* Horizontal scroller on narrow screens, stacked list on the rail.
               EdgeScroller adds the faded chevron that tells a phone user the
               row keeps going; it takes itself off at `lg`, where the list
               stacks and there's no overflow left to point at. */
            <EdgeScroller className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:gap-0.5 lg:overflow-x-visible lg:pb-0">
              {itinerary.days.map((day) => {
                const active = day.id === selectedDayId && view === "itinerary";
                return (
                  <li key={day.id} className="shrink-0 lg:shrink">
                    <button
                      type="button"
                      onClick={() => onSelectDay(day.id)}
                      aria-current={active ? "true" : undefined}
                      className={`w-full rounded-[18px] px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                        active
                          ? "pill-active"
                          : "text-ink-muted hover:bg-surface-2 hover:text-ink"
                      }`}
                    >
                      <span className="type-heading block whitespace-nowrap text-[15px] lg:whitespace-normal">
                        Day {day.day}
                        {day.title ? `: ${day.title}` : ""}
                      </span>
                      <span
                        className={`type-figure mt-0.5 block text-[11px] ${
                          active ? "opacity-55" : "text-ink-subtle"
                        }`}
                      >
                        {day.stops.length}{" "}
                        {day.stops.length === 1 ? "stop" : "stops"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </EdgeScroller>
          ) : (
            <p className="px-3 py-2 text-xs text-ink-subtle">
              Plan a trip to see its days here.
            </p>
          )}
        </div>
        {history.length > 0 && (
          <div className="min-w-0">
            <p className="type-label mb-2.5 flex items-center gap-1.5">
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
                      className={`w-full rounded-full py-1.5 pl-3 pr-8 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                        active
                          ? "bg-surface-2 text-ink"
                          : "text-ink-subtle hover:bg-surface-2 hover:text-ink-muted"
                      }`}
                    >
                      <span className="block truncate whitespace-nowrap text-[13px] font-medium">
                        {trip.destination}
                      </span>
                      <span
                        className={`mt-0.5 block text-[11px] ${
                          active ? "opacity-55" : "text-ink-subtle"
                        }`}
                      >
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

      </div>
    </aside>
  );
}
