import { useCallback, useEffect, useRef, useState } from "react";

// How long a finger has to rest on a card before it lifts. Long enough that a
// flick to scroll the page isn't read as a lift, short enough that the card
// doesn't feel like it's ignoring you.
const HOLD_MS = 280;
// Movement before the hold completes means the finger was scrolling all along,
// so the gesture goes back to the browser.
const SLOP_PX = 8;
// How long the cards being displaced take to slide out of the way.
const SHIFT_MS = 180;
// How close to the top or bottom of the viewport the pointer has to get before
// the page starts scrolling itself, and how fast it can go (px per frame).
const EDGE_PX = 76;
const MAX_SCROLL_STEP = 14;

function preventDefault(event) {
  event.preventDefault();
}

// Positions are kept in document space, not viewport space: the page scrolls
// underneath a drag (by hand on desktop, by the edge-scroller below), and
// document coordinates are the ones that survive that.
function measureRows(list) {
  const offset = window.scrollY;
  const rows = Array.from(list.children).map((el) => {
    const rect = el.getBoundingClientRect();
    return { top: rect.top + offset, height: rect.height };
  });
  // The row gap is part of the space a lifted card leaves behind, and it's a
  // CSS value this hook has no business knowing - read it back off the layout.
  const gap = rows.length > 1 ? rows[1].top - (rows[0].top + rows[0].height) : 0;
  return { rows, gap };
}

// Which slot the lifted card is over, judged by its centre against the
// midpoints of where the other cards *started*. Measuring against their
// original positions rather than their shifted ones is what keeps the answer
// stable: a card resting near a boundary can't flip back and forth by
// displacing the very card it's being compared to.
export function slotFor(centre, rows, from) {
  for (let i = 0; i < from; i++) {
    if (centre < rows[i].top + rows[i].height / 2) return i;
  }
  let slot = from;
  for (let i = from + 1; i < rows.length; i++) {
    if (centre > rows[i].top + rows[i].height / 2) slot = i;
  }
  return slot;
}

// Every card the lifted one passes moves by exactly the space it vacated -
// its own height plus the gap - whatever height those cards are themselves.
// Cards beyond the drop slot don't move at all: the lift and the reinsertion
// cancel out for them.
export function shiftFor(index, { from, to, lift }) {
  if (to > from && index > from && index <= to) return -lift;
  if (to < from && index >= to && index < from) return lift;
  return 0;
}

// How far the page should move this frame, ramping up the deeper into the
// edge zone the pointer gets so a card can be nudged along slowly or sent.
export function scrollStep(clientY, viewportHeight) {
  const aboveTop = clientY - EDGE_PX;
  if (aboveTop < 0) return Math.max(-MAX_SCROLL_STEP, Math.round(aboveTop / 5));
  const belowBottom = clientY - (viewportHeight - EDGE_PX);
  if (belowBottom > 0) {
    return Math.min(MAX_SCROLL_STEP, Math.round(belowBottom / 5));
  }
  return 0;
}

const IDLE = { pressed: false, lifted: false, style: undefined };
const PRESSED = { pressed: true, lifted: false, style: undefined };

/**
 * Pointer-driven sortable list. One gesture path for mouse, touch and pen:
 * HTML5 drag-and-drop, which this replaces, never fires from a finger at all.
 *
 * `onReorder(fromIndex, toIndex)` is called once, on drop.
 */
