import { describe, expect, it } from "vitest";
import { applySchedule, readSchedule, withSchedule } from "./schedule";

const stop = (name, time) => ({ id: name, name, ...(time && { time }) });

// The exact day from the bug report: dragging the 08:00 stop down two slots
// left the day reading 11:30, 13:30, 08:00, 18:00.
const gizaDay = [
  stop("Giza Pyramid Complex", "08:00 AM"),
  stop("Great Sphinx of Giza", "11:30 AM"),
  stop("Grand Egyptian Museum", "01:30 PM"),
  stop("El Abou El Sid", "06:00 PM"),
];

const move = (from, to) => (stops) => {
  const next = [...stops];
  const [lifted] = next.splice(from, 1);
  next.splice(to, 0, lifted);
  return next;
};

describe("readSchedule", () => {
  it("reads times in slot order", () => {
    expect(readSchedule(gizaDay)).toEqual([
      "08:00 AM",
      "11:30 AM",
      "01:30 PM",
      "06:00 PM",
    ]);
  });

  it("keeps a hole for a stop with no time", () => {
    expect(readSchedule([stop("a", "09:00 AM"), stop("b")])).toEqual([
      "09:00 AM",
      undefined,
    ]);
  });
});

describe("withSchedule", () => {
  it("leaves the day in chronological order after a drag", () => {
    const result = withSchedule(gizaDay, move(0, 2));

    expect(result.map((s) => [s.name, s.time])).toEqual([
      ["Great Sphinx of Giza", "08:00 AM"],
      ["Grand Egyptian Museum", "11:30 AM"],
      ["Giza Pyramid Complex", "01:30 PM"],
      ["El Abou El Sid", "06:00 PM"],
    ]);
  });

  it("keeps the sequence identical no matter how the stops are permuted", () => {
    const schedule = readSchedule(gizaDay);
    for (const [from, to] of [
      [0, 3],
      [3, 0],
      [1, 2],
      [2, 1],
      [0, 1],
    ]) {
      expect(readSchedule(withSchedule(gizaDay, move(from, to)))).toEqual(
        schedule
      );
    }
  });

  it("shifts the remaining stops earlier when one is removed", () => {
    const result = withSchedule(gizaDay, (stops) =>
      stops.filter((s) => s.name !== "Great Sphinx of Giza")
    );

    expect(result.map((s) => [s.name, s.time])).toEqual([
      ["Giza Pyramid Complex", "08:00 AM"],
      ["Grand Egyptian Museum", "11:30 AM"],
      ["El Abou El Sid", "01:30 PM"],
    ]);
  });

  it("is a no-op when the order does not change", () => {
    expect(withSchedule(gizaDay, (stops) => stops)).toEqual(gizaDay);
  });

  it("preserves every field other than the time", () => {
    const rich = [
      { id: "1", name: "A", time: "08:00 AM", durationMinutes: 60, category: "food" },
      { id: "2", name: "B", time: "11:30 AM", estimatedCost: { amount: 20, currency: "USD" } },
    ];
    const [first, second] = withSchedule(rich, move(0, 1));

    expect(first).toEqual({
      id: "2",
      name: "B",
      time: "08:00 AM",
      estimatedCost: { amount: 20, currency: "USD" },
    });
    expect(second).toEqual({
      id: "1",
      name: "A",
      time: "11:30 AM",
      durationMinutes: 60,
      category: "food",
    });
  });
});

describe("applySchedule", () => {
  it("strips a stale time when the slot has none", () => {
    const [first, second] = applySchedule(
      [stop("a", "09:00 AM"), stop("b", "11:00 AM")],
      [undefined, "11:00 AM"]
    );

    expect(first).not.toHaveProperty("time");
    expect(second.time).toBe("11:00 AM");
  });

  it("drops times off stops past the end of the schedule", () => {
    const [, inserted] = applySchedule(
      [stop("a", "09:00 AM"), stop("new", "09:00 AM")],
      ["09:00 AM"]
    );

    expect(inserted).not.toHaveProperty("time");
  });

  it("returns the same object identity for untouched stops", () => {
    const stops = [stop("a", "09:00 AM")];
    expect(applySchedule(stops, ["09:00 AM"])[0]).toBe(stops[0]);
  });
});
