import { z } from "zod";

// This is the single source of truth for the itinerary shape. It's used in
// three places: (1) turned into a JSON Schema we hand to Gemini so it knows
// what to return, (2) used to validate whatever Gemini actually sends back
// (never trust "the model said it would follow the schema"), and (3) the
// TypeScript-less "type" the rest of the app codes against.
//
// Deliberately no "id" fields here: LLMs are unreliable at inventing unique,
// stable ids, so we don't ask for them. Ids are assigned client-side in
// normalizeItinerary() after validation succeeds, and are what React keys /
// remove / reorder operations use.

export const StopSchema = z.object({
  name: z.string().min(1).max(120),
  time: z.string().max(40).optional(),
  description: z.string().max(400).optional(),
  category: z
    .enum(["food", "sightseeing", "lodging", "transport", "activity", "other"])
    .optional(),
});

export const DaySchema = z.object({
  // Bounded to a sane trip length (60 days) so a wildly wrong model response
  // (e.g. day: 999999999) fails validation instead of ending up on screen.
  day: z.number().int().min(1).max(60),
  title: z.string().max(120).optional(),
  stops: z.array(StopSchema),
  // Stretch: a second "block type" alongside stop cards, per day.
  packingChecklist: z.array(z.string().max(80)).optional(),
});

export const ItinerarySchema = z.object({
  destination: z.string().min(1).max(120),
  summary: z.string().max(400).optional(),
  days: z.array(DaySchema).min(1).max(60),
});

// Gemini's responseJsonSchema documents minItems/maxItems as supported, but
// in practice a 400 INVALID_ARGUMENT comes back whenever they're set on an
// array-of-objects field (confirmed by manually bisecting the schema against
// the live API) — so they're stripped here. This is only the schema used to
// steer the model; ItinerarySchema.safeParse() is still the real safety net
// and keeps enforcing these bounds on whatever actually comes back.
function stripUnsupportedKeywords(node) {
  if (Array.isArray(node)) {
    node.forEach(stripUnsupportedKeywords);
    return;
  }
  if (node && typeof node === "object") {
    delete node.minItems;
    delete node.maxItems;
    Object.values(node).forEach(stripUnsupportedKeywords);
  }
}

// JSON Schema handed to Gemini's structured-output config so the model is
// steered toward the right shape. This is a steering hint, not a guarantee —
// ItinerarySchema.safeParse() below is the actual safety net.
export function buildGeminiResponseSchema() {
  const jsonSchema = z.toJSONSchema(ItinerarySchema);
  // Gemini's schema support doesn't understand the $schema meta field.
  delete jsonSchema.$schema;
  stripUnsupportedKeywords(jsonSchema);
  return jsonSchema;
}

let nextId = 0;
function makeId(prefix) {
  nextId += 1;
  return `${prefix}-${Date.now().toString(36)}-${nextId}`;
}

// Adds client-side ids (and, for checklist items, a `checked` flag) so the
// UI has stable keys to expand/remove/reorder/tick against. Called once
// right after an itinerary passes validation, whether it's a brand-new
// itinerary or the result of a refinement request.
export function normalizeItinerary(itinerary) {
  return {
    ...itinerary,
    days: itinerary.days.map((day) => ({
      ...day,
      id: makeId("day"),
      stops: day.stops.map((stop) => ({
        ...stop,
        id: makeId("stop"),
      })),
      packingChecklist: day.packingChecklist?.map((text) => ({
        id: makeId("item"),
        text,
        checked: false,
      })),
    })),
  };
}

// Strips the client-only ids/checked flags back out before sending the
// current itinerary to Gemini as context for a refinement request — the
// model only needs the content, not our bookkeeping fields.
export function stripIds(itinerary) {
  return {
    ...itinerary,
    days: itinerary.days.map(({ id: _id, stops, packingChecklist, ...day }) => ({
      ...day,
      stops: stops.map(({ id: _stopId, ...stop }) => stop),
      ...(packingChecklist && {
        packingChecklist: packingChecklist.map((item) => item.text),
      }),
    })),
  };
}
