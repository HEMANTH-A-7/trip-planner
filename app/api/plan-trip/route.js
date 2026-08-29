import { callGemini } from "@/lib/gemini";
import { callOpenRouter } from "@/lib/openrouter";
import { ItinerarySchema, parseAndValidateItinerary } from "@/lib/schema";
import { ProviderError, classifyGeminiError } from "@/lib/providerErrors";

// The two-provider chain below can legitimately run longer than a platform's
// default function limit. Allow the full window (60s is the ceiling on
// Vercel's Hobby plan, and well within Pro's).
export const maxDuration = 60;

// Each provider gets its OWN bounded budget rather than sharing one: a fast
// Gemini failure (a 503 bounced back in a few seconds) must still leave the
// OpenRouter fallback a full window to answer in, not whatever scraps are
// left on a shared clock.
const GEMINI_TIMEOUT_MS = 25_000;
const FALLBACK_TIMEOUT_MS = 30_000;
const MAX_PROMPT_LENGTH = 2000;

function errorResponse(status, code, message) {
  return Response.json({ error: code, message }, { status });
}

// Runs `fn` with a fresh AbortSignal that trips after `ms`, so a hung upstream
// call can't outlive its budget.
async function withTimeout(ms, fn) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fn(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

// Tries Gemini first (the primary, fully-validated provider). If Gemini is
// specifically *unavailable* (rate limited, overloaded, or misconfigured) and
// an OpenRouter key is present, transparently retries via OpenRouter rather
// than failing the whole request - a single provider hiccup shouldn't take
// the app down. A Gemini timeout is returned as-is: it already spent the
// whole primary budget, so a second slow provider would just make the user
// wait longer for the same disappointment.
async function generateItineraryText({ mode, prompt, currentItinerary }) {
  try {
    return await withTimeout(GEMINI_TIMEOUT_MS, (abortSignal) =>
      callGemini({ mode, prompt, currentItinerary, abortSignal })
    );
  } catch (err) {
    console.error("Gemini call failed:", err);
    const classified = classifyGeminiError(err, err?.name === "AbortError");
    if (classified.unavailable && process.env.OPENROUTER_API_KEY) {
      try {
        const text = await withTimeout(FALLBACK_TIMEOUT_MS, (abortSignal) =>
          callOpenRouter({ mode, prompt, currentItinerary, abortSignal })
        );
        console.warn("Gemini unavailable - served this request via the OpenRouter fallback.");
        return text;
      } catch (fallbackErr) {
        console.error("OpenRouter fallback also failed:", fallbackErr);
      }
    }
    throw new ProviderError(classified.status, classified.code, classified.message);
  }
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "bad_request", "Request body must be JSON.");
  }

  const { prompt, mode, itinerary } = body ?? {};

  if (typeof prompt !== "string" || prompt.trim().length === 0) {
    return errorResponse(400, "bad_request", "Please describe your trip first.");
  }
  if (prompt.length > MAX_PROMPT_LENGTH) {
    return errorResponse(
      400,
      "bad_request",
      `That description is too long (max ${MAX_PROMPT_LENGTH} characters).`
    );
  }

  const isRefine = mode === "refine";
  if (isRefine) {
    // Defensive: only trust an itinerary shape we'd have produced ourselves.
    const check = ItinerarySchema.safeParse(itinerary);
    if (!check.success) {
      return errorResponse(
        400,
        "bad_request",
        "No valid itinerary to refine. Generate one first."
      );
    }
  }

  let rawText;
  try {
    rawText = await generateItineraryText({
      mode: isRefine ? "refine" : "create",
      prompt: prompt.trim(),
      currentItinerary: isRefine ? itinerary : undefined,
    });
  } catch (err) {
    if (err instanceof ProviderError) {
      return errorResponse(err.status, err.code, err.message);
    }
    console.error("Unexpected error generating itinerary:", err);
    return errorResponse(
      502,
      "upstream_error",
      "Couldn't reach the AI service. Please try again."
    );
  }

  const result = parseAndValidateItinerary(rawText);
  if (!result.ok) {
    return errorResponse(502, result.code, result.message);
  }
  return Response.json({ itinerary: result.itinerary });
}
