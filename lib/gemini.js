import { GoogleGenAI } from "@google/genai";
import { buildGeminiResponseSchema, buildGeminiStopSchema } from "./schema";

// Pinned to a current model. The floating `gemini-flash-latest` alias was
// tried here, but it stayed pointed at an overloaded/retired model and
// started returning 503s of its own, so pinning is the safer default.
// Override with GEMINI_MODEL (set in the Vercel env) to move without a deploy.
const DEFAULT_MODEL = "gemini-3.6-flash";

// Lazily construct the client so a missing key only breaks the request that
// actually needs it, not the whole server process at import time.
function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set on the server. Copy .env.local.example to " +
        ".env.local and add your key, then restart the dev server."
    );
  }
  return new GoogleGenAI({ apiKey });
}

const SYSTEM_INSTRUCTION = `You are a local trip-planning expert. Given a short,
free-form description of a trip, produce a realistic, walkable day-by-day
itinerary a real traveler could actually follow.

Rules:
- Respond with JSON only, matching the provided schema exactly.
- Every day must have at least one stop.
- Keep stop names concrete, real, and specific to the destination (e.g.
  "Fushimi Inari Shrine", not "a shrine" or "local market"). Prefer places
  that actually exist over invented-sounding ones.
- Cluster each day's stops geographically (same neighborhood/district or a
  short, sensible travel path) instead of zig-zagging across the city -
  order stops within a day so they flow from one to the next.
- Pace realistically: 3-5 stops per day is typical (fewer for
  museum-heavy/food-heavy days, more only if the user explicitly asks for a
  packed schedule). Leave time between stops for travel and the activity
  itself - don't schedule two full attractions back-to-back with no gap, and
  don't schedule major sights at times they'd realistically be closed
  (e.g. not 10pm for a museum).
- Vary the days: avoid repeating the same stop or a near-duplicate of it
  (e.g. two similar art museums back to back) unless the user's description
  specifically calls for that kind of trip.
- Write each stop's description as 2-3 full sentences, since each stop is
  read on its own card. Cover what the traveler actually does or sees there,
  what makes it worth the slot, and one concrete practical detail - when to
  arrive to avoid the queue, what to order, which entrance to use, how long
  the walk from the previous stop is. Avoid generic filler like "a must-see
  landmark"; every sentence should tell the traveler something they could
  act on.
- Always set durationMinutes to how long the stop realistically takes,
  including queueing and looking around - not just the headline activity.
- Always set estimatedCost: the per-person cost of this specific stop
  (entry fee, a typical meal, the fare for a transport leg), in the same
  currency as estimatedBudget. Use amount 0 for genuinely free stops such as
  parks, viewpoints and walks - do not omit the field to mean free.
- Reflect the user's stated interests, budget, and pace in category choices
  and stop selection, but stay realistic even when the description is vague
  - infer a sensible default rather than leaving things generic.
- Infer a sensible number of days from the description; if none is given,
  default to 3.
- Give EVERY day its own packingChecklist of 3 items (2 for a genuinely simple
  day, 4 for a demanding one), drawn from that day's own stops rather than from
  the trip: the temple that asks for shoes off, the climb that needs water, the
  market that only takes cash, the season's weather. Name the item and what
  it's for on one line, under 90 characters - "Slip-on shoes: three temples
  today ask you to remove them", not "comfortable shoes".
- Never repeat an item from an earlier day unless that day needs it again for
  its own reason. Things that just live in the bag all trip (passport, charger,
  adapter) belong on day 1 if anywhere - a traveler who ticks off the same
  lines every morning stops reading them. Skip anything equally true of any
  trip anywhere.
- Always set distanceKm (total ground distance actually travelled between the
  stops you listed, excluding the flight to the destination) and
  estimatedBudget (realistic per-person total for the whole trip covering
  lodging, food, transport, and entry fees - not including international
  flights). Use the destination's own currency as an ISO code (e.g. "JPY",
  "EUR"), or "USD" if the description gives no signal. Both must reflect the
  itinerary you actually produced, not a generic guess for the city.
- Set durationMinutes on EVERY stop - how long the traveler actually spends
  there, excluding travel to it. This is not optional: the app rebuilds the
  day's timings from these numbers when a stop is moved, so a missing duration
  leaves the schedule unable to shift. Set estimatedCost on every stop too,
  using 0 for anything free rather than omitting it.
- Set heroTheme to whichever single value best describes how the destination
  looks: metropolis (dense city), coastal (beach, islands, seaside), alpine
  (mountains, snow, high country), historic (old towns, monuments, temples,
  ruins), lakes (lakes, fjords, forested valleys), wildlife (safari,
  savannah, national parks). Judge the place itself, not the traveler's
  activities - Kyoto is historic even on a food-focused trip.`;

function buildCreatePrompt(userPrompt) {
  return `Plan this trip: ${userPrompt}`;
}

