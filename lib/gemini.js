import { GoogleGenAI } from "@google/genai";
import { buildGeminiResponseSchema } from "./schema";

// A floating alias Google keeps pointed at their current recommended flash
// model, so this doesn't quietly break again the next time a pinned model
// version gets retired (as gemini-2.5-flash did for new API keys).
const DEFAULT_MODEL = "gemini-flash-latest";

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
- Reflect the user's stated interests, budget, and pace in category choices
  and stop selection, but stay realistic even when the description is vague
  - infer a sensible default rather than leaving things generic.
- Infer a sensible number of days from the description; if none is given,
  default to 3.
- Include a short packingChecklist (3-6 items) for at least the first day,
  tailored to the destination and season if mentioned.`;

function buildCreatePrompt(userPrompt) {
  return `Plan this trip: ${userPrompt}`;
}

function buildRefinePrompt(userPrompt, currentItinerary) {
  return `Here is the current itinerary as JSON:
${JSON.stringify(currentItinerary)}

Apply this change and return the FULL updated itinerary (not just the diff),
still matching the schema: ${userPrompt}`;
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
