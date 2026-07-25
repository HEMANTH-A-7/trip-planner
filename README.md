# Trip Planner

Describe a trip in a sentence or two and get back an interactive, editable
day-by-day itinerary — an LLM returns structured JSON, which this app parses
and renders as interactive components (cards, a chart, checklists). Not a
chatbot: there's no chat log, just a form and a result you can edit.

## Setup

```bash
git clone <repo-url>
cd trip-planner
npm install
cp .env.local.example .env.local
# edit .env.local and set GEMINI_API_KEY to your own key
# get a free key at https://aistudio.google.com/apikey
npm run dev
```

Open http://localhost:3000.

`OPENROUTER_API_KEY` in `.env.local` is optional — see "Provider fallback"
below. Without it, the app still works fully on Gemini alone.

## Usage

1. Describe a trip in the main box (destination, rough length, interests —
   as loose or specific as you like) and hit **Plan my trip**. The first
   result streams in live.
2. Once you have an itinerary:
   - **Expand** a stop (chevron) to see its description, if it has one.
   - **Reorder** stops within a day with the ▲/▼ buttons.
   - **Remove** a stop with ✕.
   - Tick off items in a day's **packing checklist**, if it has one.
   - Use **Refine this itinerary** to describe a change in plain language
     (e.g. "swap day 2's museum for something outdoors") — the model edits
     the existing itinerary rather than starting over.
3. Your itinerary and the prompt that generated it are saved to
   `localStorage` automatically; reloading the page picks up where you left
   off.

## AI usage note

**How the app calls the model:** the free-text prompt (and, for a
refinement, the current itinerary as JSON) is sent to a server route
(`/api/plan-trip` or `/api/plan-trip/stream`), never called from the browser.
The server asks Gemini for `responseMimeType: "application/json"` plus a JSON
Schema derived from the same Zod schema (`z.toJSONSchema`) that later
validates the response — one schema, two jobs, so they can't drift apart.
That JSON-schema steering is a *hint*, not a guarantee: the raw text is still
`JSON.parse`'d and `safeParse`'d defensively regardless of how confidently
the model claims to have followed the schema.

**Provider fallback:** Gemini's free tier turned out to have a very low
request quota (a handful of requests before "check your plan and billing"
429s, seemingly independent of the per-minute rate limit). Rather than block
on that, the server automatically retries a request via OpenRouter
(`nvidia/nemotron-3-super-120b-a12b:free`, chosen after checking it reliably
follows the shape) if Gemini specifically reports itself unavailable (rate
limited or misconfigured) — see `lib/providerErrors.js` and
`generateItineraryText` in `app/api/plan-trip/route.js`. This wasn't in the
original scope; it got added mid-session once Gemini's quota made testing
the happy path impractical, and ended up being a legitimate resilience
feature worth keeping. The streaming endpoint doesn't carry this fallback
(see below) — only the plain request/refine endpoint does.

**Streaming:** `/api/plan-trip/stream` uses Gemini's `generateContentStream`
and forwards text deltas to the client over Server-Sent Events, rendered as
a live raw-text preview. This is deliberately *not* incremental structured
rendering (no attempt to parse and render partial/truncated JSON as cards
mid-stream) — repairing truncated JSON reliably is its own can of worms, and
the validated-on-completion approach is what actually matters for the
"handle bad output" requirement. Once the stream ends, the accumulated text
goes through the exact same `JSON.parse` + `ItinerarySchema.safeParse` path
as the non-streaming request. Streaming is also scoped to the initial
generation only, not refinements, and has no provider fallback of its own —
if it fails partway through, the client catches that and transparently
retries via the plain endpoint (which does have the fallback). This is
additive: if streaming misbehaves for any reason, the app quietly falls back
to the path that was already working, rather than doubling the failure
surface across two providers and two transports.

**AI coding assistants:** this project was built with Claude Code doing the
implementation work directly (writing files, running the dev server, testing
in a real browser, debugging against the live Gemini/OpenRouter APIs), with
the author steering scope, reviewing each commit, and making the
product/architecture calls (which provider, why streaming has no fallback,
what a failed refinement should look like on screen, etc.). A few real bugs
were only found by actually hitting the live APIs rather than reading docs —
notably a Gemini schema bug (below) and a broken refine request — see the
commit history and `PROGRESS.md`'s "bugs found and fixed" section for the
specifics. Two API keys used during development (Gemini, OpenRouter) were
pasted directly into the assistant chat rather than added to `.env.local` by
hand; both live only in the gitignored `.env.local` and were never committed,
but are flagged here since that's a less clean handling path than typing a
key straight into a local file — worth rotating if that matters to you.

## Known limitations

- **Not verified on a real narrow mobile viewport.** The layout was built
  mobile-first (Tailwind base classes, no fixed pixel widths, 36px touch
  targets on icon buttons, `flex-wrap` on badge rows), but the automated
  browser environment used during development couldn't actually change the
  viewport width to confirm it visually (window resize and DevTools' device
  toolbar were both unreachable from that tooling). **Please spot-check this
  on an actual phone or your browser's device toolbar before relying on it.**
- **Streaming has no partial structured rendering.** You see raw JSON text
  accumulate, not day cards appearing one at a time. See the AI-usage note
  above for why.
- **Streaming and the OpenRouter fallback don't compose.** If Gemini fails
  mid-stream, the fix is "retry the whole thing non-streaming," not "keep
  streaming from a different provider." In practice this means a Gemini
  outage during the *first* generation costs you the live-typing effect (you
  fall back to a plain spinner) but not correctness.
- **Refinements aren't streamed.** Only the very first generation is; scoped
  down deliberately rather than doubling the streaming logic for a smaller
  UX win.
- **The chart is derived, not model-generated.** "Stops by category" is
  computed client-side from the validated stop list rather than asking the
  model for separate numeric/statistical data — this was a deliberate choice
  to avoid adding another AI-generated field that would need its own
  sanity-checking, but it does mean the model isn't actually asked to
  produce "a chart block" itself.
- **No automated test suite.** Everything here was verified by hand against
  the real Gemini/OpenRouter APIs in a running browser (see `PROGRESS.md` for
  what was specifically tested and which bugs that testing caught), not unit
  or integration tests.
- **OpenRouter's free model is a fallback of convenience, not curated.**
  `nvidia/nemotron-3-super-120b-a12b:free` was picked after checking a
  handful of free OpenRouter models for schema adherence; free-tier model
  availability on OpenRouter can change without notice.

## Time spent

Roughly 4–5 hours in a single extended session (this is an estimate from the
assistant's side of a long AI-pair-programmed session — the author should
adjust this to their own actual elapsed time before submitting, since that's
the number that actually matters here).
