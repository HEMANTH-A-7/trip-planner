# Trip Planner — Progress Tracker

This file is the source of truth for this project's status, plan, and rules.
Read this first in any new session before touching code.

## What this is

A frontend internship take-home assignment: a React app where a user describes
a trip in free text, an LLM returns a structured day-by-day itinerary as JSON,
and the app renders it as interactive UI (expand / remove / reorder stops) —
not a chatbot. Grading emphasizes handling bad AI output (malformed JSON,
wrong shape, empty, slow, failed) as much as the happy path. The user
explicitly asked for **all** optional/stretch items from the assignment to be
implemented, not just the required core.

Full assignment text is preserved in `ASSIGNMENT.md` in this repo.

## Key decisions (already made, don't re-litigate)

| Decision | Choice | Why |
|---|---|---|
| AI provider | Google Gemini (`gemini-flash-latest`), primary | User has a key for this; JSON-schema structured output |
| Fallback provider | OpenRouter (`nvidia/nemotron-3-super-120b-a12b:free`) | Used automatically only when Gemini is rate-limited/misconfigured — see "Provider fallback" below |
| Framework | Next.js (App Router), JavaScript, no TypeScript | Bundles frontend + API routes as backend in one app; TS is optional/not graded per assignment FAQ |
| Styling | Tailwind CSS v4 | Fast to build responsive/dark-mode UI; `dark:` variant is `prefers-color-scheme`-driven by default |
| Validation | Zod v4 | Runtime schema validation of whatever the model returns, independent of any provider's own JSON mode. `z.toJSONSchema()` derives the schema handed to Gemini, so there's one source of truth |
| Reordering | Pointer-based drag-and-drop, hand-written | HTML5 DnD never fires from a finger; one pointer-event path covers mouse, touch and pen. Up/down buttons stay on touch as the screen-reader-accessible fallback |
| Streaming | Implemented, "create" flow only, no fallback of its own | See `app/api/plan-trip/stream/route.js` — streaming failures fall back to the plain endpoint client-side instead of retrying providers mid-stream |
| Git identity | `user.name = "Hemanth Amarthi"`, `user.email = hemanthkumar.amarthi7@gmail.com` (set locally in this repo, not global) | Matches how commits would appear if made manually via GitHub/git CLI |
| Commit authorship | Every commit is authored solely by the user. **Claude is never added as a co-author or contributor.** | Explicit user instruction |
| GitHub repo | Public, created via `gh repo create` from this machine | User's explicit choice |

### Provider fallback chain (important to understand before touching backend code)

1. **Plain requests** (`/api/plan-trip`, both create and refine): tries Gemini
   first. If Gemini fails *specifically because it's unavailable* (429 rate
   limit, or a missing/invalid key), and `OPENROUTER_API_KEY` is set, it
   transparently retries the same request via OpenRouter before giving up.
   Any other Gemini failure (timeout, one-off upstream error) is returned
   as-is — retrying a different provider wouldn't make a timeout more
   reliable, just slower. See `classifyGeminiError` in `lib/providerErrors.js`
   for exactly which errors count as "unavailable".
2. **Streaming** (`/api/plan-trip/stream`, create only): Gemini only, no
   in-request fallback (can't cleanly splice in a second provider after a
   streamed response has already started). If the stream fails for any
   reason, the **client** catches it and falls back to a plain (non-streaming)
   request to `/api/plan-trip` — which then has the full chain from #1.
3. Both provider API keys were supplied directly in chat during this session
   (not typed into `.env.local` by the user themselves) — flagged in case
   either needs rotating later, since they were visible in conversation
   history. Both live only in the gitignored `.env.local`, never committed.

## Architecture

