# Trip Planner — Progress Tracker

This file is the source of truth for this project's status, plan, and rules.
Read this first in any new session before touching code.

## What this is

A frontend internship take-home assignment: a React app where a user describes
a trip in free text, an LLM (Google Gemini) returns a structured day-by-day
itinerary as JSON, and the app renders it as interactive UI (expand / remove /
reorder stops) — not a chatbot. Grading emphasizes handling bad AI output
(malformed JSON, wrong shape, empty, slow, failed) as much as the happy path.

Full assignment text is preserved in `ASSIGNMENT.md` in this repo.

## Key decisions (already made, don't re-litigate)

| Decision | Choice | Why |
|---|---|---|
| AI provider | Google Gemini (free tier) | User has a key for this; good `responseSchema` JSON mode support |
| Framework | Next.js (App Router), JavaScript, no TypeScript | Bundles frontend + API route as backend in one app; TS is optional/not graded per assignment FAQ |
| Styling | Tailwind CSS | Fast to build responsive/dark-mode UI |
| Validation | Zod | Runtime schema validation of whatever the model returns, independent of Gemini's own JSON mode |
| Reordering | Up/down buttons, not drag-and-drop | More reliable on mobile/touch than DnD libraries; assignment only requires "reorder", not drag |
| Streaming (stretch) | Skipped, documented as a limitation | Partial-JSON streaming + schema validation is high risk/low reward for the time budget; rubric weights "handling bad output" (20%) higher than stretch goals |
| Git identity | `user.name = "Hemanth Amarthi"`, `user.email = hemanthkumar.amarthi7@gmail.com` (set locally in this repo, not global) | Matches how commits would appear if made manually via GitHub/git CLI |
| Commit authorship | Every commit is authored solely by the user. **Claude is never added as a co-author or contributor.** | Explicit user instruction |
| GitHub repo | Public, created via `gh repo create` from this machine | User's explicit choice |

## Architecture

```
trip-planner/
  app/
    api/
      plan-trip/route.js     # POST: prompt -> Gemini -> validated JSON (or refine existing itinerary)
    page.js                  # Main page: form + itinerary view, all client state lives here
    layout.js
    globals.css
  components/
    TripForm.js               # free-text input + submit/retry
    ItineraryView.js           # renders days
    DayCard.js                 # one day: stops + checklist block
    StopCard.js                # one stop: expand/remove
    ChecklistBlock.js           # stretch: packing-list block type
    LoadingState.js / ErrorState.js / EmptyState.js
  lib/
    schema.js                 # zod schema + Gemini responseSchema built from it
    gemini.js                 # thin wrapper around the Gemini SDK call
  .env.local.example
  PROGRESS.md                 # <- this file
  ASSIGNMENT.md               # original assignment text, verbatim
  README.md
```

### Data shape (draft, refine in lib/schema.js as source of truth)

```
Itinerary = {
  destination: string,
  summary?: string,
  days: [
    {
      day: number,
      title?: string,
      stops: [
        { id: string, time?: string, name: string, description?: string, category?: string }
      ],
      packingChecklist?: string[]   // stretch: second "block type"
    }
  ]
}
```

### Failure handling (the part that's actually graded hardest)

- **Malformed JSON** → Gemini call uses `responseMimeType: application/json` +
  `responseSchema`, but the raw text is still `JSON.parse`'d in a try/catch —
  never trust it blindly.
- **Wrong shape** → `zod.safeParse` after parsing. On failure: show an error
  state with Retry, log the raw payload to the server console for debugging.
- **Empty** → if `days` is missing/empty after validation, show an empty state
  ("try describing your trip with a bit more detail") rather than a blank UI.
- **Slow** → loading state with a client-side timeout (~30s) that aborts the
  fetch and surfaces a timeout error with Retry.
- **Failed (network/4xx/5xx/rate limit)** → caught and mapped to a readable
  message; Retry always available.
- **Stale responses** → a monotonically increasing request-id ref plus
  `AbortController`. When a new request starts, the previous one is aborted
  and its eventual resolution is ignored even if it fires late. Never let an
  older response overwrite a newer one's state.

## Plan / step list (also tracked as tasks in-session)

1. [x] Scaffold Next.js app, git init, fix local git identity
2. [x] Write this PROGRESS.md
3. [ ] `.env.local.example`, confirm `.gitignore` excludes `.env*.local`, README skeleton
4. [ ] Zod itinerary schema + validation helper (`lib/schema.js`)
5. [ ] Gemini API route (`app/api/plan-trip/route.js`) with full error handling + refine mode
6. [ ] TripForm + request lifecycle (loading/error/empty, stale-response guard)
7. [ ] Interactive itinerary UI: expand / remove / reorder stops
8. [ ] Responsive styling + dark mode pass
9. [ ] Stretch: localStorage save/reload session
10. [ ] Stretch: refinement loop (follow-up edits to existing itinerary)
11. [ ] Stretch: packing-checklist block type (second block kind)
12. [ ] Get real Gemini key from user, live-test golden + failure paths in browser, check mobile viewport
13. [ ] Finalize README (setup, AI-usage note, limitations, time spent)
14. [ ] `gh repo create` (public) + push

Update the checkboxes above as steps complete. If you're picking this project
back up in a new session, `git log --oneline` plus this checklist tells you
exactly where things stand.

## Rules that must be strictly followed

1. **Never commit secrets.** `GEMINI_API_KEY` lives only in `.env.local`
   (gitignored). Only `.env.local.example` (placeholder values) is committed.
   The API key is never sent to or used from the browser — only the server
   route reads `process.env.GEMINI_API_KEY`.
2. **Small, meaningful commits as we go — never one giant commit.** Each
   commit should correspond to one logical step from the plan above.
3. **No Claude co-authorship, ever.** Commits are authored solely as
   `Hemanth Amarthi <hemanthkumar.amarthi7@gmail.com>` (local repo git config
   already set this way). Do not add `Co-Authored-By: Claude` or any similar
   trailer to any commit, regardless of default tooling behavior.
4. **Add explanatory comments in the code**, especially around non-obvious
   logic (schema validation, stale-response guarding, retry/timeout logic,
   Gemini prompt/schema construction). The user explicitly asked for this —
   it overrides the usual "don't over-comment" default.
5. **No crashes on bad AI output**, ever — malformed JSON, wrong shape, empty
   response, slow response, or failed request must all degrade to a visible
   error/empty state with a Retry option, never a white screen or thrown
   exception the user sees.
6. **Never let a stale response overwrite a newer one.** This is an explicit
   grading criterion — verify it by manually testing rapid repeated submits.
7. **Must work on mobile** — check a narrow viewport (e.g. 375px) before
   calling any UI step done.
8. **Test the actual running app in a browser before declaring a UI step
   complete.** Type-checking/lint passing is not the same as the feature
   working.
9. **Before any destructive git operation** (reset --hard, force-push, etc.)
   or before pushing to GitHub, confirm with the user first — this repo is
   public and shared once pushed.
10. **Don't scope-creep.** Rubric explicitly rewards "a clean, solid core"
    over "a pile of half-working features" — finish the required core fully
    before spending time on stretch goals, and stop adding stretch goals if
    the core needs more polish.
11. Keep this PROGRESS.md up to date as steps complete, so a fresh session
    (or a new Claude Code conversation) has full context without needing the
    prior conversation history.

## Open items / things to ask the user about later

- Need the actual `GEMINI_API_KEY` value added to `.env.local` before live
  testing (step 12) — user will add it directly, not paste it in chat.
- Confirm before pushing to the public GitHub repo (step 14).
