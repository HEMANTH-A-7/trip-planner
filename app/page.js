"use client";

import { useEffect, useRef, useState } from "react";
import TripForm from "@/components/TripForm";
import LoadingState from "@/components/LoadingState";
import ErrorState from "@/components/ErrorState";
import EmptyState from "@/components/EmptyState";
import ItineraryView from "@/components/ItineraryView";
import { loadSession, saveSession } from "@/lib/storage";
import { stripIds } from "@/lib/schema";

// Slightly above the server's own 30s timeout, so if the server hangs for
// any reason (cold start, network stall) the client still recovers on its
// own instead of spinning forever.
const CLIENT_TIMEOUT_MS = 35_000;

const STATUS = { IDLE: "idle", LOADING: "loading", ERROR: "error", SUCCESS: "success" };

function removeStop(itinerary, dayId, stopId) {
  return {
    ...itinerary,
    days: itinerary.days.map((day) =>
      day.id !== dayId
        ? day
        : { ...day, stops: day.stops.filter((s) => s.id !== stopId) }
    ),
  };
}

function moveStop(itinerary, dayId, stopId, direction) {
  return {
    ...itinerary,
    days: itinerary.days.map((day) => {
      if (day.id !== dayId) return day;
      const index = day.stops.findIndex((s) => s.id === stopId);
      const target = index + direction;
      if (index === -1 || target < 0 || target >= day.stops.length) return day;
      const stops = [...day.stops];
      [stops[index], stops[target]] = [stops[target], stops[index]];
      return { ...day, stops };
    }),
  };
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

  // Restore a previous session on load. Deliberately an effect rather than a
  // lazy useState initializer: a lazy initializer would run during the
  // client's first (hydration) render and return different output than the
  // server-rendered HTML (which has no access to localStorage), causing a
  // hydration mismatch. Running this post-mount, client-only, is correct
  // here despite the lint rule's generic advice against setState-in-effect.
  useEffect(() => {
    const session = loadSession();
    if (!session) return;
    /* eslint-disable react-hooks/set-state-in-effect --
       one-time hydration from localStorage, see comment above */
    setItinerary(session.itinerary);
    setStatus(STATUS.SUCCESS);
    setPromptText(session.prompt ?? "");
    /* eslint-enable react-hooks/set-state-in-effect */
    lastPromptRef.current = session.prompt ?? "";
  }, []);

  // Save-as-you-go: every change (generate, remove, reorder, tick a
  // checklist item) persists so a reload picks up where you left off. Saves
  // promptText (the original trip description) rather than
  // lastPromptRef.current, which tracks whichever request ran most
  // recently and would leak a refinement instruction into the main field.
  useEffect(() => {
    if (status === STATUS.SUCCESS && itinerary) {
      saveSession({ itinerary, prompt: promptText });
    }
  }, [itinerary, status, promptText]);

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

  function handleCreate(prompt) {
    setPromptText(prompt);
    runRequest("create", prompt);
  }

  function handleRetry() {
    runRequest(lastRequestModeRef.current, lastPromptRef.current);
  }

  async function handleRefine(prompt) {
    const ok = await runRequest("refine", prompt);
    if (ok) setRefinePromptText(""); // ready for the next follow-up
  }

  function handleRemoveStop(dayId, stopId) {
    setItinerary((prev) => removeStop(prev, dayId, stopId));
  }

  function handleMoveStop(dayId, stopId, direction) {
    setItinerary((prev) => moveStop(prev, dayId, stopId, direction));
  }

  function handleToggleChecklistItem(dayId, itemId) {
    setItinerary((prev) => toggleChecklistItem(prev, dayId, itemId));
  }

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-8 dark:bg-black sm:px-6">
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <header>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            Trip Planner
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Describe a trip in plain language and get an editable, day-by-day
            itinerary.
          </p>
        </header>

        <TripForm
          value={promptText}
          onChange={setPromptText}
          onSubmit={handleCreate}
          disabled={status === STATUS.LOADING}
        />

        {status === STATUS.LOADING && <LoadingState />}
        {status === STATUS.ERROR && (
          <ErrorState message={error?.message} onRetry={handleRetry} />
        )}
        {status === STATUS.IDLE && !itinerary && <EmptyState />}

        {/* Rendered whenever we HAVE an itinerary, independent of the status
            above - a failed refinement only means the *attempted* edit
            didn't apply; the existing itinerary is still valid and
            shouldn't disappear behind its own error message. Hidden while a
            request is in flight so it's unambiguous which itinerary (old or
            incoming) is on screen. */}
        {itinerary && status !== STATUS.LOADING && (
          <>
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
            <ItineraryView
              itinerary={itinerary}
              onRemoveStop={handleRemoveStop}
              onMoveStop={handleMoveStop}
              onToggleChecklistItem={handleToggleChecklistItem}
            />
          </>
        )}
      </main>
    </div>
  );
}