export default function useDragSort(onReorder) {
  const listRef = useRef(null);
  // The in-flight gesture. A ref rather than state: its listeners are bound
  // once at pointerdown and need to read live values, and most of what a drag
  // tracks (measurements, the pointer id, the scroll frame) never reaches the
  // screen.
  const gestureRef = useRef(null);
  const [drag, setDrag] = useState(null);

  // Those listeners outlive the render that created them, so the drop has to
  // reach the current handler through a ref instead of the one that happened
  // to be in scope when the finger went down.
  const onReorderRef = useRef(onReorder);
  useEffect(() => {
    onReorderRef.current = onReorder;
  });

  const end = useCallback((commit) => {
    const gesture = gestureRef.current;
    if (!gesture) return;
    gestureRef.current = null;

    clearTimeout(gesture.holdTimer);
    cancelAnimationFrame(gesture.frame);
    window.removeEventListener("pointermove", gesture.onMove);
    window.removeEventListener("pointerup", gesture.onUp);
    window.removeEventListener("pointercancel", gesture.onUp);
    window.removeEventListener("blur", gesture.onLeave);

    if (gesture.lifted) {
      document.removeEventListener("touchmove", preventDefault);
      document.removeEventListener("contextmenu", preventDefault);
      document.body.style.userSelect = "";
      if (commit && gesture.to !== gesture.from) {
        onReorderRef.current(gesture.from, gesture.to);
      }
    }
    setDrag(null);
  }, []);

  const begin = useCallback(
    (index, event, hold) => {
      // A second finger landing mid-drag, or a non-primary mouse button.
      if (gestureRef.current) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;
      const list = listRef.current;
      if (!list) return;

      const gesture = {
        from: index,
        to: index,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        clientY: event.clientY,
        lifted: false,
        holdTimer: null,
        frame: 0,
      };

      const update = () => {
        const dy = gesture.clientY + window.scrollY - gesture.startDocY;
        gesture.to = slotFor(gesture.centre + dy, gesture.rows, gesture.from);
        setDrag({
          from: gesture.from,
          to: gesture.to,
          dy,
          lift: gesture.lift,
          shiftMs: gesture.shiftMs,
          lifted: true,
        });
      };

      // Drag past the edge of the screen and the page follows, so a card can
      // reach a slot that wasn't on screen when it was picked up - the whole
      // point on a phone, where a day rarely fits in one viewport.
      const tick = () => {
        gesture.frame = requestAnimationFrame(tick);
        const step = scrollStep(gesture.clientY, window.innerHeight);
        if (!step) return;
        const before = window.scrollY;
        window.scrollBy(0, step);
        if (window.scrollY !== before) update();
      };

      const liftCard = () => {
        const { rows, gap } = measureRows(list);
        if (!rows[index]) return end(false);
        gesture.rows = rows;
        gesture.lift = rows[index].height + gap;
        gesture.centre = rows[index].top + rows[index].height / 2;
        gesture.startDocY = gesture.clientY + window.scrollY;
        gesture.shiftMs = window.matchMedia("(prefers-reduced-motion: reduce)")
          .matches
          ? 0
          : SHIFT_MS;
        gesture.lifted = true;
        // React registers its touch listeners as passive, so the page can only
        // be kept from scrolling under the drag by a native, non-passive one.
        // contextmenu goes with it: Android raises one at the end of a long
        // press, on top of the drag that press just started.
        document.addEventListener("touchmove", preventDefault, {
          passive: false,
        });
        document.addEventListener("contextmenu", preventDefault);
        document.body.style.userSelect = "none";
        update();
        tick();
      };

      gesture.onMove = (moveEvent) => {
        if (moveEvent.pointerId !== gesture.pointerId) return;
        gesture.clientY = moveEvent.clientY;
        if (gesture.lifted) {
          update();
        } else if (
          Math.abs(moveEvent.clientY - gesture.startY) > SLOP_PX ||
          Math.abs(moveEvent.clientX - gesture.startX) > SLOP_PX
        ) {
          end(false);
        }
      };
      // pointercancel means the browser took the gesture (a scroll won the
      // race, or the OS interrupted) - let go of it rather than reordering on
      // the strength of a drag the user stopped steering.
      gesture.onUp = (upEvent) => {
        if (upEvent.pointerId === gesture.pointerId) {
          end(upEvent.type === "pointerup");
        }
      };
      // A drag let go of outside the window never reports its pointerup, and
      // a gesture that can't end is worse than one that ends early: it holds
      // the card in the air and swallows every drag after it.
      gesture.onLeave = () => end(false);

      gestureRef.current = gesture;
      window.addEventListener("pointermove", gesture.onMove);
      window.addEventListener("pointerup", gesture.onUp);
      window.addEventListener("pointercancel", gesture.onUp);
      window.addEventListener("blur", gesture.onLeave);

      if (hold) {
        gesture.holdTimer = setTimeout(liftCard, HOLD_MS);
        // Acknowledge the press straight away. Waiting the full hold with no
        // feedback reads as the card not responding.
        setDrag({ from: index, to: index, lifted: false });
      } else {
        liftCard();
      }
    },
    [end],
  );

  useEffect(() => () => end(false), [end]);

  // Press the card itself: the touch path. Holding is the whole gesture, so
  // there's no handle to find and no aiming involved.
  const pressCard = useCallback(
    (index, event) => {
      // A mouse has the grip right there, and arming a drag from the card body
      // would only get in the way of selecting its text.
      if (event.pointerType === "mouse") return;
      if (event.target.closest?.("button, a, input, textarea, select")) return;
      begin(index, event, true);
    },
    [begin],
  );

  // Press the grip: an explicit handle, so it lifts on contact with no hold.
  const pressHandle = useCallback(
    (index, event) => begin(index, event, false),
    [begin],
  );

  const itemFor = useCallback(
    (index) => {
      if (!drag) return IDLE;
      const isSource = index === drag.from;
      if (!drag.lifted) return isSource ? PRESSED : IDLE;

      const offset = isSource ? drag.dy : shiftFor(index, drag);
      return {
        pressed: false,
        lifted: isSource,
        style: {
          transform: offset ? `translateY(${offset}px)` : undefined,
          // The lifted card tracks the pointer exactly; the cards it displaces
          // slide. Dropping clears `drag`, which takes the transition away in
          // the same commit as the transforms, so they unwind instantly
          // against the reordered list instead of animating back out of it.
          transition: isSource ? "none" : `transform ${drag.shiftMs}ms ease`,
          zIndex: isSource ? 20 : undefined,
        },
      };
    },
    [drag],
  );

  return {
    listRef,
    pressCard,
    pressHandle,
    itemFor,
  };
}
