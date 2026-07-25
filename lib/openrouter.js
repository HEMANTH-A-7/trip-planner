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

const SCHEMA_DESCRIPTION = `Respond with JSON only (no markdown fences, no commentary) matching this shape:
{
  "destination": string,
  "summary": string (optional),
  "days": [
    {
      "day": number,
      "title": string (optional),
      "stops": [
        {
          "name": string,
          "time": string (optional),
          "description": string (optional),
          "category": one of food | sightseeing | lodging | transport | activity | other (optional)
        }
      ],
      "packingChecklist": string[] (optional, 3-6 items, only include for the first day)
    }
  ]
}
Every day must have at least one stop.`;

function buildMessages(mode, prompt, currentItinerary) {
  const system = `You are a trip-planning assistant. ${SCHEMA_DESCRIPTION}`;
  const user =
    mode === "refine"
      ? `Here is the current itinerary as JSON:\n${JSON.stringify(currentItinerary)}\n\nApply this change and return the FULL updated itinerary (not just the diff), still matching the schema: ${prompt}`
      : `Plan this trip: ${prompt}`;
  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

export async function callOpenRouter({ mode, prompt, currentItinerary, abortSignal }) {
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
      messages: buildMessages(mode, prompt, currentItinerary),
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
