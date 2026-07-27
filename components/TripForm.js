"use client";

import { useEffect, useRef } from "react";

const MAX_LENGTH = 2000;

// Controlled (value/onChange come from the parent) so the same component can
// restore a saved prompt on reload and be reused for the refinement-loop
// input, which needs its own value alongside the main one.
export default function TripForm({
  id = "trip-prompt",
  label = "Describe your trip",
  placeholder = "e.g. 4 days in Kyoto in April, mostly temples and food, budget-friendly, no early mornings",
  value,
  onChange,
  onSubmit,
  disabled,
  submitLabel = "Plan my trip",
  pendingLabel = "Planning…",
  // On the landing hero the headline already says what to type, and the
  // label would sit on the photo where the theme's ink token has no
  // guaranteed contrast. Hidden visually, still read by screen readers.
  labelHidden = false,
  // Raw model output while a generation streams. Rendered as an overlay on
  // top of the textarea rather than as a sibling, so the box it appears in
  // is exactly the size it always was - the textarea underneath still
  // defines the height, the overlay just covers it.
  streamingText = null,
}) {
  const streamRef = useRef(null);

  // Keep the newest tokens in view as they arrive; without this the preview
  // silently fills past the bottom of a box that can't grow.
  useEffect(() => {
    const el = streamRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [streamingText]);

  function handleSubmit(e) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSubmit(trimmed);
  }

  function handleKeyDown(e) {
    if (e.key !== "Enter") return;

    // Enter submits, Shift+Enter starts a new line - the convention every
    // chat-style input uses, and the one people try first. It used to be the
    // other way round (plain Enter inserted a newline, only Cmd/Ctrl+Enter
    // submitted), which meant typing a trip and pressing Enter appeared to do
    // nothing at all. Multi-line descriptions are the rarer case and still
    // have Shift+Enter.
    //
    // On a phone this is what makes the keyboard's own return key work, since
    // there's no Cmd or Ctrl to hold. Note this fires for the composition
    // Enter too on some IMEs, so mid-composition keypresses are ignored below.
    if (e.shiftKey) return;
    // isComposing is true while an IME candidate window is open (Japanese,
    // Chinese, Korean); Enter there is "accept this candidate", not "send".
    if (e.nativeEvent?.isComposing) return;

    handleSubmit(e);
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-3">
      <label
        htmlFor={id}
        className={
          labelHidden ? "sr-only" : "text-sm font-medium text-ink-muted"
        }
      >
        {label}
      </label>
      <div className={`gradient-border ${disabled ? "opacity-60" : ""}`}>
        <div className="rounded-[19px] bg-surface">
          <div className="relative">
            <textarea
              id={id}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              maxLength={MAX_LENGTH}
              rows={3}
              placeholder={placeholder}
              disabled={disabled}
              className="w-full resize-none rounded-t-[19px] bg-transparent px-5 py-4 text-base text-ink outline-none placeholder:text-ink-subtle disabled:cursor-not-allowed"
            />
            {streamingText !== null && (
              <div
                ref={streamRef}
                aria-live="polite"
                aria-label="Generating itinerary"
                className="absolute inset-0 overflow-y-auto rounded-t-[19px] bg-surface px-5 py-4"
              >
                <pre className="whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed text-ink-subtle">
                  {streamingText}
                  <span className="animate-pulse text-ink-muted">▍</span>
                </pre>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between gap-3 px-5 pb-4">
            <span className="text-xs text-ink-subtle">
              {streamingText !== null
                ? "Generating…"
                : `${value.length}/${MAX_LENGTH}`}
            </span>
            <button
              type="submit"
              disabled={disabled || !value.trim()}
              className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-canvas transition hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--canvas)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {disabled ? pendingLabel : submitLabel}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
