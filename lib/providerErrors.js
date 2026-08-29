import { ApiError } from "@google/genai";

export class ProviderError extends Error {
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
// availability one, so that's handled separately, after a provider has
// actually answered.
export function classifyGeminiError(err, timedOut) {
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
    if (err.status === 503) {
      // Model overloaded / temporarily unavailable ("high demand"). This is
      // the provider being down, not a bad request — exactly what the
      // OpenRouter fallback exists for.
      return {
        status: 503,
        code: "upstream_error",
        message: "The AI service is temporarily overloaded. Please try again.",
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
  // When the SDK exhausts its own retry loop it throws a plain Error reading
  // "Retryable HTTP Error" with no status attached - it only retries codes
  // that mean the upstream is overloaded/unavailable (429/503/5xx), so treat
  // a give-up here as unavailable and let the OpenRouter fallback take over.
  if (err instanceof Error && /Retryable HTTP Error/i.test(err.message)) {
    return {
      status: 503,
      code: "upstream_error",
      message: "The AI service is temporarily overloaded. Please try again.",
      unavailable: true,
    };
  }
  return {
    status: 502,
    code: "upstream_error",
    message: "Couldn't reach the AI service. Please try again.",
    unavailable: false,
  };
}
