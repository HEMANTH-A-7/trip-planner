"use client";

import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Clock,
  GripVertical,
  Pencil,
  Star,
  Trash2,
  Wallet,
} from "lucide-react";
import { CATEGORY_LABELS, categoryIcon } from "@/lib/categories";
import { formatDuration, formatStopCost } from "@/lib/tripStats";
import StopEditor from "./StopEditor";

export default function StopCard({
  stop,
  isAnchor,
  isFirst,
  isLast,
  isPressed,
  isLifted,
  style,
  defaultCurrency,
  onRemove,
  onUpdate,
  onRequestSuggestion,
  onMoveUp,
  onMoveDown,
  onPressCard,
  onPressHandle,
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
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

  // Dragging the grip needs a pointer of some kind; arrow keys on the focused
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

  const cost = formatStopCost(stop.estimatedCost);
  const duration = formatDuration(stop.durationMinutes);
  const hasMeta = Boolean(stop.category || cost || duration);

  return (
    <li className="relative" style={style}>
      <article
        // Not while the editor is open: holding a card is how you drag it,
        // but inside a form it's how you reach for a word.
        onPointerDown={editing ? undefined : onPressCard}
        className={`liftable min-w-0 flex-1 rounded-[14px] border bg-surface-2 p-3.5 transition-[transform,box-shadow,border-color] duration-150 motion-reduce:transition-none sm:rounded-[16px] sm:p-4 ${
          isLifted
            ? "scale-[1.02] cursor-grabbing border-accent shadow-[0_24px_60px_-12px_rgba(0,0,0,0.75)]"
            : isPressed
              ? "scale-[0.98] border-hairline"
              : isAnchor
                ? // The day's longest stop, and the only card that carries
                  // the accent. One focal point per day beats either four
                  // identical blocks or four different sizes.
                  "border-accent/45 shadow-[0_0_0_1px_color-mix(in_oklab,var(--accent)_18%,transparent)] hover:border-accent/70"
                : "border-hairline hover:border-hairline-strong"
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
            {/* The controls share a line with the time, not with the name.
                Sat beside the name they took a third of the card's width,
                which on a phone broke "Tokyo National Museum in Ueno Park"
                across four lines; the time is short and never fights them. */}
            <div className="flex items-center justify-between gap-2">
              {stop.time || isAnchor ? (
                <p className="type-label flex min-w-0 items-center gap-1.5 text-accent">
                  {isAnchor && (
                    <>
                      <Star size={11} aria-hidden className="shrink-0" />
                      <span className="truncate">Main stop</span>
                      {stop.time && (
                        <span aria-hidden className="text-ink-subtle">
                          ·
                        </span>
                      )}
                    </>
                  )}
                  {stop.time && <span className="type-figure">{stop.time}</span>}
                </p>
              ) : (
                <span />
              )}

              <div className="-mr-1 -mt-1 flex shrink-0 items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  aria-label={`Edit "${stop.name}"`}
                  className="flex h-9 w-9 items-center justify-center rounded-lg sm:h-7 sm:w-7 text-ink-subtle hover:bg-surface hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
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
                {/* Touch keeps its own move controls even though holding a
                    card now drags it: a drag is a gesture you have to know
                    about and be able to perform, and these stay for anyone
                    driving the page through a screen reader, where it isn't
                    on offer at all. */}
                <button
                  type="button"
                  onClick={onMoveUp}
                  disabled={isFirst}
                  aria-label={`Move "${stop.name}" earlier`}
                  className="flex h-9 w-8 items-center justify-center rounded-lg text-ink-subtle disabled:opacity-25 enabled:active:bg-surface enabled:active:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent pointer-fine:hidden"
                >
                  <ChevronUp size={16} aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={onMoveDown}
                  disabled={isLast}
                  aria-label={`Move "${stop.name}" later`}
                  className="flex h-9 w-8 items-center justify-center rounded-lg text-ink-subtle disabled:opacity-25 enabled:active:bg-surface enabled:active:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent pointer-fine:hidden"
                >
                  <ChevronDown size={16} aria-hidden />
                </button>

                {/* Which controls a card offers follows the pointer, not the
                    window width: a handle is for aiming, which a finger can't
                    do at this size, and the buttons are for anyone who can't
                    perform a drag at all. A narrow desktop window is still a
                    mouse, and a wide tablet is still a thumb. */}
                <span className="group/grip relative hidden pointer-fine:block">
                  <button
                    type="button"
                    onPointerDown={onPressHandle}
                    onKeyDown={handleGripKeyDown}
                    aria-label={`Move "${stop.name}" — drag, or use the arrow keys`}
                    // touch-none: the handle is small enough that a finger
                    // landing on it means the handle, never a scroll.
                    className="flex h-9 w-9 cursor-grab touch-none items-center justify-center rounded-lg sm:h-7 sm:w-7 text-ink-subtle hover:bg-surface hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent active:cursor-grabbing"
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

            <h4 className="type-heading mt-1 text-[17px] text-ink">
              {stop.name}
            </h4>

            {stop.description && (
              <p
                ref={bodyRef}
                className={`mt-2.5 text-[13.5px] leading-[1.55] text-ink-muted ${
                  expanded ? "" : "line-clamp-2"
                }`}
              >
                {stop.description}
              </p>
            )}

            {(hasMeta || isClamped) && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                  {/* Chips carry no colour of their own any more. The label
                      already names the category and leads with a glyph, so a
                      tint behind it was decoration - and six of them across a
                      day was the loudest thing on the page. */}
                  {stop.category && (
                    <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full border border-hairline bg-surface-2 px-2.5 py-1 text-[11px] font-medium text-ink-muted">
                      {(() => {
                        const Icon = categoryIcon(stop.category);
                        return <Icon size={11} aria-hidden className="shrink-0" />;
                      })()}
                      <span className="truncate">
                        {CATEGORY_LABELS[stop.category] ?? stop.category}
                      </span>
                    </span>
                  )}
                  {cost && (
                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-hairline bg-surface-2 px-2.5 py-1 text-[11px] text-ink-subtle">
                      <Wallet size={11} aria-hidden />
                      <span className="sr-only">Estimated cost: </span>
                      <span className="type-figure font-medium text-ink">
                        {cost}
                      </span>
                    </span>
                  )}
                  {duration && (
                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-hairline bg-surface-2 px-2.5 py-1 text-[11px] text-ink-subtle">
                      <Clock size={11} aria-hidden />
                      <span className="sr-only">Typical duration: </span>
                      <span className="type-figure font-medium text-ink">
                        {duration}
                      </span>
                    </span>
                  )}
                </div>

                {isClamped && (
                  <button
                    type="button"
                    onClick={() => setExpanded((value) => !value)}
                    aria-expanded={expanded}
                    className="flex shrink-0 items-center gap-1 rounded-lg py-1.5 text-xs font-medium text-ink-subtle transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:py-0"
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
