import { describe, expect, it } from "vitest";
import {
  countStops,
  formatBudget,
  formatDistance,
  formatDuration,
  formatStopCost,
  mainStopId,
  sumStopCosts,
  tripBudget,
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

const cost = (amount, currency = "EGP") => ({ amount, currency });

// One day, three priced stops totalling 2,590 against a 6,000 trip budget -
// so 3,410 of the budget is lodging/food/transport that no single stop owns.
const trip = () => ({
  destination: "Cairo",
  estimatedBudget: cost(6000),
  budgetBaseline: { nonStopAmount: 3410, currency: "EGP" },
  days: [
    {
      id: "d1",
      stops: [
        { id: "s1", name: "Pyramids", estimatedCost: cost(540) },
        { id: "s2", name: "Museum", estimatedCost: cost(1200) },
        { id: "s3", name: "Dinner", estimatedCost: cost(850) },
      ],
    },
  ],
});

describe("sumStopCosts", () => {
  it("adds up the stops currently in the trip", () => {
    expect(sumStopCosts(trip())).toEqual({ amount: 2590, currency: "EGP" });
  });

  it("counts a free stop without discarding the total", () => {
    const it_ = trip();
    it_.days[0].stops.push({ id: "s4", name: "Viewpoint", estimatedCost: cost(0) });
    expect(sumStopCosts(it_)).toEqual({ amount: 2590, currency: "EGP" });
  });

  it("skips a stop priced in another currency rather than adding it blindly", () => {
    const it_ = trip();
    it_.days[0].stops.push({ id: "s4", name: "Flight", estimatedCost: cost(300, "USD") });
    expect(sumStopCosts(it_)).toEqual({ amount: 2590, currency: "EGP" });
  });

  it("returns null when nothing is priced", () => {
    expect(sumStopCosts({ days: [{ stops: [{ name: "a" }] }] })).toBeNull();
  });
});

describe("tripBudget", () => {
  it("matches the model's estimate before anything is edited", () => {
    expect(tripBudget(trip())).toEqual({ amount: 6000, currency: "EGP" });
  });

  it("drops by exactly the cost of a removed stop", () => {
    const it_ = trip();
    it_.days[0].stops = it_.days[0].stops.filter((s) => s.id !== "s2");
    expect(tripBudget(it_)).toEqual({ amount: 4800, currency: "EGP" });
  });

  it("rises when a stop is repriced upward", () => {
    const it_ = trip();
    it_.days[0].stops[0].estimatedCost = cost(1040);
    expect(tripBudget(it_)).toEqual({ amount: 6500, currency: "EGP" });
  });

  it("keeps the non-stop remainder when every stop is gone", () => {
    const it_ = trip();
    it_.days[0].stops = [];
    expect(tripBudget(it_)).toEqual({ amount: 3410, currency: "EGP" });
  });

  it("falls back to the flat estimate for an itinerary saved before baselines existed", () => {
    const { budgetBaseline: _dropped, ...legacy } = trip();
    expect(tripBudget(legacy)).toEqual({ amount: 6000, currency: "EGP" });
  });

  it("returns null when the model gave no budget at all", () => {
    expect(tripBudget({ days: [{ stops: [] }] })).toBeNull();
  });
});

describe("mainStopId", () => {
  const stop = (id, durationMinutes) => ({ id, name: id, durationMinutes });

  it("picks the longest stop of the day", () => {
    expect(mainStopId([stop("a", 30), stop("b", 180), stop("c", 60)])).toBe("b");
  });

  it("gives ties to the earlier stop, so the marker doesn't wander", () => {
    expect(mainStopId([stop("a", 90), stop("b", 90)])).toBe("a");
  });

  it("ignores stops with no usable duration", () => {
    expect(mainStopId([stop("a", undefined), stop("b", 45), { id: "c" }])).toBe("b");
  });

  it("marks nothing when there is nothing to compare", () => {
    expect(mainStopId([stop("a", 120)])).toBeNull();
    expect(mainStopId([])).toBeNull();
    expect(mainStopId(null)).toBeNull();
  });

  it("marks nothing when the model gave no durations at all", () => {
    expect(mainStopId([{ id: "a" }, { id: "b" }])).toBeNull();
  });
});
