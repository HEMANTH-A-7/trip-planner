"use client";

import { useState } from "react";

const CATEGORY_LABELS = {
  food: "🍜 Food",
  sightseeing: "🏛️ Sightseeing",
  lodging: "🛏️ Lodging",
  transport: "🚆 Transport",
  activity: "🎟️ Activity",
  other: "📍 Other",
};

export default function StopCard({
  stop,
  isFirst,
  isLast,
  onRemove,
  onMoveUp,
  onMoveDown,
}) {
  const [expanded, setExpanded] = useState(false);
  const hasDetails = Boolean(stop.description);

  return (
    <li className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start gap-2 p-3">
        <button
          type="button"
          onClick={() => hasDetails && setExpanded((v) => !v)}
          aria-expanded={expanded}
          disabled={!hasDetails}
          className="flex flex-1 items-start gap-2 text-left disabled:cursor-default"
        >
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {stop.time && (
                <span className="text-xs font-medium text-zinc-400 dark:text-zinc-500">
                  {stop.time}
                </span>
              )}
              {stop.category && (
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  {CATEGORY_LABELS[stop.category] ?? stop.category}
                </span>
              )}
            </div>
            <p className="font-medium text-zinc-900 dark:text-zinc-100">{stop.name}</p>
            {hasDetails && expanded && (
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                {stop.description}
              </p>
            )}
          </div>
          {hasDetails && (
            <span
              aria-hidden
              className="mt-1 shrink-0 text-zinc-400 transition-transform dark:text-zinc-500"
              style={{ transform: expanded ? "rotate(180deg)" : "none" }}
            >
              ▾
            </span>
          )}
        </button>

        <div className="flex shrink-0 flex-col items-center gap-1">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={isFirst}
            aria-label={`Move "${stop.name}" earlier`}
            className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-30 disabled:hover:bg-transparent dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            ▲
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={isLast}
            aria-label={`Move "${stop.name}" later`}
            className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-30 disabled:hover:bg-transparent dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            ▼
          </button>
        </div>

        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove "${stop.name}"`}
          className="shrink-0 rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
        >
          ✕
        </button>
      </div>
    </li>
  );
}
