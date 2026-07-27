import { z } from "zod";
import { sumStopCosts } from "./tripStats";
import { HERO_THEMES } from "./heroImages";

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
  // Raised from 400 so the model has room for the richer, 2-3 sentence
  // descriptions the system prompt now asks for. The card still clamps to
  // two lines and reveals the rest behind "Expand details".
  description: z.string().max(700).optional(),
  // Shown as a chip on the card. Bounded to a single day - a stop claiming
  // to take a week is a model error, not a long museum visit.
  durationMinutes: z.number().int().min(5).max(1440).optional(),
  // Per-stop cost, which is what actually gives the trip budget a
  // breakdown. amount: 0 is meaningful (a free viewpoint) and renders as
  // "Free", so this must not be treated as a falsy "no data" case.
  estimatedCost: z
    .object({
      amount: z.number().min(0).max(100_000),
      currency: z.string().min(1).max(8),
    })
    .optional(),
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
  // Trip-level rollups for the summary tiles above the itinerary. Total stops
  // is derived client-side (we already have the days), but distance and
  // budget are estimates only the model can make. Both are optional so a
  // response that skips them - or an itinerary saved by an older build of the
  // app, still sitting in localStorage - keeps validating; the tiles render a
  // dash rather than disappearing.
  distanceKm: z.number().min(0).max(100_000).optional(),
  estimatedBudget: z
    .object({
      amount: z.number().min(0).max(10_000_000),
      // "USD" or "$" - both come back in practice, see formatBudget().
      currency: z.string().min(1).max(8),
    })
    .optional(),
  // Which of the bundled hero images to show while a real photograph of the
  // destination is being looked up. Optional like the rollups above, and for
  // the same reason: trips already sitting in localStorage from before this
  // field existed have to keep validating.
  heroTheme: z.enum(HERO_THEMES).optional(),
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

// Schema for a single replacement stop, used by the per-stop AI edit route.
// Reuses StopSchema so a stop the model writes one at a time is held to
// exactly the same shape as one it writes inside a full itinerary.
export function buildGeminiStopSchema() {
  const jsonSchema = z.toJSONSchema(StopSchema);
  delete jsonSchema.$schema;
  stripUnsupportedKeywords(jsonSchema);
  return jsonSchema;
}

let nextId = 0;
function makeId(prefix) {
  nextId += 1;
  return `${prefix}-${Date.now().toString(36)}-${nextId}`;
}

// Splits the model's whole-trip budget into the part driven by the stops it
// listed and the part that isn't (lodging, food between stops, local
// transport). Only the first moves when the traveler edits their cards, so
// only it is recomputed later — see tripBudget() in lib/tripStats.js.
//
// Returns undefined when the two numbers can't be reconciled (no budget, no
// per-stop costs, or a currency mismatch between them). That's not an error:
// the tile just falls back to showing the model's flat estimate.
function buildBudgetBaseline(itinerary) {
  const budget = itinerary.estimatedBudget;
  if (!budget || typeof budget.amount !== "number") return undefined;

  const stopTotal = sumStopCosts(itinerary);
  if (!stopTotal || stopTotal.currency !== budget.currency) return undefined;

  return {
    // A model that priced its stops above its own trip total leaves nothing
    // for the rest; clamping at zero keeps the tile from going backwards.
    nonStopAmount: Math.max(0, budget.amount - stopTotal.amount),
    currency: budget.currency,
  };
}

// Adds client-side ids (and, for checklist items, a `checked` flag) so the
// UI has stable keys to expand/remove/reorder/tick against. Called once
// right after an itinerary passes validation, whether it's a brand-new
// itinerary or the result of a refinement request.
export function normalizeItinerary(itinerary) {
  return {
    ...itinerary,
    budgetBaseline: buildBudgetBaseline(itinerary),
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
export function stripIds({ budgetBaseline: _baseline, ...itinerary }) {
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

// Shared by both the plain and streaming API routes: never trust that raw
// text from a model is valid JSON, let alone the right shape - parse and
// validate defensively, and hand back a uniform result either way instead of
// throwing, so callers don't need their own try/catch for this step.
export function parseAndValidateItinerary(rawText) {
  let parsedJson;
  try {
    parsedJson = JSON.parse(rawText);
  } catch {
    return {
      ok: false,
      code: "bad_json",
      message: "The AI returned malformed data. Please try again.",
    };
  }

  const validation = ItinerarySchema.safeParse(parsedJson);
  if (!validation.success) {
    console.error("AI response failed schema validation:", validation.error.issues);
    return {
      ok: false,
      code: "bad_shape",
      message: "The AI's response didn't match the expected format. Please try again.",
    };
  }

  return { ok: true, itinerary: normalizeItinerary(validation.data) };
}

// Same contract as parseAndValidateItinerary, for the one-stop-at-a-time edit
// route. No id is assigned here: the replacement keeps the id of the stop it
// replaces, so React doesn't remount the card and every open bit of UI
// (expanded description, pending undo) stays pointed at the same row.
export function parseAndValidateStop(rawText) {
  let parsedJson;
  try {
    parsedJson = JSON.parse(rawText);
  } catch {
    return {
      ok: false,
      code: "bad_json",
      message: "The AI returned malformed data. Please try again.",
    };
  }

  // Models tend to answer a "give me one stop" prompt with the stop wrapped
  // in the key it would have had inside a full itinerary. Accepting both
  // costs one line and removes a whole class of spurious failures.
  const candidate = parsedJson?.stop ?? parsedJson;

  const validation = StopSchema.safeParse(candidate);
  if (!validation.success) {
    console.error("AI stop failed schema validation:", validation.error.issues);
    return {
      ok: false,
      code: "bad_shape",
      message: "The AI's suggestion didn't match the expected format. Please try again.",
    };
  }

  return { ok: true, stop: validation.data };
}
