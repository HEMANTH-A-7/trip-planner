import { callGeminiStop } from "@/lib/gemini";
import { callOpenRouterStop } from "@/lib/openrouter";
import { ItinerarySchema, parseAndValidateStop } from "@/lib/schema";
import { ProviderError, classifyGeminiError } from "@/lib/providerErrors";

// Shorter than the whole-itinerary budget in ../route.js on purpose: this
// generates one stop, inline, while the traveler watches a card spinner. If
// it can't answer in this long it's better to fail and let them type the
// change themselves than to hold the card hostage for half a minute.
const REQUEST_TIMEOUT_MS = 20_000;
const MAX_INSTRUCTION_LENGTH = 500;

function errorResponse(status, code, message) {
  return Response.json({ error: code, message }, { status });
}

// Same provider chain as the main route: Gemini first, OpenRouter only when
// Gemini is specifically unavailable and a key is configured.
async function generateStopText(params) {
  try {
    return await callGeminiStop(params);
  } catch (err) {
    console.error("Gemini stop call failed:", err);
    const classified = classifyGeminiError(err, params.abortSignal.aborted);
    if (classified.unavailable && process.env.OPENROUTER_API_KEY) {
      try {
        const text = await callOpenRouterStop(params);
        console.warn(
          "Gemini unavailable - served this stop via the OpenRouter fallback."
        );
        return text;
      } catch (fallbackErr) {
        console.error("OpenRouter stop fallback also failed:", fallbackErr);
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

  const { instruction, itinerary, dayIndex, stopIndex, slot } = body ?? {};
  // "replace" swaps the stop already in this position; "append" writes a new
  // one for the end of the day. Defaulted rather than required so an older
  // client still gets the original behaviour.
  const isAppend = slot === "append";

  if (typeof instruction !== "string" || instruction.trim().length === 0) {
    return errorResponse(400, "bad_request", "Describe the change you want first.");
  }
  if (instruction.length > MAX_INSTRUCTION_LENGTH) {
    return errorResponse(
      400,
      "bad_request",
      `That's too long (max ${MAX_INSTRUCTION_LENGTH} characters).`
    );
  }

  // Defensive: only trust an itinerary shape we'd have produced ourselves.
  const check = ItinerarySchema.safeParse(itinerary);
  if (!check.success) {
    return errorResponse(400, "bad_request", "No valid itinerary to edit.");
  }

  const day = check.data.days[dayIndex];
  if (!day) {
    return errorResponse(400, "bad_request", "That day is no longer part of this trip.");
  }
  // Appending addresses the position after the last stop, which is one past
  // the end of the array - a legitimate target here, and out of bounds for a
  // replace.
  const maxIndex = isAppend ? day.stops.length : day.stops.length - 1;
  if (!Number.isInteger(stopIndex) || stopIndex < 0 || stopIndex > maxIndex) {
    return errorResponse(
      400,
      "bad_request",
      isAppend
        ? "That day is no longer part of this trip."
        : "That stop is no longer part of this day."
    );
  }

  const timeoutController = new AbortController();
  const timeout = setTimeout(() => timeoutController.abort(), REQUEST_TIMEOUT_MS);

  let rawText;
  try {
    rawText = await generateStopText({
      instruction: instruction.trim(),
      destination: check.data.destination,
      day,
      slot: {
        index: stopIndex,
        append: isAppend,
        // A replacement inherits the slot's own start time - the point of
        // editing one card is that the rest of the day stays put. A new stop
        // on the end has no time of its own to inherit: the client derives it
        // from the stop before it.
        time: isAppend ? null : day.stops[stopIndex].time,
        current: isAppend ? null : day.stops[stopIndex],
        previous: day.stops[stopIndex - 1] ?? null,
        next: isAppend ? null : day.stops[stopIndex + 1] ?? null,
      },
      abortSignal: timeoutController.signal,
    });
  } catch (err) {
    if (err instanceof ProviderError) {
      return errorResponse(err.status, err.code, err.message);
    }
    console.error("Unexpected error generating a stop:", err);
    return errorResponse(
      502,
      "upstream_error",
      "Couldn't reach the AI service. Please try again."
    );
  } finally {
    clearTimeout(timeout);
  }

  const result = parseAndValidateStop(rawText);
  if (!result.ok) {
    return errorResponse(502, result.code, result.message);
  }

  // The slot owns its start time, so a model that ignored the instruction to
  // echo it back doesn't get to reschedule the day. Everything else is the
  // model's to change.
  //
  // On an append there is no slot time yet, and any time the model invented
  // is one the client recomputes anyway - so it's dropped rather than shown
  // in the preview, where it would read as a promise the day won't keep.
  if (isAppend) {
    const { time: _invented, ...stop } = result.stop;
    return Response.json({ stop });
  }

  return Response.json({
    stop: {
      ...result.stop,
      ...(day.stops[stopIndex].time !== undefined && {
        time: day.stops[stopIndex].time,
      }),
    },
  });
}
