import { describe, it, expect } from "vitest";
import {
  ItinerarySchema,
  buildGeminiResponseSchema,
  normalizeItinerary,
  stripIds,
  parseAndValidateItinerary,
} from "./schema";

const validItinerary = {
  destination: "Kyoto",
  summary: "Temples and food",
  days: [
    {
      day: 1,
      title: "Arrival",
      stops: [{ name: "Fushimi Inari Shrine", category: "sightseeing" }],
      packingChecklist: ["Comfortable shoes"],
    },
  ],
};

describe("ItinerarySchema", () => {
  it("accepts a well-formed itinerary", () => {
    const result = ItinerarySchema.safeParse(validItinerary);
    expect(result.success).toBe(true);
  });

  it("rejects a missing destination", () => {
    const { destination: _destination, ...rest } = validItinerary;
    const result = ItinerarySchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects an empty days array (the 'empty response' failure mode)", () => {
    const result = ItinerarySchema.safeParse({ ...validItinerary, days: [] });
    expect(result.success).toBe(false);
  });

  it("rejects a day with no stops key at all", () => {
    const result = ItinerarySchema.safeParse({
      destination: "Kyoto",
      days: [{ day: 1 }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a stop that's a string instead of an object (wrong shape)", () => {
    const result = ItinerarySchema.safeParse({
      destination: "Kyoto",
      days: [{ day: 1, stops: ["Fushimi Inari Shrine"] }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an out-of-range day number (guards against a wild model response)", () => {
    const result = ItinerarySchema.safeParse({
      destination: "Kyoto",
      days: [{ day: 999999, stops: [{ name: "X" }] }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unrecognized category enum value", () => {
    const result = ItinerarySchema.safeParse({
      destination: "Kyoto",
      days: [{ day: 1, stops: [{ name: "X", category: "not-a-real-category" }] }],
    });
    expect(result.success).toBe(false);
  });

  it("allows a stop with only the required 'name' field", () => {
    const result = ItinerarySchema.safeParse({
      destination: "Kyoto",
      days: [{ day: 1, stops: [{ name: "X" }] }],
    });
    expect(result.success).toBe(true);
  });
});

describe("buildGeminiResponseSchema", () => {
  it("never includes minItems/maxItems (Gemini 400s on these for array-of-objects fields)", () => {
    const schema = buildGeminiResponseSchema();
    const json = JSON.stringify(schema);
    expect(json).not.toMatch(/minItems|maxItems/);
  });

  it("has no $schema meta field (Gemini doesn't understand it)", () => {
    const schema = buildGeminiResponseSchema();
    expect(schema.$schema).toBeUndefined();
  });
});

describe("normalizeItinerary / stripIds round-trip", () => {
  it("assigns unique ids to every day, stop, and checklist item", () => {
    const normalized = normalizeItinerary(validItinerary);
    expect(normalized.days[0].id).toBeTruthy();
    expect(normalized.days[0].stops[0].id).toBeTruthy();
    expect(normalized.days[0].packingChecklist[0]).toMatchObject({
      text: "Comfortable shoes",
      checked: false,
    });
  });

  it("stripIds removes ids and collapses checklist items back to plain strings", () => {
    const normalized = normalizeItinerary(validItinerary);
    const stripped = stripIds(normalized);
    expect(stripped.days[0].id).toBeUndefined();
    expect(stripped.days[0].stops[0].id).toBeUndefined();
    expect(stripped.days[0].packingChecklist).toEqual(["Comfortable shoes"]);
  });

  it("stripIds(normalizeItinerary(x)) still validates against ItinerarySchema", () => {
    const roundTripped = stripIds(normalizeItinerary(validItinerary));
    expect(ItinerarySchema.safeParse(roundTripped).success).toBe(true);
  });
});

describe("parseAndValidateItinerary", () => {
  it("reports bad_json for malformed JSON text", () => {
    const result = parseAndValidateItinerary("{ this is not json");
    expect(result.ok).toBe(false);
    expect(result.code).toBe("bad_json");
  });

  it("reports bad_shape for valid JSON that doesn't match the schema", () => {
    const result = parseAndValidateItinerary(JSON.stringify({ foo: "bar" }));
    expect(result.ok).toBe(false);
    expect(result.code).toBe("bad_shape");
  });

  it("reports bad_shape for an empty object (the 'empty response' failure mode)", () => {
    const result = parseAndValidateItinerary("{}");
    expect(result.ok).toBe(false);
    expect(result.code).toBe("bad_shape");
  });

  it("returns a normalized itinerary (with ids) for valid JSON", () => {
    const result = parseAndValidateItinerary(JSON.stringify(validItinerary));
    expect(result.ok).toBe(true);
    expect(result.itinerary.days[0].id).toBeTruthy();
    expect(result.itinerary.days[0].stops[0].id).toBeTruthy();
  });
});
