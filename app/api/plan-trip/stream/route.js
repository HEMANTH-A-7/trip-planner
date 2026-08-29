import { streamGeminiCreate } from "@/lib/gemini";
import { parseAndValidateItinerary } from "@/lib/schema";
import { classifyGeminiError } from "@/lib/providerErrors";

// Deliberately scoped to the initial "create" flow only, not "refine" - two
// providers x two modes x streaming would multiply the failure surface for
// a marginal UX gain. Refinements already work well as a plain request; this
// is purely a progressive-enhancement layer for the first generation, where
// there's nothing on screen yet and a live preview matters most.
//
// No OpenRouter fallback here either: if Gemini streaming fails partway
// through, we've already committed to a streamed response, so there's
// nowhere clean to splice in a second provider mid-stream. Instead this
// route just reports the failure as a stream event, and the client falls
// back to the plain (non-streaming) /api/plan-trip endpoint - which still
// has the full Gemini-then-OpenRouter fallback chain. Streaming is additive:
// if it doesn't work, the app quietly falls back to what already does.

// Match the request timeout so the platform doesn't cut a slow stream short
// of its own budget (60s is the Vercel Hobby ceiling).
export const maxDuration = 60;

const REQUEST_TIMEOUT_MS = 45_000;
const MAX_PROMPT_LENGTH = 2000;

function sse(event) {
  return `data: ${JSON.stringify(event)}\n\n`;
}

function streamError(status, code, message) {
  return new Response(sse({ type: "error", code, message }), {
    status,
    headers: { "Content-Type": "text/event-stream" },
  });
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return streamError(400, "bad_request", "Request body must be JSON.");
  }

  const { prompt } = body ?? {};
  if (typeof prompt !== "string" || prompt.trim().length === 0) {
    return streamError(400, "bad_request", "Please describe your trip first.");
  }
  if (prompt.length > MAX_PROMPT_LENGTH) {
    return streamError(
      400,
      "bad_request",
      `That description is too long (max ${MAX_PROMPT_LENGTH} characters).`
    );
  }

  const timeoutController = new AbortController();
  const timeout = setTimeout(() => timeoutController.abort(), REQUEST_TIMEOUT_MS);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let fullText = "";
      try {
        for await (const chunk of streamGeminiCreate({
          prompt: prompt.trim(),
          abortSignal: timeoutController.signal,
        })) {
          fullText += chunk;
          controller.enqueue(encoder.encode(sse({ type: "chunk", text: chunk })));
        }
      } catch (err) {
        console.error("Gemini streaming failed:", err);
        const classified = classifyGeminiError(err, timeoutController.signal.aborted);
        controller.enqueue(
          encoder.encode(
            sse({ type: "error", code: classified.code, message: classified.message })
          )
        );
        clearTimeout(timeout);
        controller.close();
        return;
      }
      clearTimeout(timeout);

      const result = parseAndValidateItinerary(fullText);
      controller.enqueue(
        encoder.encode(
          result.ok
            ? sse({ type: "done", itinerary: result.itinerary })
            : sse({ type: "error", code: result.code, message: result.message })
        )
      );
      controller.close();
    },
    cancel() {
      timeoutController.abort();
      clearTimeout(timeout);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
