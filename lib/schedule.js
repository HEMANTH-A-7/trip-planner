// A day's times are recomputed from its stops, not carried around by them.
//
// The model writes a day as a sequence — 08:00, 11:30, 13:30, 18:00 — where
// the spacing already accounts for how long each stop takes plus the travel
// and slack between them. Two different things are buried in those numbers,
// and a reorder has to treat them differently:
//
//   - how long a stop takes belongs to the *stop*, and travels with it
//   - the travel and slack between two positions belongs to the *slot*, and
//     stays where it is
//
// So a schedule is read as a start time plus a gap per slot, and re-applied
// by walking the day: each stop starts when the previous one finished, plus
// that slot's gap. Move a three-hour museum ahead of a coffee and everything
// after it genuinely moves later, which is the point — the old behaviour
// pinned times to slots, so a day could claim to fit three hours of museum
// into a thirty-minute window.
//
// The gap is derived rather than guessed. Nothing in the app knows the real
// travel time between two arbitrary places, but the model's own spacing is a
// reasonable estimate of it, and it's the only estimate available.
//
// It degrades exactly as it should: a stop with no duration contributes zero,
// so a day where the model gave no durations at all collapses to the previous
// behaviour of pinning each time to its slot.

const TIME_PATTERN = /^\s*(\d{1,2})[:.](\d{2})\s*([ap])\.?m\.?\s*$/i;
const TIME_PATTERN_24 = /^\s*(\d{1,2})[:.](\d{2})\s*$/;

const MINUTES_PER_DAY = 24 * 60;

// "08:30 AM" / "8.30pm" / "13:30" -> minutes since midnight, or null if this
// isn't a time at all. The model is asked for a time but can return anything.
export function parseTime(value) {
  if (typeof value !== "string") return null;

  const twelve = TIME_PATTERN.exec(value);
  if (twelve) {
    let hours = Number(twelve[1]);
    const minutes = Number(twelve[2]);
    if (hours < 1 || hours > 12 || minutes > 59) return null;
    if (hours === 12) hours = 0;
    if (twelve[3].toLowerCase() === "p") hours += 12;
    return hours * 60 + minutes;
  }

  const twentyFour = TIME_PATTERN_24.exec(value);
  if (twentyFour) {
    const hours = Number(twentyFour[1]);
    const minutes = Number(twentyFour[2]);
    if (hours > 23 || minutes > 59) return null;
    return hours * 60 + minutes;
  }

  return null;
}

// Rendered back in whichever convention the day was already written in, so a
// reorder never flips a 12-hour itinerary into 24-hour time halfway down.
export function formatTime(minutes, twelveHour) {
  const wrapped = ((Math.round(minutes) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hours24 = Math.floor(wrapped / 60);
  const mins = String(wrapped % 60).padStart(2, "0");

  if (!twelveHour) return `${String(hours24).padStart(2, "0")}:${mins}`;

  const meridiem = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${String(hours12).padStart(2, "0")}:${mins} ${meridiem}`;
}

const duration = (stop) =>
  Number.isFinite(stop?.durationMinutes) && stop.durationMinutes > 0
    ? stop.durationMinutes
    : 0;

// The plan for a day: when it starts, how it's written, and how much dead
// time sits after each slot. Gaps are clamped at zero - a model that writes
// overlapping stops shouldn't be able to run the day backwards.
export function readSchedule(stops) {
  const times = stops.map((stop) => parseTime(stop?.time));
  // The day begins when its first stop does. If the model skipped that one
  // time, the earliest it did write stands in - a day that starts slightly
  // wrong still reads in order, which a day with no times at all does not.
  const start = times.find((time) => time != null) ?? null;

  const gaps = [];
  for (let i = 0; i < stops.length - 1; i++) {
    const from = times[i];
    const to = times[i + 1];
    gaps.push(
      from == null || to == null ? null : Math.max(0, to - from - duration(stops[i])),
    );
  }

  return {
    start,
    // Written in the day's own convention, whatever the model chose.
    twelveHour: stops.some((stop) => TIME_PATTERN.test(stop?.time ?? "")),
    gaps,
  };
}

// The median of the gaps the model actually wrote, used wherever a slot has
// no gap of its own (the day grew, or a neighbouring time was unparseable).
// The median rather than the mean so one four-hour evening break doesn't drag
// every other transition out with it.
function typicalGap(gaps) {
  const known = gaps.filter((gap) => gap != null).sort((a, b) => a - b);
  if (known.length === 0) return 30;
  return known[Math.floor(known.length / 2)];
}

// Walks the day, giving every stop a start time. A day the model never gave a
// usable time to is left alone rather than being invented from nothing.
export function applySchedule(stops, plan) {
  if (!plan || plan.start == null) return clearTimes(stops);

  const fallbackGap = typicalGap(plan.gaps);
  let cursor = plan.start;

  return stops.map((stop, index) => {
    if (index > 0) {
      const previous = stops[index - 1];
      const gap = plan.gaps[index - 1] ?? fallbackGap;
      cursor += duration(previous) + gap;
    }
    const time = formatTime(cursor, plan.twelveHour);
    return stop.time === time ? stop : { ...stop, time };
  });
}

function clearTimes(stops) {
  return stops.map((stop) => {
    if (stop?.time == null) return stop;
    const { time: _dropped, ...rest } = stop;
    return rest;
  });
}

// Wraps a structural change (reorder, swap, remove) so the day's times are
// rebuilt around it. `mutate` receives the stops and returns the new list.
export function withSchedule(stops, mutate) {
  return applySchedule(mutate(stops), readSchedule(stops));
}