```
trip-planner/
  app/
    api/
      plan-trip/
        route.js               # POST: prompt -> Gemini (-> OpenRouter fallback) -> validated JSON
        stream/route.js        # POST: streams the "create" flow as SSE, no fallback of its own
        stop/route.js          # POST: regenerate a single stop in place
      hero-image/route.js      # GET: destination -> Pexels photo, cached 30 days
    page.js                    # Main page: all client state (itinerary, status, streaming, undo)
    layout.js
    globals.css                # Design tokens + shared component classes
  components/
    TripForm.js                # controlled free-text input; reused for create and refine
    DayCard.js                 # one day: stops + checklist, owns the drag session
    StopCard.js                # one stop: expand/edit/remove/drag
    StopEditor.js              # inline edit form, incl. AI-suggest for a single stop
    ChecklistBlock.js          # interactive packing-list checkboxes (block type #2)
    TripOverviewChart.js       # single-hue bar chart, stops-by-category (block type #3)
    HeroBackdrop.js            # crossfading hero images, shared by landing and trip
    Sidebar.js  TripHero.js  SummaryView.js  TripSummary.js
    LandingHero.js  RecentTrips.js  UndoToast.js  EdgeScroller.js
    LoadingState.js / ErrorState.js
  lib/
    schema.js                  # zod schema, Gemini JSON schema, normalize/stripIds, parse+validate
    gemini.js                  # Gemini SDK: callGemini (plain) + streamGeminiCreate (streaming)
    openrouter.js              # OpenRouter fallback provider (OpenAI-compatible API)
    providerErrors.js          # ProviderError + classifyGeminiError, shared by both routes
    schedule.js                # rebuilds a day's times from stop durations on reorder
    useDragSort.js             # pointer-based drag reordering (mouse + touch + keyboard)
    categories.js              # shared category labels + lucide icons
    tripStats.js               # cost/duration formatting, rollups, main-stop selection
    storage.js                 # localStorage session + trip history
    heroImages.js              # bundled hero set, themes, credits
    sse.js                     # minimal SSE frame parser for the streaming client
  .env.local.example
  PROGRESS.md                  # <- this file
  ASSIGNMENT.md                # original assignment text, verbatim
  README.md
```

### Data shape (source of truth is `lib/schema.js`)

Model-facing shape (what Gemini/OpenRouter are asked to return, and what gets
validated against `ItinerarySchema`):

```
Itinerary = {
  destination: string,
  summary?: string,
  distanceKm?: number,                                  // total ground distance, drives a summary tile
  estimatedBudget?: { amount: number, currency: string },// per-person trip total, drives a summary tile
  days: [
    {
      day: number,               // 1-60
      title?: string,
      stops: [
        { name: string, time?: string, description?: string, category?: "food"|"sightseeing"|"lodging"|"transport"|"activity"|"other" }
      ],
      packingChecklist?: string[]   // block type: checklist
    }
  ]
}
```

Client-facing shape (after `normalizeItinerary()`): same, but every `day` and
`stop` gets a client-only `id`, and each `packingChecklist` string becomes
`{ id, text, checked }`. `stripIds()` converts back to the model-facing shape
before sending the itinerary to the API as refinement context.

### Failure handling (the part that's actually graded hardest)

- **Malformed JSON** → `parseAndValidateItinerary()` in `lib/schema.js` does
  `JSON.parse` in a try/catch regardless of which provider answered — never
  trust structured-output claims blindly.
- **Wrong shape** → `ItinerarySchema.safeParse` after parsing. On failure: a
  distinct `bad_shape` error, shown with Retry; raw validation issues logged
  server-side.
- **Empty** → handled in place rather than by a dedicated component: no trip
  is the landing page, an emptied day says so on the day card, and an empty
  history hides its section. At the data layer, `days` has `.min(1)`, so an
  empty/missing days array fails
  schema validation and surfaces as the same `bad_shape` error rather than a
  blank successful render.