function buildRefinePrompt(userPrompt, currentItinerary) {
  return `Here is the current itinerary as JSON:
${JSON.stringify(currentItinerary)}

Apply this change and return the FULL updated itinerary (not just the diff),
still matching the schema: ${userPrompt}`;
}

// Replacing one card, rather than regenerating the trip. The surrounding
// stops and the slot's own start time are handed over as fixed context so
// the answer lands in the gap it has to fit: same part of the city as its
// neighbours, and short enough that the next stop's time still works.
const STOP_SYSTEM_INSTRUCTION = `You are a local trip-planning expert helping a
traveler change a single stop in a day they have already planned. You are
either replacing the stop in a slot, or writing one new stop to go on the end
of the day - the prompt says which.

Rules:
- Respond with JSON only: one stop object matching the provided schema. Do
  not return the day, the itinerary, or any commentary.
- The stop must fit the slot it is replacing: reachable from the stop before
  it and leaving enough time to reach the stop after it, in the same part of
  the destination unless the traveler explicitly asks to go elsewhere.
- Keep the name concrete, real, and specific - a place that actually exists
  at the destination, not a category.
- When replacing, set "time" to the slot's start time exactly as given. The
  traveler owns the running order; you are filling one slot, not rescheduling
  the day. When writing a new stop for the end of a day, omit "time" entirely -
  the app works out when it starts.
- Set durationMinutes to what the stop realistically takes including
  queueing, and keep it within the gap before the next stop where possible.
- Set estimatedCost in the same currency as the rest of the trip, using
  amount 0 for genuinely free stops rather than omitting the field.
- Write description as 2-3 full sentences covering what the traveler does
  there, why it earns the slot, and one concrete practical detail. Do not
  mention a clock time in the description unless it is the slot's own time -
  a stale time in the prose is worse than none.
- Do not duplicate a stop that already appears elsewhere in the trip.`;

function buildStopPrompt({ instruction, destination, day, slot }) {
  const target = slot.append
    ? `Write ONE new stop to go on the end of this day, after position ${slot.index}.
It has no start time of its own - omit "time" and let the app schedule it.`
    : `Replace the stop at position ${slot.index + 1} (currently ${
        slot.current ? `"${slot.current.name}"` : "empty"
      }).
Its slot starts at: ${slot.time ?? "no fixed time"}.`;

  return `Destination: ${destination}
Day ${day.day}${day.title ? ` - ${day.title}` : ""}

The full day as planned, in order:
${JSON.stringify(day.stops)}

${target}
The stop before it: ${slot.previous ? `"${slot.previous.name}"` : "none, this opens the day"}.
The stop after it: ${slot.next ? `"${slot.next.name}" at ${slot.next.time ?? "no fixed time"}` : "none, this closes the day"}.

The traveler's request: ${instruction}

Return the ${slot.append ? "new" : "replacement"} stop only.`;
}

// One stop, not a whole itinerary. Same "return raw text, let the route
// validate it" contract as callGemini below.
export async function callGeminiStop({
  instruction,
  destination,
  day,
  slot,
  abortSignal,
}) {
  const ai = getClient();

  const response = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL || DEFAULT_MODEL,
    contents: buildStopPrompt({ instruction, destination, day, slot }),
    config: {
      systemInstruction: STOP_SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseJsonSchema: buildGeminiStopSchema(),
      abortSignal,
    },
  });

  return response.text;
}

// Calls Gemini and returns the raw response text. Deliberately does NOT
// parse or validate here — that's the API route's job, since "the model
// might lie about following the schema" is exactly the failure mode this
// whole assignment is about testing.
export async function callGemini({ mode, prompt, currentItinerary, abortSignal }) {
  const ai = getClient();
  const contents =
    mode === "refine"
      ? buildRefinePrompt(prompt, currentItinerary)
      : buildCreatePrompt(prompt);

  const response = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL || DEFAULT_MODEL,
    contents,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      // Full JSON Schema path (recommended over the legacy responseSchema
      // field for anything beyond trivial shapes — see @google/genai types).
      responseJsonSchema: buildGeminiResponseSchema(),
      abortSignal,
    },
  });

  return response.text;
}

// Streaming variant, used only for the initial "create" flow (not refine -
// scoped down deliberately, see app/api/plan-trip/stream/route.js). Yields
// each text delta as it arrives; the caller is responsible for accumulating
// and validating the full text once the generator completes, exactly like
// the non-streaming path - streaming only changes how the same text is
// delivered, not what's done with it.
export async function* streamGeminiCreate({ prompt, abortSignal }) {
  const ai = getClient();
  const stream = await ai.models.generateContentStream({
    model: process.env.GEMINI_MODEL || DEFAULT_MODEL,
    contents: buildCreatePrompt(prompt),
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseJsonSchema: buildGeminiResponseSchema(),
      abortSignal,
    },
  });
  for await (const chunk of stream) {
    if (chunk.text) yield chunk.text;
  }
}
