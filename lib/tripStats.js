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

// What the stops currently on screen add up to. Recomputed from the days on
// every call, so it already reflects a removal, an edit or a reorder without
// anything having to invalidate it.
//
// Costs in a second currency are skipped rather than added: the model is told
// to use one currency per trip, and quietly summing EGP into USD would
// produce a confident, wrong number. Skipping understates the total instead,
// which the mixed-currency case makes visible rather than plausible.
export function sumStopCosts(itinerary) {
  let amount = 0;
  let currency = null;
  let counted = 0;

  for (const day of itinerary.days) {
    for (const stop of day.stops) {
      const cost = stop.estimatedCost;
      if (!cost || typeof cost.amount !== "number" || !Number.isFinite(cost.amount)) {
        continue;
      }
      currency ??= cost.currency;
      if (cost.currency !== currency) continue;
      amount += cost.amount;
      counted += 1;
    }
  }

  return counted > 0 ? { amount, currency } : null;
}

// The trip budget the tile shows. The model's estimate covers the whole trip
// — lodging, food, transport, entry fees — while the stop costs only cover
// the stops it listed. Subtracting one from the other at generation time
// (see buildBudgetBaseline in lib/schema.js) leaves the part that isn't tied
// to any particular stop, which is held constant while the stop-driven part
// tracks the actual cards. Deleting a EGP 1,200 museum drops the budget by
// exactly EGP 1,200; the hotel doesn't get cheaper because of it.
//
// Falls back to the flat model estimate when there's no baseline to work
// from — an itinerary saved by an older build, or one where the model gave a
// budget but no per-stop costs.
export function tripBudget(itinerary) {
  const baseline = itinerary.budgetBaseline;
  if (!baseline || typeof baseline.nonStopAmount !== "number") {
    return itinerary.estimatedBudget ?? null;
  }

  const stopTotal = sumStopCosts(itinerary);
  if (!stopTotal) {
    return { amount: baseline.nonStopAmount, currency: baseline.currency };
  }
  if (stopTotal.currency !== baseline.currency) {
    return itinerary.estimatedBudget ?? null;
  }

  return {
    amount: baseline.nonStopAmount + stopTotal.amount,
    currency: baseline.currency,
  };
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

// The stop a day is really built around: the longest one. Days used to render
// as a wall of identical blocks, where a three-hour museum looked exactly like
// a twenty-minute coffee even though the duration was sitting right there in
// the data. Marking one - and only one - gives the day a focal point without
// making every card a different size.
//
// Ties go to the earlier stop, so the marker doesn't jump around as a day is
// reordered. A day with nothing to compare, or no durations at all, gets no
// anchor rather than an arbitrary one.
export function mainStopId(stops) {
  if (!Array.isArray(stops) || stops.length < 2) return null;

  let best = null;
  for (const stop of stops) {
    const minutes = stop?.durationMinutes;
    if (!Number.isFinite(minutes) || minutes <= 0) continue;
    if (!best || minutes > best.minutes) best = { id: stop.id, minutes };
  }
  return best?.id ?? null;
}
