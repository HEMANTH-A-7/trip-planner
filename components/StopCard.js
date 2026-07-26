"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import { CATEGORY_LABELS, CATEGORY_COLORS } from "@/lib/categories";

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
    <li className="rounded-2xl border border-hairline bg-surface-2">
      <div className="flex items-center gap-2 p-3">
        <button
          type="button"
          onClick={() => hasDetails && setExpanded((v) => !v)}
          aria-expanded={expanded}
          disabled={!hasDetails}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-lavender disabled:cursor-default"
        >
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {stop.time && (
                <span className="text-xs font-medium text-ink-subtle">{stop.time}</span>
              )}
              {stop.category && (
                <span className="flex items-center gap-1.5 text-xs text-ink-muted">
                  <span
                    aria-hidden
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: CATEGORY_COLORS[stop.category] }}
                  />
                  {CATEGORY_LABELS[stop.category] ?? stop.category}
                </span>
              )}
            </div>
            <p className="font-medium text-ink">{stop.name}</p>
          </div>
          {hasDetails && (
            <ChevronDown
              aria-hidden
              size={16}
              className="shrink-0 text-ink-subtle transition-transform"
              style={{ transform: expanded ? "rotate(180deg)" : "none" }}
            />
          )}
        </button>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={isFirst}
            aria-label={`Move "${stop.name}" earlier`}
            className="flex h-8 w-8 items-center justify-center rounded-full text-ink-subtle hover:bg-surface hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-lavender disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ChevronUp size={16} aria-hidden />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={isLast}
            aria-label={`Move "${stop.name}" later`}
            className="flex h-8 w-8 items-center justify-center rounded-full text-ink-subtle hover:bg-surface hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-lavender disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ChevronDown size={16} aria-hidden />
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove "${stop.name}"`}
            className="flex h-8 w-8 items-center justify-center rounded-full text-ink-subtle hover:bg-danger-bg hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger"
          >
            <X size={16} aria-hidden />
          </button>
        </div>
      </div>

      {hasDetails && expanded && (
        <p className="px-3 pb-3 text-sm text-ink-muted">{stop.description}</p>
      )}
    </li>
  );
}
