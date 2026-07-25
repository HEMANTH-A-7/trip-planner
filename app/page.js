"use client";

import { useRef, useState } from "react";
import TripForm from "@/components/TripForm";
import LoadingState from "@/components/LoadingState";
import ErrorState from "@/components/ErrorState";
import EmptyState from "@/components/EmptyState";
import ItineraryView from "@/components/ItineraryView";

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

export default function Home() {
  const [status, setStatus] = useState(STATUS.IDLE);
  const [error, setError] = useState(null);
  const [itinerary, setItinerary] = useState(null);

  // Guards against the classic race: two requests in flight, the older one
  // resolves after the newer one. requestIdRef.current only ever moves
  // forward, so a response can check "am I still the most recent request?"
  // before touching state. abortControllerRef additionally cancels the
  // outdated network request outright instead of just ignoring its result.
  const requestIdRef = useRef(0);
  const abortControllerRef = useRef(null);
  const lastPromptRef = useRef("");

  async function runRequest(mode, prompt) {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const isStale = () => requestIdRef.current !== requestId;

    lastPromptRef.current = prompt;
    setStatus(STATUS.LOADING);
    setError(null);

    const timeout = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);

    try {
      const res = await fetch("/api/plan-trip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "refine"
            ? { prompt, mode, itinerary }
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
    } catch (err) {
      if (isStale()) return; // superseded by a newer request; ignore silently
      const message =
        err.name === "AbortError"
          ? "That took too long. Please try again."
          : "Network error — check your connection and try again.";
      setError({ message });
      setStatus(STATUS.ERROR);
    } finally {
      clearTimeout(timeout);
    }
  }

  function handleCreate(prompt) {
    runRequest("create", prompt);
  }

  function handleRetry() {
    runRequest("create", lastPromptRef.current);
  }

  function handleRemoveStop(dayId, stopId) {
    setItinerary((prev) => removeStop(prev, dayId, stopId));
  }

  function handleMoveStop(dayId, stopId, direction) {
    setItinerary((prev) => moveStop(prev, dayId, stopId, direction));
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

        <TripForm onSubmit={handleCreate} disabled={status === STATUS.LOADING} />

        {status === STATUS.LOADING && <LoadingState />}
        {status === STATUS.ERROR && (
          <ErrorState message={error?.message} onRetry={handleRetry} />
        )}
        {status === STATUS.IDLE && <EmptyState />}
        {status === STATUS.SUCCESS && itinerary && (
          <ItineraryView
            itinerary={itinerary}
            onRemoveStop={handleRemoveStop}
            onMoveStop={handleMoveStop}
          />
        )}
      </main>
    </div>
  );
}
