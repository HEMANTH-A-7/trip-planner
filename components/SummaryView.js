"use client";

import TripSummary from "./TripSummary";
import TripOverviewChart from "./TripOverviewChart";

const CHIP_LIMIT = 3;

// The overview half of the app: the rollup tiles, the category chart, and a
// day-at-a-glance list that doubles as navigation - picking a day here drops
// you onto that day's cards, same as picking it in the sidebar.
export default function SummaryView({ itinerary, onSelectDay }) {
  return (
    <div className="animate-fade-in flex flex-col gap-8">
      <section>
        <h2 className="type-heading mb-3.5 text-[20px] text-ink">
          Trip overview
        </h2>
        <TripSummary itinerary={itinerary} />
      </section>

      <section>
        <TripOverviewChart itinerary={itinerary} />
      </section>

      <section>
        <h2 className="type-heading mb-3.5 text-[20px] text-ink">
          Day at a glance
        </h2>
        <ul className="flex flex-col gap-2">
          {itinerary.days.map((day) => {
            const shown = day.stops.slice(0, CHIP_LIMIT);
            const remaining = day.stops.length - shown.length;
            return (
              <li key={day.id}>
                <button
                  type="button"
                  onClick={() => onSelectDay(day.id)}
                  className="panel flex w-full items-start gap-3.5 rounded-[20px] p-4 text-left transition-colors hover:border-hairline-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <span
                    aria-hidden
                    className="type-figure flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-hairline bg-surface-2 text-[11px] font-medium text-accent"
                  >
                    {day.day}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="type-heading block text-[15px] text-ink">
                      {day.title || `Day ${day.day}`}
                    </span>
                    {shown.length > 0 ? (
                      <span className="mt-2 flex flex-wrap gap-1.5">
                        {shown.map((stop) => (
                          <span
                            key={stop.id}
                            className="max-w-full truncate rounded-full border border-hairline bg-surface-2 px-2.5 py-1 text-[11px] text-ink-muted"
                          >
                            {stop.name}
                          </span>
                        ))}
                        {remaining > 0 && (
                          <span className="rounded-full px-2 py-1 text-[11px] text-ink-subtle">
                            +{remaining} more
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="mt-1 block text-xs text-ink-subtle">
                        No stops left for this day.
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
