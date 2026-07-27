import { MapPin, Route, Wallet } from "lucide-react";
import { countStops, formatBudget, formatDistance, tripBudget } from "@/lib/tripStats";

// Three rollup tiles sitting above the itinerary. Per the stat-tile contract
// the value stays in the normal ink token (colour would imply an encoding
// that isn't there) and uses proportional figures, not tabular-nums - at this
// size tabular digits make a number like "120" look loose. Only the icon
// carries the accent.
//
// A tile whose stat is missing renders a dash instead of vanishing, so the
// row keeps the same three-column shape no matter what the model returned.
export default function TripSummary({ itinerary }) {
  const tiles = [
    {
      icon: MapPin,
      label: "Total stops",
      stat: { value: String(countStops(itinerary)), unit: null },
    },
    { icon: Route, label: "Distance", stat: formatDistance(itinerary.distanceKm) },
    // tripBudget(), not the raw model estimate: this re-derives from the
    // stops currently on the board, so removing or repricing a card moves
    // the number immediately.
    { icon: Wallet, label: "Est. budget", stat: formatBudget(tripBudget(itinerary)) },
  ];

  return (
    <dl className="grid grid-cols-3 gap-2 sm:gap-3">
      {tiles.map(({ icon: Icon, label, stat }) => (
        <div
          key={label}
          className="texture-dots panel relative isolate overflow-hidden rounded-[20px] p-4 sm:p-5"
        >
          <Icon aria-hidden size={17} className="text-accent" />
          {/* dt before dd in the DOM so it reads as "label, value" to a
              screen reader; column-reverse puts the number on top visually. */}
          <div className="mt-4 flex flex-col-reverse">
            <dt className="type-label mt-1.5 text-[10px] sm:text-[11px]">
              {label}
            </dt>
            {/* The reference reserves its warm gradient for exactly this:
                the one figure a tile exists to show. */}
            <dd className="type-display text-warm text-[26px] leading-none sm:text-[32px]">
              {stat ? (
                <>
                  {stat.value}
                  {stat.unit && (
                    <span className="ml-1 text-xs font-medium text-ink-muted">
                      {stat.unit}
                    </span>
                  )}
                </>
              ) : (
                <span className="text-ink-subtle" title="Not estimated for this trip">
                  &mdash;
                </span>
              )}
            </dd>
          </div>
        </div>
      ))}
    </dl>
  );
}
