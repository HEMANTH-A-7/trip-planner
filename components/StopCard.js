"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Clock, GripVertical, Pencil, Trash2, Wallet } from "lucide-react";
import { CATEGORY_COLORS, CATEGORY_LABELS } from "@/lib/categories";
import { formatDuration, formatStopCost } from "@/lib/tripStats";

export default function StopCard({
  stop,
  isFirst,
  isLast,
  isDragging,
  isDropTarget,
  onRemove,
  onRename,
  onMoveUp,
  onMoveDown,
  onDragStart,
  onDragEnter,
  onDrop,
  onDragEnd,
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(stop.name);
  // True only while the grip is held down. The card must not be draggable the
  // rest of the time, or selecting its text turns into a drag instead.
  const [dragArmed, setDragArmed] = useState(false);
  // Whether the description actually overflows its two-line clamp - measured
  // rather than guessed from string length, so "Expand details" only shows up
  // when there's genuinely something left to reveal.
  const [isClamped, setIsClamped] = useState(false);

  const inputRef = useRef(null);
  const bodyRef = useRef(null);
  // Set by Escape so the blur it triggers discards the edit instead of
  // saving it. Enter deliberately just blurs the input, which keeps commit
  // logic on a single path rather than duplicating it across two handlers.
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

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

  function commitRename() {
    setEditing(false);
    if (cancelledRef.current) {
      cancelledRef.current = false;
      setDraft(stop.name);
      return;
    }
    const trimmed = draft.trim();
    // An emptied field is a mistake, not a request to have a nameless stop.
    if (!trimmed) {
      setDraft(stop.name);
      return;
    }
    if (trimmed !== stop.name) onRename(trimmed);
  }

  function handleNameKeyDown(event) {
    if (event.key === "Enter") {
      event.preventDefault();
      inputRef.current?.blur();
    } else if (event.key === "Escape") {
      event.preventDefault();
      cancelledRef.current = true;
      inputRef.current?.blur();
    }
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
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            {stop.time && (
              <p className="text-xs font-semibold text-ink-muted">{stop.time}</p>
            )}
            {editing ? (
              <input
                ref={inputRef}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleNameKeyDown}
                onBlur={commitRename}
                aria-label={`Rename "${stop.name}"`}
                maxLength={120}
                className="mt-0.5 w-full rounded-lg border border-hairline-strong bg-surface px-2 py-1 text-[0.9375rem] font-semibold text-ink focus:outline-none focus:ring-2 focus:ring-accent-lavender"
              />
            ) : (
              <h4 className="mt-0.5 text-[0.9375rem] font-semibold leading-snug text-ink">
                {stop.name}
              </h4>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              onClick={() => setEditing(true)}
              aria-label={`Rename "${stop.name}"`}
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
            <span className="group/grip relative">
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
      </article>
    </li>
  );
}
