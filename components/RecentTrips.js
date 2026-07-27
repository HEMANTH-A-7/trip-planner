"use client";

import { MapPin, X } from "lucide-react";

// Trip history for the landing page. The sidebar carries this list once a
// trip is open, but the landing has no sidebar - without this section a saved
// trip would be unreachable the moment you hit "New trip", so the same data
// gets a second home here, below the fold like the reference design's
// "recent" strip.
export default function RecentTrips({ history, onLoadTrip, onDeleteTrip }) {
  if (history.length === 0) return null;

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-8">
      <h2 className="text-lg font-semibold tracking-tight text-ink">
        Recent trips
      </h2>
      <p className="mt-1 text-sm text-ink-muted">
        Pick up where you left off — these are stored on this device, and
        reopening one costs nothing.
      </p>

      <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {history.map((trip) => (
          <li key={trip.id} className="group/trip relative">
            <button
              type="button"
              onClick={() => onLoadTrip(trip)}
              className="w-full rounded-2xl border border-hairline bg-surface p-4 pr-10 text-left transition-colors hover:border-hairline-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-lavender"
            >
              <span className="flex items-center gap-2">
                <MapPin
                  size={14}
                  aria-hidden
                  className="shrink-0 text-accent-peach"
                />
                <span className="min-w-0 truncate font-medium text-ink">
                  {trip.destination}
                </span>
              </span>
              <span className="mt-2 block text-xs text-ink-subtle">
                {trip.itinerary.days.length}{" "}
                {trip.itinerary.days.length === 1 ? "day" : "days"} ·{" "}
                {trip.itinerary.days.reduce((n, d) => n + d.stops.length, 0)}{" "}
                stops
              </span>
            </button>
            <button
              type="button"
              onClick={() => onDeleteTrip(trip.id)}
              aria-label={`Remove "${trip.destination}" from history`}
              className="absolute right-1.5 top-1.5 flex h-8 w-8 sm:right-2 sm:top-2 sm:h-7 sm:w-7 items-center justify-center rounded-lg text-ink-subtle transition hover:bg-danger-bg hover:text-danger focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger sm:opacity-0 sm:group-hover/trip:opacity-100"
            >
              <X size={14} aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
