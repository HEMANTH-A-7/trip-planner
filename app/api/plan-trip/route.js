import { ApiError } from "@google/genai";
import { callGemini } from "@/lib/gemini";
import { ItinerarySchema, normalizeItinerary } from "@/lib/schema";

// Gemini can hang or take a very long time on a bad day. Cap it so the
// request always resolves one way or another within a bounded time, instead
// of leaving the client's loading state spinning forever.
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_PROMPT_LENGTH = 2000;

function errorResponse(status, code, message) {
  return Response.json({ error: code, message }, { status });
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
    rawText = await callGemini({
      mode: isRefine ? "refine" : "create",
      prompt: prompt.trim(),
      currentItinerary: isRefine ? itinerary : undefined,
      abortSignal: timeoutController.signal,
    });
  } catch (err) {
    if (err?.name === "AbortError" || timeoutController.signal.aborted) {
      return errorResponse(
        504,
        "timeout",
        "The AI took too long to respond. Please try again."
      );
    }
    if (err instanceof ApiError) {
      if (err.status === 401 || err.status === 403) {
        return errorResponse(
          500,
          "config_error",
          "The server's Gemini API key is missing or invalid."
        );
      }
      if (err.status === 429) {
        return errorResponse(
          429,
          "rate_limited",
          "Rate limit reached. Please wait a moment and try again."
        );
      }
      return errorResponse(
        502,
        "upstream_error",
        "The AI service returned an error. Please try again."
      );
    }
    if (err instanceof Error && err.message.includes("GEMINI_API_KEY")) {
      return errorResponse(500, "config_error", err.message);
    }
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
      "Gemini response failed schema validation:",
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
