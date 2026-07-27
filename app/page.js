"use client";

import { useEffect, useRef, useState } from "react";
import TripForm from "@/components/TripForm";
import LoadingState from "@/components/LoadingState";
import ErrorState from "@/components/ErrorState";
import Sidebar from "@/components/Sidebar";
import TripHero from "@/components/TripHero";
import LandingHero from "@/components/LandingHero";
import RecentTrips from "@/components/RecentTrips";
import SummaryView from "@/components/SummaryView";
import DayCard from "@/components/DayCard";
import UndoToast from "@/components/UndoToast";
import {
  clearSession,
  loadHistory,
  loadSession,
  removeFromHistory,
  saveSession,
  saveToHistory,
} from "@/lib/storage";
import { stripIds } from "@/lib/schema";
import { applySchedule, readSchedule, withSchedule } from "@/lib/schedule";
import { parseSSE } from "@/lib/sse";

// Slightly above the server's own 30s timeout, so if the server hangs for
// any reason (cold start, network stall) the client still recovers on its
// own instead of spinning forever.
const CLIENT_TIMEOUT_MS = 35_000;
const UNDO_TIMEOUT_MS = 5_000;

const STATUS = { IDLE: "idle", LOADING: "loading", ERROR: "error", SUCCESS: "success" };
const VIEW = { ITINERARY: "itinerary", SUMMARY: "summary" };

// Every structural change to a day goes through here, which is what keeps
// the day's start times pinned to slots rather than riding along with the
// stops that move between them - see lib/schedule.js.
function mapDay(itinerary, dayId, mutate) {
  return {
    ...itinerary,
    days: itinerary.days.map((day) =>
      day.id !== dayId ? day : { ...day, stops: withSchedule(day.stops, mutate) }
    ),
  };
}

function removeStop(itinerary, dayId, stopId) {
  return mapDay(itinerary, dayId, (stops) => stops.filter((s) => s.id !== stopId));
}

// Undo, so it restores the schedule captured before the removal rather than
// re-deriving one from the shortened day - otherwise putting a stop back
// would leave everything after it an hour early.
function insertStopAt(itinerary, dayId, stop, index, schedule) {
  return {
    ...itinerary,
    days: itinerary.days.map((day) => {
      if (day.id !== dayId) return day;
      const stops = [...day.stops];
      stops.splice(index, 0, stop);
      return { ...day, stops: applySchedule(stops, schedule) };
    }),
  };
}

function moveStop(itinerary, dayId, stopId, direction) {
  return mapDay(itinerary, dayId, (stops) => {
    const index = stops.findIndex((s) => s.id === stopId);
    const target = index + direction;
    if (index === -1 || target < 0 || target >= stops.length) return stops;
    const next = [...stops];
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  });
}

// Drag-and-drop reorder: lift the stop out and reinsert it at the target
// index, shifting everything between. Deliberately not the literal two-item
// swap moveStop() does - dragging a card three positions down should leave
// the cards it passed in their original order, not fling one of them back up
// to where the dragged card started.
function reorderStop(itinerary, dayId, fromIndex, toIndex) {
  return mapDay(itinerary, dayId, (stops) => {
    const inRange = (i) => i >= 0 && i < stops.length;
    if (fromIndex === toIndex || !inRange(fromIndex) || !inRange(toIndex)) {
      return stops;
    }
    const next = [...stops];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    return next;
  });
}

function renameStop(itinerary, dayId, stopId, name) {
  return {
    ...itinerary,
    days: itinerary.days.map((day) =>
      day.id !== dayId
        ? day
        : {
            ...day,
            stops: day.stops.map((stop) =>
              stop.id === stopId ? { ...stop, name } : stop
            ),
          }
    ),
  };
}