- **Slow** → client-side timeout (35s, slightly above the server's own 30s)
  aborts the fetch and surfaces a timeout error with Retry; server-side has
  its own 30s `AbortController` budget shared across the Gemini attempt and
  the OpenRouter fallback.
- **Failed (network/4xx/5xx/rate limit/misconfigured key)** → caught and
  mapped to a readable message via `classifyGeminiError`; Retry always
  available; rate-limit/config errors trigger the OpenRouter fallback first.
- **Stale responses** → a monotonically increasing `requestIdRef` plus
  `AbortController`, shared across plain requests, streaming requests, and
  the streaming-to-plain fallback. A response checks "am I still the latest
  request?" before touching state; superseded requests are aborted outright,
  not just ignored.
- **Failed refinement doesn't nuke existing data** → the itinerary view stays
  on screen (with the error shown above it) whenever an itinerary exists,
  regardless of status — a failed *edit* shouldn't hide the still-valid data
  it was trying to edit.

## Plan / step list (also tracked as tasks in-session)

1. [x] Scaffold Next.js app, git init, fix local git identity
2. [x] Write this PROGRESS.md
3. [x] `.env.local.example`, confirm `.gitignore` excludes `.env*.local`, README skeleton
4. [x] Zod itinerary schema + validation helper (`lib/schema.js`)
5. [x] Gemini API route (`app/api/plan-trip/route.js`) with full error handling + refine mode
6. [x] TripForm + request lifecycle (loading/error/empty, stale-response guard)
7. [x] Interactive itinerary UI: expand / remove / reorder stops
8. [x] Responsive styling + dark mode + keyboard-nav polish pass (fade-in on
    results, focus-visible rings on all icon buttons, verified Tab order +
    focus rings live in browser)
9. [x] Stretch: localStorage save/reload session
10. [x] Stretch: refinement loop (follow-up edits to existing itinerary)
11. [x] Stretch: packing-checklist block type
12. [x] Stretch: chart block type (`TripOverviewChart`, stops-by-category)
13. [x] Stretch: OpenRouter fallback provider (not in the original plan — added when
    Gemini's free-tier quota turned out to be very low; requested by the user)
14. [x] Stretch: streaming (`/api/plan-trip/stream`, create flow only)
15. [x] Live-tested golden path + refine + persistence + streaming in browser (see
    bugs found/fixed below)
16. [ ] Check a real narrow mobile viewport — attempted via browser resize_window,
    which did not actually change the viewport in this environment; layout was
    built mobile-first (Tailwind base classes, no fixed widths, `h-9 w-9` touch
    targets) but hasn't been visually confirmed at e.g. 375px. **Needs a real
    check** (phone, or Chrome DevTools device toolbar) before calling this done.
17. [x] Finalize README (setup, usage, AI-usage note, limitations, time spent)
18. [x] `gh repo create` (public) + push — https://github.com/HEMANTH-A-7/trip-planner

### Post-submission polish (user asked "what else would make this stand out")

19. [x] Sharpened both providers' system prompts: geographic clustering per
    day, realistic pacing (3-5 stops/day), avoid scheduling around closed
    hours, vary stops across days. Verified live on a 3-day NYC request.
20. [x] Vitest suite (`npm test`, 25 tests, no network/API key needed):
    `lib/schema.test.js` (ItinerarySchema edge cases, the minItems/maxItems
    regression, normalize/stripIds round-trip, parseAndValidateItinerary)
    and `lib/providerErrors.test.js` (every classifyGeminiError branch).
21. [x] Undo toast for stop removal (`components/UndoToast.js`) — 5s window,
    reinserts at original day/index, single-slot (a second removal finalizes
    the first rather than stacking). Verified live.
22. [x] Example prompt chips (`components/ExamplePrompts.js`) — populate,
    don't auto-submit; hidden once an itinerary exists. Verified live.
23. [x] Deployed to Vercel — https://trip-planner-dusky-nine.vercel.app
    (project: hemanth-a-7s-projects/trip-planner). Both env vars set,
    verified live with a real generation in production.

Update the checkboxes above as steps complete. If you're picking this project
back up in a new session, `git log --oneline` plus this checklist tells you
exactly where things stand.

### Itinerary card redesign (user supplied reference screenshots)

Reworked the itinerary surface to match two reference designs the user
provided. Deliberately **no images on the cards** — the reference has photo
thumbnails, but the user ruled them out to keep AI cost down, so the cards
are text-only.

- **`components/TripSummary.js` (new)** — three rollup tiles above the
  itinerary: total stops, distance, estimated budget. Total stops is derived
  client-side; the other two are model estimates and are optional, so a tile
  with no data renders a dash rather than collapsing the row. Per the stat-tile
  contract the value uses a plain ink token and proportional figures (not
  `tabular-nums`, which makes a number like "120" look loose at display size);
  only the icon carries an accent.
- **`lib/tripStats.js` (new)** — `countStops`, `formatDistance`, `formatBudget`,
  each returning `null` rather than a placeholder when data is missing so the
  tile owns how a gap looks. Covered by `lib/tripStats.test.js` (18 cases).
- **`StopCard`** — timeline rail (dot per stop, connector line reaching into
  the list's row gap), time + title header, always-visible description clamped
  to two lines, category chip, and three actions: rename, remove, move.
- **Drag-to-reorder** replaces the old up/down chevron pair. The card is
  `draggable` **only while the grip is held** (`dragArmed` state) — otherwise
  selecting card text turns into a drag. Dragged card dims to 40%, the drop
  target gets a dashed accent outline, and the grip shows a "Move" tooltip on
  hover/focus.
- Reorder is a **splice-and-reinsert, not the two-item swap** `moveStop()`
  does: dragging a card three positions down should leave the cards it passed
  in their original order. Both operations coexist — arrow keys on the focused
  grip still use the swap-based `moveStop`.
- **Inline rename** (the pencil): Enter just blurs the input so commit logic
  lives on a single path (`onBlur`); Escape sets a ref that makes that same
  blur discard instead of save. An emptied field restores the old name.

Known gap: HTML5 drag-and-drop is pointer-only, so **touch devices can't
reorder**. Keyboard users are covered (arrow keys on the focused grip); touch
would need a pointer-events-based DnD implementation.

### Sidebar shell (second round of the same redesign)

The app now has two layouts, switched on whether an itinerary exists:

- **No itinerary** → unchanged centered landing column (headline, create form,
  empty/loading/error states). There's nothing for a sidebar to navigate yet.
- **Itinerary exists** → `Sidebar` + main pane.

`components/Sidebar.js` carries the brand block, "New trip" (wired to the
existing `handleStartOver`), a two-item nav, and the day list with a stop count
per day. **Deliberately no Explorer/Settings entries** — the user asked for
Explorer to be dropped, and Settings would be a nav item pointing at nothing.
The brand stays "Trip Planner", not the reference mock's "Voyager".

One responsive markup, not a desktop and a mobile copy: below `lg` the aside is
a header strip whose nav and day list scroll horizontally (`overflow-x-auto`
inside the list, so the row scrolls rather than the page); at `lg` it becomes
the sticky 16rem rail.

- `components/TripHero.js` — banner with the **cover-image placeholder**: an
  accent wash plus a dashed "Cover image" chip. Deliberately an obvious empty
  slot, not something posing as art. Dropping a real photo in later means
  setting a background image on the first layer and deleting the chip.
- `components/SummaryView.js` — the Summary nav target: rollup tiles, the
  category chart, and a "Day at a glance" list whose rows are also navigation
  (picking one jumps to that day's cards). No map panel and no "Book this trip"
  CTA from the reference — neither has anything real behind it.
- The itinerary view now renders **one day at a time** (the sidebar selection)
  rather than every day stacked. `components/ItineraryView.js` was deleted;
  `page.js` renders `DayCard` directly.
- The refine form moved below the day's cards, and the old "Start a new trip"
  text link is gone — the sidebar's "New trip" button replaces it.

The selected day is **resolved during render**, not stored:
`days.find(id) ?? days[0]`. A refinement rebuilds the itinerary with fresh ids,
so a stored id would go stale on every successful refine; the fallback fixes
that with no effect syncing state to props.

### Landing page + trip history (third round)

Two layouts, switched on whether a trip exists:

- **No trip** → `LandingHero` only, **no sidebar**: a full-height photo with
  the headline centred and the search bar sitting at the bottom of the
  viewport. Streaming previews and errors render in the middle band above the
  box, so the search bar keeps its place at the bottom.
- **Trip open** → `Sidebar` + `TripHero` + day cards.

Because the landing has no sidebar, trip history needed a second home there —
`components/RecentTrips.js`, a card grid below the hero. Without it, hitting
"New trip" would strand every saved trip with no way back to it.

`components/ExamplePrompts.js` was **deleted** (and `TripForm`'s
`suggestionsOnSelect` prop with it): the chips said the same thing as the
textarea's own `e.g. …` placeholder, and cost a lot of vertical space in a
search box that now sits at the bottom of the hero. Step 22 in the list above
is therefore no longer true of the current UI.

- **The cover-image placeholder is gone** — both heroes now use a real photo,
  `public/beach-hero.jpg` (credited in README). One stock image for every
  destination; the app still does not fetch a photo per trip.
- Hero text is **fixed white on a dark scrim**, not the theme's ink token —
  ink flips to near-black in the light theme and would be unreadable over a
  bright beach photo. The scrim resolves to `var(--canvas)` at the bottom so
  the photo doesn't end on a hard edge.
- `EmptyState` was deleted: the landing hero *is* this route's empty state, and
  a second "no itinerary yet" box under it was pure redundancy.
- `next/image` with `fill`. **Use `preload`, not `priority`** — `priority` is
  deprecated as of Next 16. `sizes` accounts for the 16rem rail
  (`(min-width: 64rem) calc(100vw - 16rem), 100vw`) rather than claiming
  `100vw`, which would fetch a wider file than is ever painted.

**Trip history** lives under the "New trip" button. `lib/storage.js` gained
`loadHistory` / `saveToHistory` / `removeFromHistory` against a separate
`trip-planner:history` key, capped at 10 entries.

- Whole itineraries are stored, not just prompts, so **reopening a trip costs
  no tokens and hits no network**.
- A trip carries a `tripId` that survives its own refinements, and the
  save-as-you-go effect upserts by that id — so history holds the *edited*
  itinerary (removals, renames, reorderings), not the version first generated,
  and refining doesn't append a new entry per edit.
- Deleting the trip that's currently open also clears the workspace, rather
  than leaving the sidebar pointing at something that no longer exists.

**Dev-only gotcha worth not re-debugging:** the first request for a given
`/_next/image` variant fails in `next dev` (the `<img>` reports
`complete: true` with `naturalWidth: 0`) and succeeds on reload once the
optimizer has cached it. Verified this is dev-only by running `next start` on
port 3100 — in a production build the image loads on the very first paint, and
the optimizer returns 41KB/107KB/292KB at w=640/1080/1920.

### Per-stop cost/duration, in-box streaming, responsive rebuild (fourth round)

**Streaming preview moved inside the search box.** `components/StreamingPreview.js`
was deleted; `TripForm` now takes a `streamingText` prop and renders it as an
**overlay absolutely positioned on top of the textarea**, not as a sibling.
That's the whole trick behind "don't make the box any bigger" — the textarea
underneath still defines the height, the overlay just covers it, so the box is
byte-identical in size whether idle or streaming (measured: 169px in both
states). The overlay auto-scrolls to the newest tokens, since a box that can't
grow would otherwise silently fill past its own bottom. The character counter
swaps to "Generating…" while it runs.

**Per-stop cost breakdown.** `StopSchema` gained `estimatedCost {amount,
currency}` and `durationMinutes`, rendered as chips beside the category tag.
`formatStopCost` treats **amount 0 as "Free", not as missing data** — a free
viewpoint is a real answer and the prompt explicitly tells the model to send 0
rather than omit the field. Both system prompts now also ask for 2-3 sentence
descriptions with one actionable detail each, since every stop is read on its
own card; `description` max went 400 → 700 to fit that.

**Responsive rebuild — this was a real bug, not just polish.** The landing hero
overflowed its own `100vh` on any short window (reproduced at 1100×620: page
was 1505px tall in a 728px viewport, pushing the search bar off-screen). Fixes:

- `app/layout.js` no longer sets `h-full` on `<html>` + `min-h-full` on
  `<body>`. Pinning `<html>` to `height:100%` while page sections ask for
  viewport-height units gives two competing definitions of "full height".
  Page containers own their min-height; body just paints the canvas, which
  propagates to the viewport.
- **`svh`/`dvh`, not `vh`.** On mobile browsers `vh` measures against the
  viewport with the URL bar *hidden*, so a `100vh` hero is taller than the
  screen on first paint — exactly the thing that hides a bottom-anchored
  search bar.
- Hero type and padding are `clamp()`ed, so short windows compress instead of
  overflowing. Content column is `max-w-3xl xl:max-w-4xl` so wide screens
  aren't mostly empty margin.

**Mobile:** touch targets raised (card actions 28→36px below `sm`, checklist
boxes 16→20px). The important one: history/recent **delete buttons were
`opacity-0` until hover, and touch devices have no hover** — they were
effectively unreachable on a phone. Now always visible below `sm`,
hover-revealed from `sm` up.

Verified with real window resizing (not just iframes): live resize now reflows
the sidebar between strip and sticky rail with no reload, and there's no
horizontal overflow at 375 / 420 / 606 / 1100 / 1500 / 1600px. Note Chrome on
macOS won't size a window below ~600px wide, so true phone widths still need
the iframe trick.

### Drag-and-drop that works on a phone (fifth round)

Reordering a day used to be two separate mechanisms: HTML5 drag-and-drop from
the grip on desktop, and a pair of up/down chevrons on touch, because
**`dragstart` never fires from a finger** — the grip was a dead control on a
phone. Both are now driven by one pointer-event implementation in
`lib/useDragSort.js`, so a mouse, a finger and a stylus take the same path.

- **Touch lifts on a hold** (280ms) anywhere on the card; a mouse lifts
  immediately from the grip, since it has a handle to aim at and holding the
  body would fight text selection. Any movement over 8px before the hold
  completes hands the gesture back to the browser as a scroll — that's the
  whole difference between "drag" and "scroll" on a touchscreen.
- **The page can't be allowed to scroll under an active drag, and React's own
  touch listeners are passive**, so `preventDefault` has to come from a native
  non-passive `touchmove` listener registered at lift. `contextmenu` is
  suppressed with it: Android fires one at the end of a long press, on top of
  the drag that press just started.
- **Positions are measured in document coordinates**, not viewport ones, so the
  page can scroll during a drag. It does: the pointer inside 76px of a viewport
  edge scrolls the page each frame, which is what lets a card reach a slot that
  wasn't on screen when it was picked up — the normal case on a phone, where a
  day rarely fits in one viewport.
- **The drop slot is judged against where the cards started**, not where they
  currently sit. Comparing against shifted positions makes a card resting near
  a boundary flip back and forth, because it displaces the very card it's being
  compared to. Cards being passed move by exactly the space the lifted card
  vacated (its height plus the row gap), whatever height they are themselves.
- **Dropping clears the transition in the same commit as the transforms**, so
  they unwind instantly against the reordered list instead of animating back
  out of it.
- **Which controls a card shows now follows `pointer: fine` / `pointer: coarse`
  rather than the `sm:` width breakpoint.** A narrow desktop window is still a
  mouse (it used to lose the grip *and* have no working drag at all), and a
  wide tablet is still a thumb. The chevrons stay on touch on purpose: a drag
  is a gesture you have to know about and be able to perform, and they're the
  only reorder control available through a screen reader.
- Geometry is pure and unit-tested (`lib/useDragSort.test.js`, 13 tests) —
  slot selection with ragged card heights, displacement, and the edge-scroll
  ramp. The gesture itself was verified live in the browser: real mouse drags
  from the grip, and synthesised `pointerType: "touch"` sequences for the
  hold-lift-move-drop path.

### Second design pass, against the reference's real values (sixth round)

User's read on the first redesign: "generic, too AI generated, without any
effort", pointing at flamapp.ai's feature section as the target. Rather than
guess from the screenshot, the reference's own computed styles were read off
the live site again. The findings, and what each one changed:

- **The font was never the problem.** The app was already on Golos Text, and
  so is flamapp — verified both `document.fonts` in the app (loaded, not
  falling back) and the reference's computed `font-family`. What differs is
  the *setting*: the reference runs **-3px of tracking on a 36px headline**
  (-0.083em) at weight 500, -0.6px at 22px/600, and +1.2px on 11px uppercase
  labels. Default tracking at display sizes is most of what makes type look
  unset. Hence `.type-display` / `.type-heading` / `.type-label`, and
  `letter-spacing: -0.02em` on `body`.
- **Edges.** The reference borders at `#434343` and `#6e6d6d` — real greys.
  Ours were `rgba(255,255,255,0.08)`, which dissolves into whatever it sits
  on. This one change did more for "clarity" than anything else.
- **Panels are gradients**, `linear-gradient(to top, #0f0f0f 14%, #232323
  119%)`, never flat fills. Plus a **dot matrix** (1px dots on a 20px grid)
  over them — run at 0.16 here rather than the reference's 0.3, because our
  panels are mostly covered by the cards on them and the leftover gutters
  read as a dashed border at full strength.
- **Nesting.** The reference stacks a 32px shell → an 18px inset → a 20px
  panel. A day is now shell / gradient panel / raised stop cards, three tiers
  instead of one flat box.
- **Colour.** Four unrelated pastels (peach/lavender/mint/gold, cycled
  per category) were replaced by one warm ramp, `#f4d1be → #a06040`, which is
  the reference's own gradient. `CATEGORY_COLORS` is gone entirely: the tint
  encoded nothing the label didn't already say, and six hues on one card was
  the loudest tell that nobody picked the colours. Greys are now neutral
  rather than warm-tinted, so the warmth reads as deliberate where it is used.
  **The search box keeps its original four-colour sweep** — it was swapped for
  a single warm one in this pass and the user asked for it back. Those four
  hues now live as literals inside `.gradient-border` rather than as palette
  tokens: the effect is unchanged, but they can't spread to anything else.
- **Selected state** is the reference's solid pill. `.pill-active` is
  `background: var(--ink); color: var(--canvas)`, so it inverts by itself
  between themes instead of needing a second rule.
- **Figures** (times, costs, durations, stat values) are set in the mono face
  that was already loaded, with tabular digits, and the stat tiles fill their
  one number with the warm gradient — the reference's treatment for exactly
  that job.

Verified live at desktop and at 390px, in both themes (the light block was
force-applied to check the inversion), and the drag from the round above still
reorders correctly against the new card heights.

One fix that came out of looking at it on a phone: the card's action buttons
used to sit beside the stop name and took roughly a third of the width, which
broke "Tokyo National Museum in Ueno Park" over four lines. They now share a
line with the time, which is short and never competes, and the name gets the
full width. The timeline rail is also dropped below `sm` — it cost ~22px of a
390px screen to say something the ordering already says.

### Hero imagery: rotation on the landing, a real photo per trip (seventh round)

The last generic thing in the app was one stock beach behind every
destination — "Tokyo, Japan" set over a palm tree. Two different fixes,
because the two surfaces have opposite problems:

- **Landing rotates.** No destination has been named yet, so the images have
  nothing to contradict, and the rotation *is* the pitch: anywhere you want.
  Five user-supplied photos on a **2s cadence** (1.3s hold + 700ms crossfade,
  measured on the running page at 2049–2051ms per change). 2s was asked for
  twice; the reservation on the record is that at this speed each image only
  settles for about a second, and the landing's job is to get someone typing
  into the box underneath. Changing it means moving `CYCLE_MS` in
  `HeroBackdrop` — `HOLD_MS` derives from it, so the sum stays right.

  The cadence is why the next image is mounted invisibly the moment the
  current one lands, rather than when its turn comes: at 2s there is no time
  to *start* fetching once the fade is already due, and the first pass through
  the set would stretch until everything was cached.
- **A trip does not rotate.** Its destination is on screen, so every rotation
  would be a fresh chance to be wrong. It gets one image, chosen to match.

**The ordering is the whole trick.** The model returns a `heroTheme`, that
bundled image renders immediately, and `/api/hero-image` looks up a real
photograph of the destination on Pexels which crossfades in over the top. The
network call is never on the critical path, never blocks paint, and never
shows a spinner. If it's slow, fails, or the place can't be identified,
nothing happens and nobody notices.

Four things that were measured rather than assumed, each of which changed the
implementation:

- **Search the destination alone.** Appending "travel landscape" makes results
  *worse* — Pexels widens on extra terms rather than narrowing, so
  "Reykjavik, Iceland" returns Reykjavik while "Reykjavik, Iceland travel
  landscape" starts returning generic Icelandic plains.
- **A non-empty response is not a match.** Pexels answers everything:
  "zzqqxyvv nowhereland" returns 347 photos of Ferris wheels and a "Neverland"
  sign. So a photo has to *name* the place — its alt text or URL slug must
  contain a significant word from the destination — or it's discarded and the
  themed image stays. Generic-but-never-wrong is the safe direction to fail.
- **`decode()` does not resolve in a background tab.** Verified: an image that
  is `complete` with a real `naturalWidth` left `decode()` pending
  indefinitely. It had been the gate for starting the fade, so a landing page
  opened in a background tab deadlocked its own rotation and was *still* stuck
  when the tab was finally looked at. It now races a 250ms timer.
- **next/image does not forward `onLoad`.** The ref fires, the image
  completes, `onLoad` is never called. Readiness now comes from a native
  `load` listener on the element, plus an immediate check for an image that
  was already complete when the ref ran — the normal case on a repeat visit,
  when the file is in the HTTP cache.

Two implementation notes worth keeping:

- The crossfade is a **CSS animation, not a transition**. A transition has to
  be kicked off from JS on a later frame, which means `requestAnimationFrame`
  — and rAF doesn't run in a background tab, so the fade can be stranded
  half-done. An animation starts itself the moment the element is committed.
- `HeroBackdrop` tracks **the image being shown, not an index into the list**.
  The trip hero swaps its whole list when the photo arrives (same length, same
  index, different picture), so anything index-based cut instead of fading and
  had no way to keep showing the outgoing image once it left the list.

Caching is what keeps this inside a free tier: the outbound Pexels fetch is
cached for 30 days by URL, so everyone planning Tokyo shares one upstream
call. `priority` was also swapped for `preload` throughout — deprecated as of
Next 16 — and the incoming crossfade layer is `loading="eager"`, since a layer
about to be faded in is already in the viewport and the default lazy loading
leaves it waiting on an IntersectionObserver.

Attribution is rendered in the hero corner. The Pexels and Unsplash licences
don't require it for downloaded images, but the Pexels **API** guidelines do
for photos served through the API — worth re-reading their current terms
before submission rather than trusting this note.

### Rhythm, one icon set, and a schedule that actually recomputes (eighth round)

Six things, from a critique of the app as it stood:

- **Times are rebuilt from durations, not re-pinned to slots.** This is the
  substantive one. `lib/schedule.js` used to keep a day in order by pinning
  each time to its position, and documented the trade-off as unfixable:
  recomputing needs travel time between two arbitrary places, which nothing
  in the app knows. It's fixable, because the model's own spacing already
  encodes it. A schedule is now read as a start time plus a *gap per slot*,
  where the gap is the original interval minus that stop's own duration. On
  reorder, durations travel with the stop and gaps stay with the slot.
  Verified live: dragging a 3-hour museum into the morning moved Senso-ji
  from 08:30 to **12:00 PM** and shifted the rest of the day with it, rather
  than swapping two labels. It degrades exactly right — a day with no
  durations collapses to the old slot-pinning behaviour, and there's a test
  pinning that guarantee.
- **Both prompts now require `durationMinutes` and `estimatedCost` on every
  stop**, since the schedule runs on those durations and a missing one leaves
  the day unable to shift.
- **One icon set.** `CATEGORY_LABELS` was emoji, which put 🏛️ directly beside
  a lucide wallet and a lucide clock in the same chip row — two drawing
  conventions in one line, and emoji render differently per OS so the app
  didn't control them anyway. Categories are lucide components now; the
  string map stays for `<option>`s and aria-labels.
- **A day has a focal point.** The longest stop is marked as the day's main
  stop — accent edge, star, one per day. Ties go to the earlier stop so the
  marker doesn't wander when a day is reordered, and a day with no durations
  gets no anchor rather than an arbitrary one (`mainStopId`, tested).
- **Sidebar hierarchy.** Three visually identical pill stacks gave trip
  history the same weight as day navigation. Days is now primary and sits
  first; history demotes to a smaller, quieter shelf underneath; the
  Itinerary/Summary switch became a segmented control so it reads as a mode
  switch rather than a third list.
- **`LoadingState`** was the last pre-redesign component — a dashed box round
  a spinner. It's now skeleton stop cards on the same panel system, so the
  layout doesn't jump when the itinerary lands.
- **The dot texture went to the reference's 0.3**, and came off the stops
  panel entirely. At 0.16 it was invisible; on a panel covered by cards it
  only ever showed in the gutters and read as a dashed border. It's kept
  where there's real open space (stat tiles, chart). The **timeline rail is
  gone** for the same reason — a faint dot and line restating what the
  ordering already said.

The landing rotation is six images now: the original coconut-beach photo went
back in alongside the five supplied ones.

### Bugs found and fixed via live testing (don't reintroduce these)

- Gemini's `responseJsonSchema` returns a 400 `INVALID_ARGUMENT` when
  `minItems`/`maxItems` is set on an array-of-*objects* field, despite being
  documented as supported. Fixed by stripping those two keywords from the
  schema handed to Gemini (`stripUnsupportedKeywords` in `lib/schema.js`);
  `ItinerarySchema.safeParse()` still enforces the real bounds afterward.
- `gemini-2.5-flash` is retired for new API keys ("no longer available to new
  users") even though it's still listed by `models.list()`. Switched to the
  `gemini-flash-latest` alias, which Google keeps pointed at a current model.
- The refine request was sending the raw client-side itinerary (ids,
  object-shaped checklist items) instead of `stripIds(itinerary)`, so every
  refinement failed the server's own schema check. Fixed in `page.js`.
- The saved localStorage session persisted whichever prompt ran most
  recently — including refine instructions — into the main "Describe your
  trip" field on reload. Fixed to persist `promptText` (the original create
  prompt) instead of `lastPromptRef.current`.

## Rules that must be strictly followed

1. **Never commit secrets.** `GEMINI_API_KEY` and `OPENROUTER_API_KEY` live
   only in `.env.local` (gitignored). Only `.env.local.example` (placeholder
   values) is committed. Neither key is ever sent to or read from the
   browser — only server routes read `process.env.*`.
2. **Small, meaningful commits as we go — never one giant commit.** Each
   commit should correspond to one logical step from the plan above.
3. **No Claude co-authorship, ever.** Commits are authored solely as
   `Hemanth Amarthi <hemanthkumar.amarthi7@gmail.com>` (local repo git config
   already set this way). Do not add `Co-Authored-By: Claude` or any similar
   trailer to any commit, regardless of default tooling behavior.
4. **Add explanatory comments in the code**, especially around non-obvious
   logic (schema validation, stale-response guarding, retry/timeout logic,
   provider fallback, prompt/schema construction). The user explicitly asked
   for this — it overrides the usual "don't over-comment" default.
5. **No crashes on bad AI output**, ever — malformed JSON, wrong shape, empty
   response, slow response, or failed request must all degrade to a visible
   error/empty state with a Retry option, never a white screen or thrown
   exception the user sees.
6. **Never let a stale response overwrite a newer one.** This is an explicit
   grading criterion — verify it by manually testing rapid repeated submits.
7. **Must work on mobile** — check a narrow viewport before calling any UI
   step done. (Not yet actually verified on a real narrow viewport — see
   step 16 above.)
8. **Test the actual running app in a browser before declaring a UI step
   complete.** Type-checking/lint passing is not the same as the feature
   working. `npx eslint <files>` and `npm run build` both before every
   commit in this project so far — keep doing that.
9. **Before any destructive git operation** (reset --hard, force-push, etc.)
   or before pushing to GitHub, confirm with the user first — this repo is
   public and shared once pushed.
10. **Don't scope-creep beyond what's been asked.** The user explicitly asked
    for all stretch goals, so that's no longer scope creep — but don't add
    *further* unrequested features beyond the assignment + stretch list.
11. Keep this PROGRESS.md up to date as steps complete, so a fresh session
    (or a new Claude Code conversation) has full context without needing the
    prior conversation history.

## Open items / things to do next

Everything from the original plan is done and pushed:
https://github.com/HEMANTH-A-7/trip-planner (public).

- **Mobile layout** — verifiable from the tooling after all, via a trick worth
  reusing: the browser extension can't actually shrink the real viewport, but
  injecting an `<iframe>` at a fixed CSS width (390px) pointed at localhost
  works, because an iframe gets its own independent layout viewport. Checked
  this way for the card redesign (no horizontal overflow, long stop names wrap,
  summary tiles hold three columns). Still worth a glance on a real phone
  before final submission.
- Adjust the "Time spent" figure in README.md to your own actual elapsed
  time — the number currently there is an estimate written from the
  assistant's side of the session, not a real clock measurement.
- Consider rotating the Gemini/OpenRouter keys used during development
  (see README's AI-usage note) since they were pasted into chat rather than
  typed directly into `.env.local`.
- Record the screen-recording the assignment asks for (not something this
  session can produce) before final submission.
