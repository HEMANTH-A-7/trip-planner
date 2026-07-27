import { describe, expect, it } from "vitest";
import {
  countStops,
  formatBudget,
  formatDistance,
  formatDuration,
  formatStopCost,
} from "./tripStats";

describe("formatDuration", () => {
  it.each([
    [45, "45 min"],
    [60, "1 hr"],
    [90, "1 hr 30 min"],
    [120, "2 hr"],
    [185, "3 hr 5 min"],
  ])("formats %i minutes as %s", (input, expected) => {
    expect(formatDuration(input)).toBe(expected);
  });

  it.each([[undefined], [null], [0], [-30], [Number.NaN], ["90"]])(
    "returns null for %p",
    (input) => {
      expect(formatDuration(input)).toBeNull();
    }
  );
});

describe("formatStopCost", () => {
  it("formats a paid stop in its own currency", () => {
    expect(formatStopCost({ amount: 12, currency: "EUR" })).toBe("€12");
  });

  // Zero is a real answer for a park or viewpoint, not missing data - the
  // whole point of the per-stop chip is that "Free" is worth saying.
  it("renders a zero cost as Free", () => {
    expect(formatStopCost({ amount: 0, currency: "EUR" })).toBe("Free");
  });

  it.each([[undefined], [null], [{ currency: "EUR" }]])(
    "returns null for %p",
    (input) => {
      expect(formatStopCost(input)).toBeNull();
    }
  );
});

describe("countStops", () => {
  it("totals stops across every day", () => {
    const itinerary = {
      days: [
        { stops: [{ name: "A" }, { name: "B" }] },
        { stops: [{ name: "C" }] },
      ],
    };
    expect(countStops(itinerary)).toBe(3);
  });

  it("handles a day whose stops were all removed", () => {
    expect(countStops({ days: [{ stops: [] }] })).toBe(0);
  });
});

describe("formatDistance", () => {
  it("rounds and groups longer distances", () => {
    expect(formatDistance(1234.6)).toEqual({ value: "1,235", unit: "km" });
  });

  it("keeps one decimal under 10km, where rounding would lose too much", () => {
    expect(formatDistance(3.42)).toEqual({ value: "3.4", unit: "km" });
  });

  // The field is optional in the schema, so absent is a normal case.
  it.each([[undefined], [null], [0], [-5], [Number.NaN], ["120"]])(
    "returns null for %p",
    (input) => {
      expect(formatDistance(input)).toBeNull();
    }
  );
});

describe("formatBudget", () => {
  it("formats an ISO currency code with a symbol and grouping", () => {
    expect(formatBudget({ amount: 1200, currency: "USD" })).toEqual({
      value: "$1,200",
      unit: null,
    });
  });

  it("drops fractional currency units", () => {
    expect(formatBudget({ amount: 1200.7, currency: "USD" }).value).toBe("$1,201");
  });

  it("falls back to a plain prefix when the model sends a bare symbol", () => {
    expect(formatBudget({ amount: 45000, currency: "¥" })).toEqual({
      value: "¥45,000",
      unit: null,
    });
  });

  // A well-formed code Intl doesn't recognise prints the code itself instead
  // of a symbol - it doesn't throw, so no fallback is needed for this case.
  // The separator Intl inserts is a non-breaking space, hence the escape.
  it("prints an unrecognised but well-formed code verbatim", () => {
    expect(formatBudget({ amount: 500, currency: "ZZZ" })).toEqual({
      value: "ZZZ\u00a0500",
      unit: null,
    });
  });

  it.each([[undefined], [null], [{ currency: "USD" }], [{ amount: "1200", currency: "USD" }]])(
    "returns null for %p",
    (input) => {
      expect(formatBudget(input)).toBeNull();
    }
  );
});