// Identifies a trip across its own refinements, so history updates the same
// entry rather than appending one per edit. Only ever compared, never parsed.
function makeTripId() {
  return `trip-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function toggleChecklistItem(itinerary, dayId, itemId) {
  return {
    ...itinerary,
    days: itinerary.days.map((day) =>
      day.id !== dayId
        ? day
        : {
            ...day,
            packingChecklist: day.packingChecklist?.map((item) =>
              item.id === itemId ? { ...item, checked: !item.checked } : item
            ),
          }
    ),
  };
}

export default function Home() {
  const [status, setStatus] = useState(STATUS.IDLE);
  const [error, setError] = useState(null);
  const [itinerary, setItinerary] = useState(null);
  const [promptText, setPromptText] = useState("");
  // A removed stop isn't gone yet - it's held here with enough to reinsert
  // it (which day, and at what index) until the undo window lapses.
  const [pendingUndo, setPendingUndo] = useState(null);
  const undoTimeoutRef = useRef(null);

  // Guards against the classic race: two requests in flight, the older one
  // resolves after the newer one. requestIdRef.current only ever moves
  // forward, so a response can check "am I still the most recent request?"
  // before touching state. abortControllerRef additionally cancels the
  // outdated network request outright instead of just ignoring its result.
  const requestIdRef = useRef(0);
  const abortControllerRef = useRef(null);
  const lastPromptRef = useRef("");
  // So Retry re-runs whichever action actually failed: retrying a failed
  // refinement must re-apply the edit, not silently fall back to
  // regenerating the whole itinerary from scratch.
  const lastRequestModeRef = useRef("create");
  const [refinePromptText, setRefinePromptText] = useState("");
  // null = not streaming; "" or more = live text accumulated so far.
  const [streamingText, setStreamingText] = useState(null);
  // Which half of the app the sidebar is pointing at, and which day's cards
  // the itinerary view is showing.
  const [view, setView] = useState(VIEW.ITINERARY);
  const [selectedDayId, setSelectedDayId] = useState(null);
  // Past trips, newest first, and the id of the one currently open. A trip
  // keeps its id across refinements so edits update its history entry in
  // place instead of piling up a new entry per edit.
  const [history, setHistory] = useState([]);
  const [tripId, setTripId] = useState(null);

  // Restore a previous session on load. Deliberately an effect rather than a
  // lazy useState initializer: a lazy initializer would run during the
  // client's first (hydration) render and return different output than the
  // server-rendered HTML (which has no access to localStorage), causing a
  // hydration mismatch. Running this post-mount, client-only, is correct
  // here despite the lint rule's generic advice against setState-in-effect.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect --
       one-time hydration from localStorage, see comment above */
    setHistory(loadHistory());
    const session = loadSession();
    if (!session) return;
    setItinerary(session.itinerary);
    setStatus(STATUS.SUCCESS);
    setPromptText(session.prompt ?? "");
    setTripId(session.tripId ?? null);
    /* eslint-enable react-hooks/set-state-in-effect */
    lastPromptRef.current = session.prompt ?? "";
  }, []);

  // Save-as-you-go: every change (generate, remove, reorder, tick a
  // checklist item) persists so a reload picks up where you left off. Saves
  // promptText (the original trip description) rather than
  // lastPromptRef.current, which tracks whichever request ran most
  // recently and would leak a refinement instruction into the main field.
  //
  // The same write keeps the trip's history entry current, so reopening it
  // later restores the edited itinerary rather than the freshly generated one.
  useEffect(() => {
    if (status !== STATUS.SUCCESS || !itinerary) return;
    saveSession({ itinerary, prompt: promptText, tripId });
    if (!tripId) return;
    /* eslint-disable-next-line react-hooks/set-state-in-effect --
       mirroring what was just written to localStorage, not deriving state */
    setHistory(
      saveToHistory({
        id: tripId,
        destination: itinerary.destination,
        prompt: promptText,
        savedAt: Date.now(),
        itinerary,
      })
    );
  }, [itinerary, status, promptText, tripId]);

  // Not a state-hydration concern like the two effects above - just
  // clearing a plain timer on unmount so it can't fire setState afterward.
  useEffect(() => {
    return () => clearTimeout(undoTimeoutRef.current);
  }, []);

  async function runRequest(mode, prompt) {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const isStale = () => requestIdRef.current !== requestId;

    lastPromptRef.current = prompt;
    lastRequestModeRef.current = mode;
    setStatus(STATUS.LOADING);
    setError(null);

    const timeout = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);

    try {
      const res = await fetch("/api/plan-trip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "refine"
            ? { prompt, mode, itinerary: stripIds(itinerary) }
            : { prompt, mode: "create" }
        ),
        signal: controller.signal,
      });

      let data;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (isStale()) return; // a newer request has since taken over

      if (!res.ok || !data) {
        setError({
          message: data?.message ?? "Something went wrong. Please try again.",
        });
        setStatus(STATUS.ERROR);
        return;
      }

      // A refine edits the open trip and keeps its id; a create starts a new
      // one and therefore a new history entry.
      if (mode !== "refine") setTripId(makeTripId());
      setItinerary(data.itinerary);
      setStatus(STATUS.SUCCESS);
      return true;
    } catch (err) {
      if (isStale()) return false; // superseded by a newer request; ignore silently
      const message =
        err.name === "AbortError"
          ? "That took too long. Please try again."
          : "Network error — check your connection and try again.";
      setError({ message });
      setStatus(STATUS.ERROR);
      return false;
    } finally {
      clearTimeout(timeout);
    }
  }

  // Streams the initial generation for a live preview, then falls back to
  // the plain (non-streaming) request - which still has the full
  // Gemini -> OpenRouter chain - if streaming fails for any reason. See
  // app/api/plan-trip/stream/route.js for why streaming itself has no
  // fallback of its own.
  async function runStreamingCreate(prompt) {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const isStale = () => requestIdRef.current !== requestId;

    lastPromptRef.current = prompt;
    lastRequestModeRef.current = "create";
    setStatus(STATUS.LOADING);
    setError(null);
    setStreamingText("");

    const timeout = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);

    try {
      const res = await fetch("/api/plan-trip/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        throw new Error("Streaming endpoint unavailable");
      }

      for await (const event of parseSSE(res)) {
        if (isStale()) return; // a newer request has since taken over

        if (event.type === "chunk") {
          setStreamingText((prev) => (prev ?? "") + event.text);
        } else if (event.type === "done") {
          setStreamingText(null);
          setTripId(makeTripId()); // streaming is create-only, always a new trip
          setItinerary(event.itinerary);
          setStatus(STATUS.SUCCESS);
          return;
        } else if (event.type === "error") {
          throw new Error(event.message || "Streaming failed");
        }
      }
      throw new Error("Stream ended without a result");
    } catch (err) {
      if (isStale()) return; // superseded; the newer request owns the UI now
      setStreamingText(null);
      if (err.name === "AbortError") {
        setError({ message: "That took too long. Please try again." });
        setStatus(STATUS.ERROR);
        return;
      }
      console.warn(
        "Streaming generation failed, falling back to a plain request:",
        err
      );
      await runRequest("create", prompt);
    } finally {
      clearTimeout(timeout);
    }
  }

  function handleCreate(prompt) {
    setPromptText(prompt);
    runStreamingCreate(prompt);
  }

  function handleRetry() {
    runRequest(lastRequestModeRef.current, lastPromptRef.current);
  }

  async function handleRefine(prompt) {
    const ok = await runRequest("refine", prompt);
    if (ok) setRefinePromptText(""); // ready for the next follow-up
  }

  function handleRemoveStop(dayId, stopId) {
    const day = itinerary.days.find((d) => d.id === dayId);
    const index = day.stops.findIndex((s) => s.id === stopId);
    const stop = day.stops[index];

    // Only one undo slot: removing a second stop before the first's toast
    // expires finalizes the first (no reinsert for it) in favor of the new
    // one, rather than trying to stack multiple pending undos.
    clearTimeout(undoTimeoutRef.current);
    setPendingUndo({ dayId, stop, index, schedule: readSchedule(day.stops) });
    undoTimeoutRef.current = setTimeout(() => setPendingUndo(null), UNDO_TIMEOUT_MS);

    setItinerary((prev) => removeStop(prev, dayId, stopId));
  }

  function handleUndoRemove() {
    if (!pendingUndo) return;
    clearTimeout(undoTimeoutRef.current);
    const { dayId, stop, index, schedule } = pendingUndo;
    setItinerary((prev) => insertStopAt(prev, dayId, stop, index, schedule));
    setPendingUndo(null);
  }

  function handleMoveStop(dayId, stopId, direction) {
    setItinerary((prev) => moveStop(prev, dayId, stopId, direction));
  }

  function handleReorderStop(dayId, fromIndex, toIndex) {
    setItinerary((prev) => reorderStop(prev, dayId, fromIndex, toIndex));
  }

  function handleRenameStop(dayId, stopId, name) {
    setItinerary((prev) => renameStop(prev, dayId, stopId, name));
  }

  function handleSelectDay(dayId) {
    setSelectedDayId(dayId);
    setView(VIEW.ITINERARY);
  }

  // Reopening a stored trip is purely local - no request, no tokens spent.
  // Any in-flight request is marked stale first so a slow response can't
  // overwrite the trip that was just opened.
  function handleLoadTrip(trip) {
    abortControllerRef.current?.abort();
    requestIdRef.current += 1;
    setItinerary(trip.itinerary);
    setTripId(trip.id);
    setPromptText(trip.prompt ?? "");
    setStatus(STATUS.SUCCESS);
    setError(null);
    setStreamingText(null);
    setRefinePromptText("");
    setSelectedDayId(null); // falls back to day 1, see selectedDay below
    setView(VIEW.ITINERARY);
    lastPromptRef.current = trip.prompt ?? "";
  }

  function handleDeleteTrip(id) {
    setHistory(removeFromHistory(id));
    // Deleting the trip that's currently open would leave the sidebar
    // pointing at something that no longer exists, so clear the workspace
    // too - the itinerary itself is what was just discarded.
    if (id === tripId) handleStartOver();
  }

  function handleToggleChecklistItem(dayId, itemId) {
    setItinerary((prev) => toggleChecklistItem(prev, dayId, itemId));
  }

  // Escape hatch now that create and refine share one box: once an
  // itinerary exists there's no other way to start a fresh trip. Bumping
  // requestIdRef marks any in-flight request stale, same mechanism the
  // race-guard above already relies on, so a slow response can't repopulate
  // state after the reset.
  function handleStartOver() {
    abortControllerRef.current?.abort();
    requestIdRef.current += 1;
    clearSession();
    setItinerary(null);
    setStatus(STATUS.IDLE);
    setError(null);
    setStreamingText(null);
    setPromptText("");
    setRefinePromptText("");
    setView(VIEW.ITINERARY);
    setSelectedDayId(null);
    setTripId(null);
    lastPromptRef.current = "";
  }

  // Resolved rather than stored in state: a refinement rebuilds the itinerary
  // with fresh ids, so the selected id goes stale on every successful refine.
  // Falling back to the first day here means that fixes itself, with no effect
  // syncing state to props.
  const selectedDay =
    itinerary?.days.find((day) => day.id === selectedDayId) ??
    itinerary?.days[0] ??
    null;

  // The landing is a full-bleed photo with no sidebar - nothing framing it,
  // just the headline and the search bar at the bottom of the viewport. The
  // sidebar only appears once there's a trip for it to navigate.
  if (!itinerary) {
    return (
      <div className="min-h-[100svh] bg-canvas">
        <LandingHero
          status={
            status === STATUS.ERROR ? (
              <ErrorState message={error?.message} onRetry={handleRetry} />
            ) : null
          }
        >
          <TripForm
            id="trip-prompt"
            label="Describe your trip"
            labelHidden
            submitLabel="Plan my trip"
            pendingLabel="Planning…"
            value={promptText}
            onChange={setPromptText}
            onSubmit={handleCreate}
            disabled={status === STATUS.LOADING}
            // The live preview renders inside the box itself, so nothing
            // else on the landing has to make room for it.
            streamingText={status === STATUS.LOADING ? streamingText : null}
          />
        </LandingHero>

        {/* The sidebar normally carries trip history; with no sidebar here,
            this is the only way back to a saved trip from the landing. */}
        <RecentTrips
          history={history}
          onLoadTrip={handleLoadTrip}
          onDeleteTrip={handleDeleteTrip}
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-[100svh] flex-col bg-canvas lg:flex-row">
      <Sidebar
        itinerary={itinerary}
        view={view}
        onViewChange={setView}
        selectedDayId={selectedDay?.id ?? null}
        onSelectDay={handleSelectDay}
        onStartOver={handleStartOver}
        history={history}
        activeTripId={tripId}
        onLoadTrip={handleLoadTrip}
        onDeleteTrip={handleDeleteTrip}
      />

      <main className="min-w-0 flex-1">
          <TripHero itinerary={itinerary} dayCount={itinerary.days.length} />

          <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8 xl:max-w-4xl">
            {view === VIEW.SUMMARY ? (
              <SummaryView itinerary={itinerary} onSelectDay={handleSelectDay} />
            ) : (
              <div className="flex flex-col gap-6">
                {/* A failed refinement only means the *attempted* edit didn't
                    apply - the existing day is still valid and shouldn't
                    disappear behind its own error message. It's hidden only
                    while a request is in flight, so it's never ambiguous
                    which itinerary (old or incoming) is on screen. */}
                {status === STATUS.LOADING ? (
                  <LoadingState />
                ) : (
                  selectedDay && (
                    <DayCard
                      key={selectedDay.id}
                      day={selectedDay}
                      onRemoveStop={handleRemoveStop}
                      onMoveStop={handleMoveStop}
                      onRenameStop={handleRenameStop}
                      onReorderStop={handleReorderStop}
                      onToggleChecklistItem={handleToggleChecklistItem}
                    />
                  )
                )}

                {status === STATUS.ERROR && (
                  <ErrorState message={error?.message} onRetry={handleRetry} />
                )}

                <TripForm
                  id="refine-prompt"
                  label="Refine this itinerary"
                  placeholder="e.g. swap day 2's museum for something outdoors"
                  submitLabel="Apply change"
                  pendingLabel="Applying…"
                  value={refinePromptText}
                  onChange={setRefinePromptText}
                  onSubmit={handleRefine}
                  disabled={status === STATUS.LOADING}
                />
              </div>
            )}
          </div>
      </main>

      {pendingUndo && (
        <UndoToast stopName={pendingUndo.stop.name} onUndo={handleUndoRemove} />
      )}
    </div>
  );
}
