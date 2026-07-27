"use client";

import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Clock,
  GripVertical,
  Pencil,
  Trash2,
  Wallet,
} from "lucide-react";
import { CATEGORY_COLORS, CATEGORY_LABELS } from "@/lib/categories";
import { formatDuration, formatStopCost } from "@/lib/tripStats";
import StopEditor from "./StopEditor";

export default function StopCard({
  stop,
  isFirst,
  isLast,
  isDragging,
  isDropTarget,
  defaultCurrency,
  onRemove,
  onUpdate,
  onRequestSuggestion,
  onMoveUp,
  onMoveDown,
  onDragStart,
  onDragEnter,
  onDrop,
  onDragEnd,
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  // True only while the grip is held down. The card must not be draggable the
  // rest of the time, or selecting its text turns into a drag instead.
  const [dragArmed, setDragArmed] = useState(false);
  // Whether the description actually overflows its two-line clamp - measured
  // rather than guessed from string length, so "Expand details" only shows up
  // when there's genuinely something left to reveal.
  const [isClamped, setIsClamped] = useState(false);

  const bodyRef = useRef(null);

  useEffect(() => {
    const el = bodyRef.current;
    // Measuring while expanded always reports "fits" (the clamp is off), so
    // skip it and keep the value the collapsed measurement produced.
    if (!el || expanded) return;

    let cancelled = false;
    const measure = () => {
      if (!cancelled) setIsClamped(el.scrollHeight > el.clientHeight + 1);
    };

    measure();
    // Width changes (viewport resize) change how many lines the text takes.
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    // A late webfont swap re-flows the text without changing the clamped
    // element's box, so the observer above never fires for it.
    document.fonts?.ready.then(measure).catch(() => {});

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [expanded, stop.description]);

  function handleSave(patch) {
    onUpdate(patch);
    setEditing(false);
  }

  // The grip is the one reorder control, so it has to work without a mouse
  // too: HTML5 drag-and-drop is pointer-only, and arrow keys on the focused
  // handle cover the keyboard case with no extra UI.
  function handleGripKeyDown(event) {
    if (event.key === "ArrowUp" && !isFirst) {
      event.preventDefault();
      onMoveUp();
    } else if (event.key === "ArrowDown" && !isLast) {
      event.preventDefault();
      onMoveDown();
    }
  }

  const accent = stop.category ? CATEGORY_COLORS[stop.category] : null;
  const cost = formatStopCost(stop.estimatedCost);
  const duration = formatDuration(stop.durationMinutes);
  const hasMeta = Boolean(stop.category || cost || duration);

  return (
    <li className="relative flex gap-3 sm:gap-4">
      {/* Timeline rail: a dot per stop, joined by a line that reaches into
          the list's row gap so it meets the next dot. */}
      <div aria-hidden className="relative w-2.5 shrink-0">
        <span
          className={`absolute left-0 top-5 h-2.5 w-2.5 rounded-full border-2 ${
            isFirst
              ? "border-accent-peach bg-accent-peach"
              : "border-hairline-strong bg-surface"
          }`}
        />
        {!isLast && (
          <span className="absolute bottom-[-1rem] left-[0.4375rem] top-9 w-px bg-hairline-strong" />
        )}
      </div>

      <article
        draggable={dragArmed}
        onDragStart={onDragStart}
        onDragEnter={onDragEnter}
        onDragOver={(event) => event.preventDefault()} // required for the drop to fire
        onDrop={onDrop}
        onDragEnd={() => {
          setDragArmed(false);
          onDragEnd();
        }}
        className={`min-w-0 flex-1 rounded-2xl border bg-surface-2 p-4 transition-[opacity,border-color] ${
          isDragging ? "opacity-40" : "opacity-100"
        } ${
          isDropTarget
            ? "border-dashed border-accent-lavender"
            : "border-hairline"
        }`}
      >
        {editing ? (
          <StopEditor
            stop={stop}
            fieldId={stop.id}
            defaultCurrency={defaultCurrency}
            onSave={handleSave}
            onCancel={() => setEditing(false)}
            onRequestSuggestion={onRequestSuggestion}
          />
        ) : (
          <>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                {stop.time && (
                  <p className="text-xs font-semibold text-ink-muted">{stop.time}</p>
                )}
                <h4 className="mt-0.5 text-[0.9375rem] font-semibold leading-snug text-ink">
                  {stop.name}
                </h4>
              </div>

              <div className="flex shrink-0 items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  aria-label={`Edit "${stop.name}"`}
                  className="flex h-9 w-9 items-center justify-center rounded-lg sm:h-7 sm:w-7 text-ink-subtle hover:bg-surface hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-lavender"
                >
                  <Pencil size={14} aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={onRemove}
                  aria-label={`Remove "${stop.name}"`}
                  className="flex h-9 w-9 items-center justify-center rounded-lg sm:h-7 sm:w-7 text-ink-subtle hover:bg-danger-bg hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger"
                >
                  <Trash2 size={14} aria-hidden />
                </button>
                {/* Touch gets its own move controls. The grip beside them
                    reorders via HTML5 drag-and-drop, which has no touch
                    equivalent at all - dragstart never fires from a finger -
                    so on a phone the grip was a button that did nothing, and
                    its arrow-key fallback needs a keyboard that isn't there.
                    Two explicit buttons are unglamorous next to a drag, but
                    they're the only version of this that works one-thumbed. */}
                <button
                  type="button"
                  onClick={onMoveUp}
                  disabled={isFirst}
                  aria-label={`Move "${stop.name}" earlier`}
                  className="flex h-9 w-8 items-center justify-center rounded-lg text-ink-subtle disabled:opacity-25 enabled:active:bg-surface enabled:active:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-lavender sm:hidden"
                >
                  <ChevronUp size={16} aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={onMoveDown}
                  disabled={isLast}
                  aria-label={`Move "${stop.name}" later`}
                  className="flex h-9 w-8 items-center justify-center rounded-lg text-ink-subtle disabled:opacity-25 enabled:active:bg-surface enabled:active:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-lavender sm:hidden"
                >
                  <ChevronDown size={16} aria-hidden />
                </button>

                <span className="group/grip relative hidden sm:block">
                  <button
                    type="button"
                    onMouseDown={() => setDragArmed(true)}
                    onMouseUp={() => setDragArmed(false)}
                    onKeyDown={handleGripKeyDown}
                    aria-label={`Move "${stop.name}" — drag, or use the arrow keys`}
                    className="flex h-9 w-9 cursor-grab items-center justify-center rounded-lg sm:h-7 sm:w-7 text-ink-subtle hover:bg-surface hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-lavender active:cursor-grabbing"
                  >
                    <GripVertical size={14} aria-hidden />
                  </button>
                  <span
                    aria-hidden
                    className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 rounded-md bg-ink px-1.5 py-1 text-[10px] font-medium leading-none text-canvas opacity-0 transition-opacity group-hover/grip:opacity-100 group-focus-within/grip:opacity-100"
                  >
                    Move
                  </span>
                </span>
              </div>
            </div>

            {stop.description && (
              <p
                ref={bodyRef}
                className={`mt-2 text-sm leading-relaxed text-ink-muted ${
                  expanded ? "" : "line-clamp-2"
                }`}
              >
                {stop.description}
              </p>
            )}

            {(hasMeta || isClamped) && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                  {stop.category && (
                    <span
                      className="inline-flex min-w-0 items-center rounded-full px-2.5 py-1 text-[11px] font-medium text-ink-muted"
                      // The tinted background carries the category; the label
                      // keeps a text token, because the accents are pastels that
                      // would fail contrast as text on the light theme's white
                      // surface. No colour dot here - CATEGORY_LABELS already
                      // leads with an emoji, and the two read as two icons.
                      style={{
                        background: `color-mix(in oklab, ${accent} 16%, transparent)`,
                      }}
                    >
                      <span className="truncate">
                        {CATEGORY_LABELS[stop.category] ?? stop.category}
                      </span>
                    </span>
                  )}
                  {cost && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-surface px-2.5 py-1 text-[11px] font-medium text-ink-muted">
                      <Wallet size={11} aria-hidden />
                      <span className="sr-only">Estimated cost: </span>
                      {cost}
                    </span>
                  )}
                  {duration && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-surface px-2.5 py-1 text-[11px] font-medium text-ink-muted">
                      <Clock size={11} aria-hidden />
                      <span className="sr-only">Typical duration: </span>
                      {duration}
                    </span>
                  )}
                </div>

                {isClamped && (
                  <button
                    type="button"
                    onClick={() => setExpanded((value) => !value)}
                    aria-expanded={expanded}
                    className="flex shrink-0 items-center gap-1 rounded-lg py-1.5 text-xs font-medium text-ink-subtle hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-lavender sm:py-0"
                  >
                    {expanded ? "Show less" : "Expand details"}
                    <ChevronDown
                      aria-hidden
                      size={13}
                      className="transition-transform"
                      style={{ transform: expanded ? "rotate(180deg)" : "none" }}
                    />
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </article>
    </li>
  );
}
