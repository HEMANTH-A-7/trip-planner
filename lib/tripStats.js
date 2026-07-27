// Rollups behind the three summary tiles above the itinerary.
//
// Every formatter returns null rather than a placeholder string when the
// underlying data is missing or nonsense - deciding how a gap looks is the
// tile's job, not the formatter's. distanceKm and estimatedBudget are model
// estimates and genuinely optional (see lib/schema.js), so "missing" is a
// normal case here, not an error.

export function countStops(itinerary) {
  return itinerary.days.reduce((total, day) => total + day.stops.length, 0);
}

// Returns { value, unit } so the tile can typeset the unit smaller than the
// number, the way "120 km" reads in the reference design.
export function formatDistance(distanceKm) {
  if (typeof distanceKm !== "number" || !Number.isFinite(distanceKm) || distanceKm <= 0) {
    return null;
  }
  // Below 10km rounding to a whole number throws away too much (3.4 -> "3");
  // above it the decimal is noise at this type size.
  const value =
    distanceKm < 10
      ? distanceKm.toFixed(1)
      : Math.round(distanceKm).toLocaleString("en-US");
  return { value, unit: "km" };
}

export function formatDuration(minutes) {
  if (typeof minutes !== "number" || !Number.isFinite(minutes) || minutes <= 0) {
    return null;
  }
  const whole = Math.round(minutes);
  const hours = Math.floor(whole / 60);
  const rest = whole % 60;
  if (hours === 0) return `${rest} min`;
  if (rest === 0) return `${hours} hr`;
  return `${hours} hr ${rest} min`;
}

// Per-stop cost. Unlike the trip budget, zero is a real answer here - plenty
// of stops (a viewpoint, a park) genuinely cost nothing, and saying so is
// more useful than leaving the chip off.
export function formatStopCost(cost) {
  if (!cost || typeof cost.amount !== "number" || !Number.isFinite(cost.amount)) {
    return null;
  }
  if (cost.amount <= 0) return "Free";
  return formatBudget(cost)?.value ?? null;
}

export function formatBudget(budget) {
  if (!budget || typeof budget.amount !== "number" || !Number.isFinite(budget.amount)) {
    return null;
  }

  const rounded = Math.round(budget.amount);
  const { currency } = budget;

  // Models answer with either an ISO code ("JPY") or a bare symbol ("$").
  // Only the former is something Intl can turn into a properly placed,
  // properly grouped currency string - anything else gets prefixed as-is
  // rather than guessing at a symbol lookup table.
  //
  // The alpha-3 test isn't cosmetic: Intl throws a RangeError on anything
  // that isn't a well-formed currency code. A well-formed code it doesn't
  // recognise is fine - per ECMA-402 it just prints the code itself in place
  // of a symbol - so this guard is the only check needed.
  if (typeof currency === "string" && /^[a-z]{3}$/i.test(currency)) {
    return {
      value: new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currency.toUpperCase(),
        maximumFractionDigits: 0,
      }).format(rounded),
      unit: null,
    };
  }

  const prefix = typeof currency === "string" ? currency : "";
  return { value: `${prefix}${rounded.toLocaleString("en-US")}`, unit: null };
}
