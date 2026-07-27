// Fallback provider: used only when Gemini itself is unavailable (rate
// limited or misconfigured), so a single provider outage doesn't take the
// whole app down. Deliberately uses basic `json_object` mode instead of a
// strict JSON-schema response format: OpenAI-style strict mode requires
// every property to be listed in `required` (optional fields need awkward
// nullable unions), and free OpenRouter models vary a lot in how well they
// honor a schema anyway - see the note in callGemini(). The schema is
// spelled out in the prompt instead, and, same as the Gemini path,
// ItinerarySchema.safeParse() in the API route is what actually enforces it.
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "nvidia/nemotron-3-super-120b-a12b:free";

// Kept in sync with lib/gemini.js's SYSTEM_INSTRUCTION - same quality bar
// regardless of which provider actually answers the request.
const QUALITY_GUIDANCE = `You are a local trip-planning expert. Produce a
realistic, walkable day-by-day itinerary a real traveler could actually
follow. Keep stop names concrete, real, and specific to the destination
(prefer places that actually exist over invented-sounding ones). Cluster
each day's stops geographically instead of zig-zagging across the city.
Pace realistically - typically 3-5 stops per day, with time between them for
travel, and don't schedule sights at hours they'd realistically be closed.
Vary the days rather than repeating similar stops back to back, unless the
description specifically calls for that. Each stop is read on its own card, so
give every one a description with enough substance to stand alone - avoid
generic filler like "a must-see landmark".`;

const SCHEMA_DESCRIPTION = `Respond with JSON only (no markdown fences, no commentary) matching this shape:
{
  "destination": string,
  "summary": string (optional),
  "distanceKm": number (total ground distance between the stops you listed, excluding the flight to the destination),
  "estimatedBudget": { "amount": number, "currency": string (ISO code, e.g. "JPY") } (realistic per-person total for the trip: lodging, food, transport and entry fees, excluding international flights),
  "days": [
    {
      "day": number,
      "title": string (optional),
      "stops": [
        {
          "name": string,
          "time": string (optional),
          "description": string (2-3 full sentences: what the traveler does there, why it earns the slot, and one concrete practical detail such as when to arrive or what to order),
          "durationMinutes": number (how long the stop realistically takes, including queueing),
          "estimatedCost": { "amount": number, "currency": string } (per-person cost of this stop, same currency as estimatedBudget; use 0 for genuinely free stops rather than omitting it),
          "category": one of food | sightseeing | lodging | transport | activity | other (optional)
        }
      ],
      "packingChecklist": string[] (optional, 3-6 items, only include for the first day)
    }
  ]
}
Every day must have at least one stop. distanceKm and estimatedBudget must
reflect the itinerary you actually produced, not a generic guess for the city.`;

function buildMessages(mode, prompt, currentItinerary) {
  const system = `${QUALITY_GUIDANCE}\n\n${SCHEMA_DESCRIPTION}`;
  const user =
    mode === "refine"
      ? `Here is the current itinerary as JSON:\n${JSON.stringify(currentItinerary)}\n\nApply this change and return the FULL updated itinerary (not just the diff), still matching the schema: ${prompt}`
      : `Plan this trip: ${prompt}`;
  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

const STOP_SCHEMA_DESCRIPTION = `Respond with JSON only (no markdown fences, no
commentary): a single stop object, not a day and not an itinerary.
{
  "name": string (a real, specific place at the destination),
  "time": string (the slot's start time, exactly as given),
  "description": string (2-3 full sentences: what the traveler does there, why it earns the slot, and one concrete practical detail; no clock times other than the slot's own),
  "durationMinutes": number (realistically, including queueing),
  "estimatedCost": { "amount": number, "currency": string } (same currency as the rest of the trip; 0 for free stops rather than omitted),
  "category": one of food | sightseeing | lodging | transport | activity | other
}
The stop must be reachable from the one before it and leave enough time to
reach the one after it, and must not duplicate a stop already in the trip.`;

function buildStopMessages({ instruction, destination, day, slot }) {
  return [
    { role: "system", content: STOP_SCHEMA_DESCRIPTION },
    {
      role: "user",
      content: `Destination: ${destination}
Day ${day.day}${day.title ? ` - ${day.title}` : ""}, as planned in order:
${JSON.stringify(day.stops)}

Replace position ${slot.index + 1}${slot.current ? ` ("${slot.current.name}")` : ""}.
Slot start time: ${slot.time ?? "no fixed time"}.
Before it: ${slot.previous ? `"${slot.previous.name}"` : "none"}. After it: ${
        slot.next ? `"${slot.next.name}" at ${slot.next.time ?? "no fixed time"}` : "none"
      }.

The traveler's request: ${instruction}

Return the replacement stop only.`,
    },
  ];
}

export async function callOpenRouterStop({ abortSignal, ...params }) {
  return postToOpenRouter(buildStopMessages(params), abortSignal);
}

export async function callOpenRouter({ mode, prompt, currentItinerary, abortSignal }) {
  return postToOpenRouter(buildMessages(mode, prompt, currentItinerary), abortSignal);
}

async function postToOpenRouter(messages, abortSignal) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not set.");
  }

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL || DEFAULT_MODEL,
      messages,
      response_format: { type: "json_object" },
    }),
    signal: abortSignal,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const err = new Error(`OpenRouter request failed: ${body.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text) {
    throw new Error("OpenRouter returned no content.");
  }
  return text;
}
