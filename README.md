# Trip Planner

Describe a trip in plain language and get back an editable, day-by-day
itinerary. An LLM returns structured JSON; the app validates it and renders it
as interactive components — draggable stop cards, a category chart, and
per-day checklists.

**It is not a chatbot.** There is no chat log and no model text rendered to the
screen. A prompt goes in, structured data comes back, and every pixel after
that is React state you can edit.

**Live:** https://trip-planner-dusky-nine.vercel.app

---

## Quick start

```bash
git clone https://github.com/HEMANTH-A-7/trip-planner.git
cd trip-planner
npm install
cp .env.local.example .env.local   # then add your Gemini key
npm run dev
```

Open <http://localhost:3000>.

You need one free Gemini API key from
[Google AI Studio](https://aistudio.google.com/apikey) in `.env.local`:

```bash
GEMINI_API_KEY=your-key-here
```

Two other keys are **optional** and the app runs fully without them:

| Variable             | Effect if omitted                                           |
| -------------------- | ----------------------------------------------------------- |
| `OPENROUTER_API_KEY` | No automatic fallback when Gemini is rate-limited            |
| `PEXELS_API_KEY`     | Trip hero uses a bundled themed photo instead of a real one  |

`npm start` also works from a clean checkout — it builds first if there is no
build yet, then serves the production bundle. Use `npm run dev` while working
on it, for hot reload.

---

## How this meets the brief

| Requirement                         | Where                                                                            |
| ----------------------------------- | -------------------------------------------------------------------------------- |
| React, hooks, functional components | Every component in `components/`; app state in `app/page.js`                      |
| Free-form text input                | `components/TripForm.js` — 2,000 characters of free text, no fields to fill in    |
| Real LLM API                        | Google Gemini (`gemini-flash-latest`), with OpenRouter as an automatic fallback   |
| Structured data → interactive UI    | `lib/schema.js` (Zod) → `DayCard` / `StopCard` / `TripOverviewChart`              |
| **Handles bad model output**        | [Its own section below](#handling-bad-model-output) — the core of this submission |
| Loading / error / empty states      | `LoadingState.js`, `ErrorState.js`, plus per-day and per-list empty copy          |
| Works on mobile                     | Mobile-first layout, hold-to-drag reordering, 36px touch targets                  |
| API key never in the browser        | All model calls run through route handlers in `app/api/`; keys are read server-side |

---

## What you can do with it

1. **Describe a trip** — "4 days in Kyoto in April, mostly temples and food,
   budget-friendly, no early mornings". The first result streams in live.
2. **Reorder stops by dragging.** Use the handle on desktop, or press and hold a
   card on a phone. **Times recompute across the whole day**, not just the two
   cards you swapped — move a three-hour museum into the morning and everything
   after it shifts (see [Scheduling](#scheduling)).
3. **Edit a stop by hand,** or ask the AI to replace just that one stop.
4. **Add a stop** — "Add a stop" under the day opens the same editor, blank.
   Fill it in yourself or ask the AI for something that follows on from the
   day. It lands at the end and picks up a start time from the stop before it;
   drag it earlier if it belongs somewhere else.
5. **Refine in plain language** — "swap day 2's museum for something outdoors"
   edits the existing itinerary instead of regenerating it.
6. **Remove a stop,** with an undo toast that restores its place in the day.
7. **Tick off** a day's packing checklist. Every day gets its own, written
   from that day's stops — the temple that asks for shoes off, the market that
   only takes cash — rather than the same five lines repeated each morning.
8. **Reload the page** — the current itinerary and your last ten trips persist
   in `localStorage`.

---

## Handling bad model output

The brief says most of the signal is here, so this is the part worth reading.

**Nothing the model returns is trusted.** It is asked for JSON via a schema
generated from the same Zod schema that later validates the response
(`z.toJSONSchema()` — one source of truth, so the request and the check cannot
drift apart). That steering is a hint, not a guarantee, so the raw text is
still `JSON.parse`d inside a `try/catch` and run through `safeParse` regardless
of how confidently the model claims to have followed instructions.

| Failure            | What happens                                                                                                        |
| ------------------ | ------------------------------------------------------------------------------------------------------------------- |
| **Malformed JSON** | `parseAndValidateItinerary()` catches the parse error and returns a typed `bad_shape` failure                        |
| **Wrong shape**    | `ItinerarySchema.safeParse` rejects it; the issues are logged server-side and the user gets a retry                  |
| **Empty**          | `days` has `.min(1)`, so an empty itinerary fails validation instead of rendering as a blank success                 |
| **Slow**           | A 30s server budget (`AbortController`) and a 35s client timeout, both surfacing a retryable error                   |
| **Failed / 429**   | Classified in `lib/providerErrors.js`; if Gemini reports itself *unavailable*, OpenRouter is retried transparently   |
| **Stale response** | Guarded by a request counter — see below                                                                            |

### Stale responses

A slow first request must never overwrite a faster second one. Two mechanisms,
both in `app/page.js`:

```js
const requestId = requestIdRef.current + 1;
requestIdRef.current = requestId;
const isStale = () => requestIdRef.current !== requestId;
```

Every state write is guarded by `isStale()`, and the previous request's
`AbortController` is aborted when a new one starts. The counter is the
authority: aborting alone is not enough, because a response already in flight
can still resolve after the abort lands.

### Degrading instead of breaking

Several paths deliberately do something reasonable rather than error:

- A **failed refinement** leaves the existing itinerary on screen. The attempted
  edit did not apply, but the day you already had is still valid.
- If **streaming fails** partway through, the client quietly retries the plain
  endpoint — which carries the provider fallback the stream does not.
- If a trip's **hero photo lookup** fails, times out, or cannot confidently
  identify the destination, the bundled themed image stays and nothing is said.
- A day with **no durations** falls back to simpler scheduling rather than
  producing nonsense times.

---

## Architecture

```
app/
  page.js                     All client state: itinerary, status, streaming, undo
  layout.js
  globals.css                 Design tokens and shared component classes
  api/
    plan-trip/route.js        POST — prompt → Gemini (→ OpenRouter) → validated JSON
    plan-trip/stream/route.js POST — same, streamed as Server-Sent Events
    plan-trip/stop/route.js   POST — regenerate one stop, or write a new
                                     one for the end of a day
    hero-image/route.js       GET  — destination → Pexels photo, cached 30 days

components/
  TripForm.js                 Free-text input, shared by create and refine
  DayCard.js                  One day: its stops and checklist
  StopCard.js                 One stop: expand, edit, remove, drag
  StopEditor.js               Inline form for editing a stop or adding a
                              new one, including AI-suggest per stop
  TripOverviewChart.js        Stops-by-category bar chart
  ChecklistBlock.js           Per-day packing checklist
  HeroBackdrop.js             Crossfading hero imagery
  Sidebar.js  TripHero.js  SummaryView.js  TripSummary.js
  LandingHero.js  RecentTrips.js  LoadingState.js  ErrorState.js
  UndoToast.js  EdgeScroller.js

lib/
  schema.js                   Zod schema, Gemini JSON schema, parse and validate
  gemini.js                   Primary provider (plain and streaming)
  openrouter.js               Fallback provider
  providerErrors.js           Error classification shared by both routes
  schedule.js                 Rebuilds a day's times from stop durations
  useDragSort.js              Pointer-based drag reordering (mouse and touch)
  tripStats.js                Cost, duration and rollup formatting
  storage.js                  localStorage session and trip history
  heroImages.js               Bundled hero set and theme mapping
  sse.js                      Server-Sent Events frame parser
```

### Data flow

```
free text
  → POST /api/plan-trip          (the key stays server-side)
  → Gemini, steered by a JSON schema generated from the Zod schema
  → JSON.parse inside a try/catch
  → ItinerarySchema.safeParse
  → normalizeItinerary()         (assigns client-side ids)
  → React state → interactive components
```

Ids are assigned client-side on purpose: LLMs are unreliable at inventing
stable unique ids, so the schema never asks for them. React keys, removal and
reordering all run on ids the app generated itself.

### Scheduling

Reordering a day rebuilds its timings rather than swapping two labels. The
model's own spacing already encodes travel and slack, so a schedule is read as
a start time plus a **gap per slot**, where each gap is the original interval
minus that stop's own duration. On reorder, **durations travel with the stop
and gaps stay with the slot** — so moving a long stop earlier genuinely pushes
the rest of the day later. `lib/schedule.js`, covered by unit tests.

---

## Stretch goals

Every optional item in the brief is implemented:

- **Different block types** — stop cards, a category bar chart and per-day
  checklists, each rendered by its own component.
- **Streaming** — the first generation streams over SSE with a live preview
  inside the search box. Deliberately *not* incremental structured rendering:
  reliably repairing truncated JSON is its own problem, and the value here is
  output that is validated on completion.
- **Refinement loop** — follow-up prompts edit the existing itinerary.
- **Save and reload sessions** — automatic, plus a ten-trip history.
- **Polish** — dark and light themes from one token set, drag-and-drop that
  works with a finger, keyboard-accessible reordering, crossfading hero
  imagery, and reduced-motion support throughout.

---

## Scripts

| Command         | What it does                                        |
| --------------- | --------------------------------------------------- |
| `npm run dev`   | Development server on port 3000                     |
| `npm run build` | Production build                                    |
| `npm start`     | Production server, building first if needed         |
| `npm test`      | Vitest suite — 105 tests, no network, no API key    |
| `npm run lint`  | ESLint                                              |

---

## Tests

```bash
npm test
```

105 unit tests, with no network calls and no API key required. They cover the
places where being wrong is silent: schema validation and the parse path
against malformed fixtures, provider error classification, schedule arithmetic
across every permutation of a day, drag geometry with uneven card heights, and
cost and duration formatting.

Component and end-to-end tests are **not** included — see limitations.

---

## Known limitations

- **Streaming has no provider fallback of its own.** A Gemini failure mid-stream
  costs the live-typing effect, not correctness — the client retries the plain
  endpoint, which does have the fallback.
- **Refinements are not streamed.** Only the first generation is.
- **Destination photos depend on a third-party search.** A photo is used only
  when its caption or URL actually names the destination; otherwise the bundled
  themed image stays. That is deliberately conservative — a generic image beats
  a confidently wrong one.
- **OpenRouter's free model is a fallback of convenience.** Free-tier
  availability there can change without notice.

---

## Time spent

Roughly **7–8 hours**.

---

## Credits

Hero photography from [Pexels](https://www.pexels.com) and
[Unsplash](https://unsplash.com), used under their respective licences and
credited in the app. Destination photos are fetched at runtime from the Pexels
API, which credits the photographer in the corner of the hero. Icons are
[Lucide](https://lucide.dev); type is Golos Text via `next/font`.
