import { describe, expect, it } from "vitest";
import {
  applySchedule,
  formatTime,
  parseTime,
  readSchedule,
  withSchedule,
} from "./schedule";

const stop = (name, time, durationMinutes) => ({
  id: name,
  name,
  ...(time && { time }),
  ...(durationMinutes && { durationMinutes }),
});

// The day from the original bug report, now carrying the durations that let
// the schedule be rebuilt rather than re-pinned.
const gizaDay = [
  stop("Giza Pyramid Complex", "08:00 AM", 180), // 08:00 +180 -> 11:00, 30m gap
  stop("Great Sphinx of Giza", "11:30 AM", 60), //  11:30 +60  -> 12:30, 60m gap
  stop("Grand Egyptian Museum", "01:30 PM", 150), // 13:30 +150 -> 16:00, 120m gap
  stop("El Abou El Sid", "06:00 PM", 90),
];

const times = (stops) => stops.map((s) => s.time);

const move = (from, to) => (stops) => {
  const next = [...stops];
  const [lifted] = next.splice(from, 1);
  next.splice(to, 0, lifted);
  return next;
};

describe("parseTime", () => {
  it("reads both conventions the model writes in", () => {
    expect(parseTime("08:00 AM")).toBe(480);
    expect(parseTime("01:30 PM")).toBe(810);
    expect(parseTime("13:30")).toBe(810);
    expect(parseTime("8.30pm")).toBe(1230);
  });

  it("handles midnight and noon, where 12 means opposite things", () => {
    expect(parseTime("12:00 AM")).toBe(0);
    expect(parseTime("12:30 PM")).toBe(750);
  });

  it("rejects anything that isn't a time", () => {
    for (const value of ["", "morning", "25:00", "10:75", "1230", null, 42]) {
      expect(parseTime(value)).toBeNull();
    }
  });
});

describe("formatTime", () => {
  it("writes back in the convention it was given", () => {
    expect(formatTime(480, true)).toBe("08:00 AM");
    expect(formatTime(810, true)).toBe("01:30 PM");
    expect(formatTime(810, false)).toBe("13:30");
  });

  it("wraps rather than running past midnight", () => {
    expect(formatTime(1440 + 90, false)).toBe("01:30");
    expect(formatTime(-30, false)).toBe("23:30");
  });
});

describe("readSchedule", () => {
  it("derives each gap net of the stop's own duration", () => {
    // 11:30 - 08:00 is 210 minutes, of which 180 is the pyramids themselves.
    const plan = readSchedule(gizaDay);
    expect(plan.gaps).toEqual([30, 60, 120]);
    expect(plan.start).toBe(480);
    expect(plan.twelveHour).toBe(true);
  });

  it("never returns a negative gap, however the model wrote the day", () => {
    const overlapping = [stop("A", "09:00", 240), stop("B", "10:00", 60)];
    expect(readSchedule(overlapping).gaps).toEqual([0]);
  });
});

describe("withSchedule", () => {
  it("pushes the rest of the day later when a long stop moves earlier", () => {
    // The 150-minute museum moves from third to first. Everything after it
    // has to give way - the old slot-pinned behaviour claimed to fit it into
    // the pyramids' original window and left the rest of the day untouched.
    const next = withSchedule(gizaDay, move(2, 0));
    expect(next.map((s) => s.name)).toEqual([
      "Grand Egyptian Museum",
      "Giza Pyramid Complex",
      "Great Sphinx of Giza",
      "El Abou El Sid",
    ]);
    // 08:00 +150 museum +30 = 11:00; +180 pyramids +60 = 15:00;
    // +60 sphinx +120 = 18:00. The pyramids now finish at 14:00 rather than
    // 11:00, and the day's tail moves with them.
    expect(times(next)).toEqual([
      "08:00 AM",
      "11:00 AM",
      "03:00 PM",
      "06:00 PM",
    ]);
  });

  it("pulls the day in when a long stop moves later", () => {
    const next = withSchedule(gizaDay, move(0, 3));
    // 08:00 +60 +30 = 09:30; +150 +60 = 13:00; +90 +120 = 16:30.
    expect(times(next)).toEqual([
      "08:00 AM",
      "09:30 AM",
      "01:00 PM",
      "04:30 PM",
    ]);
  });

  it("always starts the day when the day started", () => {
    for (const [from, to] of [
      [0, 3],
      [3, 0],
      [1, 2],
      [2, 1],
    ]) {
      expect(withSchedule(gizaDay, move(from, to))[0].time).toBe("08:00 AM");
    }
  });

  it("keeps the day in chronological order however it is permuted", () => {
    for (const [from, to] of [
      [0, 3],
      [3, 0],
      [1, 2],
      [2, 0],
      [0, 2],
    ]) {
      const minutes = withSchedule(gizaDay, move(from, to)).map((s) =>
        parseTime(s.time),
      );
      expect(minutes).toEqual([...minutes].sort((a, b) => a - b));
    }
  });

  // The guarantee that makes this safe to ship: a day the model gave no
  // durations for behaves exactly as it did before any of this existed, with
  // each time pinned to its slot.
  it("falls back to pinning times to slots when no stop has a duration", () => {
    const noDurations = gizaDay.map(({ durationMinutes, ...rest }) => rest);
    expect(times(withSchedule(noDurations, move(0, 2)))).toEqual([
      "08:00 AM",
      "11:30 AM",
      "01:30 PM",
      "06:00 PM",
    ]);
  });

  it("shifts the remaining stops earlier when one is removed", () => {
    const next = withSchedule(gizaDay, (stops) => stops.slice(1));
    expect(next).toHaveLength(3);
    expect(next[0].time).toBe("08:00 AM");
    expect(parseTime(next[1].time)).toBeGreaterThan(parseTime(next[0].time));
  });

  it("preserves every field other than the time", () => {
    const rich = [
      {
        ...stop("A", "09:00", 60),
        category: "food",
        estimatedCost: { amount: 5, currency: "EUR" },
      },
      { ...stop("B", "11:00", 30), description: "kept" },
    ];
    const next = withSchedule(rich, move(0, 1));
    expect(next[0].description).toBe("kept");
    expect(next[1].category).toBe("food");
    expect(next[1].estimatedCost).toEqual({ amount: 5, currency: "EUR" });
  });

  it("writes a 24-hour day back in 24-hour time", () => {
    const day = [stop("A", "09:00", 60), stop("B", "11:00", 30)];
    expect(times(withSchedule(day, move(0, 1)))).toEqual(["09:00", "10:30"]);
  });
});

describe("applySchedule", () => {
  it("leaves a day the model gave no usable time alone", () => {
    const untimed = [stop("A", undefined, 60), stop("B", undefined, 30)];
    const next = applySchedule(untimed, readSchedule(untimed));
    expect(next.every((s) => s.time === undefined)).toBe(true);
  });

  it("strips a stale time when the day has no schedule left", () => {
    const next = applySchedule([stop("A", "09:00", 60)], {
      start: null,
      gaps: [],
    });
    expect("time" in next[0]).toBe(false);
  });

  it("returns the same object identity for stops whose time is unchanged", () => {
    const day = [stop("A", "09:00", 60), stop("B", "10:30", 30)];
    const next = applySchedule(day, readSchedule(day));
    expect(next[0]).toBe(day[0]);
    expect(next[1]).toBe(day[1]);
  });
});
