import { ApiError } from "@google/genai";
import { callGemini } from "@/lib/gemini";
import { callOpenRouter } from "@/lib/openrouter";
import { ItinerarySchema, normalizeItinerary } from "@/lib/schema";

// Gemini can hang or take a very long time on a bad day. Cap it so the
// request always resolves one way or another within a bounded time, instead
// of leaving the client's loading state spinning forever. This budget is
// shared across the Gemini attempt AND the OpenRouter fallback below, so a
// slow Gemini failure can't add its own 30s on top of the fallback's.
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_PROMPT_LENGTH = 2000;

function errorResponse(status, code, message) {
  return Response.json({ error: code, message }, { status });
}

class ProviderError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// Maps a thrown Gemini error to a user-facing status/code/message. `unavailable`
// marks the cases where Gemini itself is the problem (quota, bad key) rather
// than the request - only those are worth retrying against a different
// provider; a malformed/wrong-shape response is a data problem, not an
// availability one, so that's handled later, after both providers have had a
// chance to answer.
function classifyGeminiError(err, timedOut) {
  if (timedOut || err?.name === "AbortError") {
    return {
      status: 504,
      code: "timeout",
      message: "The AI took too long to respond. Please try again.",
      unavailable: false,
    };
  }
  if (err instanceof ApiError) {
    if (err.status === 401 || err.status === 403) {
      return {
        status: 500,
        code: "config_error",
        message: "The server's Gemini API key is missing or invalid.",
        unavailable: true,
      };
    }
    if (err.status === 429) {
      return {
        status: 429,
        code: "rate_limited",
        message: "Rate limit reached. Please wait a moment and try again.",
        unavailable: true,
      };
    }
    return {
      status: 502,
      code: "upstream_error",
      message: "The AI service returned an error. Please try again.",
      unavailable: false,
    };
  }
  if (err instanceof Error && err.message.includes("GEMINI_API_KEY")) {
    return { status: 500, code: "config_error", message: err.message, unavailable: true };
  }
  return {
    status: 502,
    code: "upstream_error",
    message: "Couldn't reach the AI service. Please try again.",
    unavailable: false,
  };
}

// Tries Gemini first (the primary, fully-validated provider). If Gemini is
// specifically *unavailable* (rate limited or misconfigured) and an
// OpenRouter key is present, transparently retries via OpenRouter rather than
// failing the whole request - a single provider hiccup shouldn't take the
// app down. Any other Gemini failure (timeout, one-off upstream error) is
// returned as-is; retrying those against a second provider wouldn't be more
// reliable, just slower.
async function generateItineraryText(params) {
  try {
    return await callGemini(params);
  } catch (err) {
    console.error("Gemini call failed:", err);
    const classified = classifyGeminiError(err, params.abortSignal.aborted);
    if (classified.unavailable && process.env.OPENROUTER_API_KEY) {
      try {
        const text = await callOpenRouter(params);
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

  const timeoutController = new AbortController();
  const timeout = setTimeout(
    () => timeoutController.abort(),
    REQUEST_TIMEOUT_MS
  );

  let rawText;
  try {
    rawText = await generateItineraryText({
      mode: isRefine ? "refine" : "create",
      prompt: prompt.trim(),
      currentItinerary: isRefine ? itinerary : undefined,
      abortSignal: timeoutController.signal,
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
  } finally {
    clearTimeout(timeout);
  }

  // Never trust the model actually followed the schema — parse defensively.
  let parsedJson;
  try {
    parsedJson = JSON.parse(rawText);
  } catch {
    return errorResponse(
      502,
      "bad_json",
      "The AI returned malformed data. Please try again."
    );
  }

  const validation = ItinerarySchema.safeParse(parsedJson);
  if (!validation.success) {
    console.error(
      "AI response failed schema validation:",
      validation.error.issues
    );
    return errorResponse(
      502,
      "bad_shape",
      "The AI's response didn't match the expected format. Please try again."
    );
  }

  return Response.json({ itinerary: normalizeItinerary(validation.data) });
}
