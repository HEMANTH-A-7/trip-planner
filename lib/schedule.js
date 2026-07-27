// A day's start times belong to its *slots*, not to the stops sitting in
// them. The model writes a day as a sequence — 08:00, 11:30, 13:30, 18:00 —
// with the gaps between them already accounting for travel and how long each
// activity runs. When a stop is dragged to a different position, what the
// traveler means is "do this one third instead of first", not "keep doing it
// at 8am but list it further down". Left alone, the time rides along with the
// stop and the day stops reading in chronological order.
//
// So: snapshot the sequence before a structural change, re-pin it afterwards.
// Slot 0 keeps the day's first start time whichever stop ends up there.
//
// The trade-off is that a slot's time doesn't stretch to fit a longer stop
// moved into it — swapping a 30-minute coffee for a 3-hour museum leaves the
// following slots where they were. Recomputing them from durations would need
// the travel time between two arbitrary places, which nothing in the app
// knows. Keeping the model's own spacing is the honest approximation, and it
// guarantees the one property the day must have: times that read in order.

export function readSchedule(stops) {
  return stops.map((stop) => stop.time);
}

// Re-pins each stop to the time of the slot it now occupies. A schedule
// longer than the stop list (a stop was removed) just has its tail ignored,
// which shifts the remaining stops earlier — the day ends sooner rather than
// leaving a hole where the removed stop was.
export function applySchedule(stops, schedule) {
  return stops.map((stop, index) => {
    const time = schedule[index];

    // A slot with no time (the model omitted it, or the list grew past the
    // snapshot) must clear any time the stop carried in, otherwise a moved
    // stop reintroduces exactly the stale-time bug this module exists to fix.
    if (time == null) {
      if (stop.time == null) return stop;
      const { time: _dropped, ...rest } = stop;
      return rest;
    }

    return stop.time === time ? stop : { ...stop, time };
  });
}

// Wraps a structural change (reorder, swap, remove) so the day's sequence
// survives it. `mutate` receives the stops and returns the reordered list.
export function withSchedule(stops, mutate) {
  return applySchedule(mutate(stops), readSchedule(stops));
}
