"use client";

import { useState } from "react";
import { CATEGORY_LABELS } from "@/lib/categories";

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
          className="flex flex-1 items-start gap-2 rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:cursor-default dark:focus-visible:ring-zinc-600"
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
            className="flex h-9 w-9 items-center justify-center rounded text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:opacity-30 disabled:hover:bg-transparent dark:hover:bg-zinc-800 dark:hover:text-zinc-200 dark:focus-visible:ring-zinc-600"
          >
            ▲
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={isLast}
            aria-label={`Move "${stop.name}" later`}
            className="flex h-9 w-9 items-center justify-center rounded text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:opacity-30 disabled:hover:bg-transparent dark:hover:bg-zinc-800 dark:hover:text-zinc-200 dark:focus-visible:ring-zinc-600"
          >
            ▼
          </button>
        </div>

        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove "${stop.name}"`}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded text-zinc-400 hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 dark:hover:bg-red-950/40 dark:hover:text-red-400 dark:focus-visible:ring-red-700"
        >
          ✕
        </button>
      </div>
    </li>
  );
}
