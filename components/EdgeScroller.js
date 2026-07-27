"use client";

import { Children, useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

// A horizontal scroller that says so. Below `lg` the sidebar lays its days
// (and its trip history) out as a row that runs off the right edge of a
// phone, and nothing about a flush-cut card suggests there's a second day
// past it - the list just looks like it ends. This wraps that row and fades
// its overflowing edge out under a chevron, which is the part people
// recognise as "there's more this way".
//
// Mobile only, by design: at `lg` the same list becomes a stacked rail with
// no horizontal overflow to hint at, so the affordance is hidden rather than
// left to render against a scroller that can't move.

// Anything under a pixel is a rounding artifact of fractional layout widths,
// not a scrollable remainder, and would otherwise leave the chevron stuck on
// at a hard stop.
const EPSILON = 1;

export default function EdgeScroller({ as: List = "ul", className, children, ...rest }) {
  const scrollerRef = useRef(null);
  const [edges, setEdges] = useState({ start: false, end: false });

  const sync = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const start = el.scrollLeft > EPSILON;
    const end = el.scrollLeft < max - EPSILON;
    // Bail out when nothing actually moved. ResizeObserver fires once on
    // observe() and again on every layout tick, so handing React a freshly
    // allocated object each time would re-render on every one of them - and
    // since the effect below tears down and re-observes when it re-runs, that
    // re-render would trigger the next observation, forever. The visible
    // symptom is a transition that never finishes settling.
    setEdges((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
  }, []);

  // Keyed on how many children there are rather than the children themselves:
  // the array is a new identity on every parent render, which would re-run
  // this effect (and re-arm the observer) constantly. The count only moves
  // when a day is genuinely added or removed, which is the case that needs
  // the new node observed.
  const childCount = Children.count(children);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    sync();
    el.addEventListener("scroll", sync, { passive: true });
    // Catches both the viewport changing width and the list itself changing -
    // adding a day, or crossing the `lg` breakpoint into the stacked rail,
    // where there is suddenly no overflow to point at.
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    for (const child of el.children) observer.observe(child);

    return () => {
      el.removeEventListener("scroll", sync);
      observer.disconnect();
    };
  }, [sync, childCount]);

  function nudge(direction) {
    const el = scrollerRef.current;
    if (!el) return;
    // Not a full page: leaving a sliver of the previous card visible is what
    // makes it read as a continuous strip rather than a set of pages.
    el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: "smooth" });
  }

  return (
    <div className="relative min-w-0">
      <List ref={scrollerRef} className={className} {...rest}>
        {children}
      </List>

      {[
        { side: "start", show: edges.start, Icon: ChevronLeft, label: "Scroll back" },
        { side: "end", show: edges.end, Icon: ChevronRight, label: "Scroll for more" },
      ].map(({ side, show, Icon, label }) => {
        const isEnd = side === "end";
        return (
          <div
            key={side}
            // aria-hidden throughout: the row is already scrollable and
            // keyboard-reachable through the day buttons themselves, so this
            // is a visual cue for pointer users, not a second set of controls
            // to tab past. It also can't exist on the stacked rail.
            aria-hidden
            className={`pointer-events-none absolute inset-y-0 flex w-14 items-center transition-opacity duration-200 lg:hidden ${
              isEnd ? "right-0 justify-end" : "left-0 justify-start"
            } ${show ? "opacity-100" : "opacity-0"}`}
            style={{
              // Fades into the sidebar's own surface so the cut-off card
              // dissolves rather than ending on a hard vertical seam.
              background: `linear-gradient(to ${
                isEnd ? "left" : "right"
              }, var(--surface), color-mix(in oklab, var(--surface) 60%, transparent) 55%, transparent)`,
            }}
          >
            <button
              type="button"
              tabIndex={-1}
              // Hit-testing has to come back on for the button itself, and
              // must stay off once the edge is faded out, or an invisible
              // chevron keeps swallowing taps meant for the card beneath it.
              className={`flex h-7 w-7 items-center justify-center rounded-full border border-hairline-strong bg-surface-2 text-ink-muted shadow-sm transition-colors active:bg-canvas ${
                show ? "pointer-events-auto" : "pointer-events-none"
              }`}
              onClick={() => nudge(isEnd ? 1 : -1)}
            >
              <span className="sr-only">{label}</span>
              <Icon size={15} aria-hidden />
            </button>
          </div>
        );
      })}
    </div>
  );
}
