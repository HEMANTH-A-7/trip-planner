"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

// A new image every two seconds, as asked for. The two numbers are split so
// that the *cadence* is 2s rather than 2s plus a fade on top: an image holds
// still for HOLD_MS, crossfades for FADE_MS, and the pair add up to the
// interval. Changing the interval means changing HOLD_MS and leaving the
// sum right.
const CYCLE_MS = 2000;
const FADE_MS = 700;
const HOLD_MS = CYCLE_MS - FADE_MS;

// Never more than two images in the DOM: the one on screen and the next one,
// which is mounted invisibly as soon as the current one lands so it is fully
// downloaded by the time its turn comes. Mounting the whole set instead would
// pull every file down before the first paint, competing with the LCP.
export default function HeroBackdrop({
  images,
  rotate = false,
  preload = false,
  className = "",
  overlayClassName,
  seedColor,
}) {
  // What's on screen is held as the image itself, not as an index into
  // `images`. The trip hero replaces its whole list when the destination's
  // real photograph arrives - same length, same index, different picture - so
  // anything index-based would swap it in as a hard cut with no crossfade,
  // and would have no way to keep showing the outgoing image once it had left
  // the list entirely.
  const [shown, setShown] = useState(() => images[0]);
  // Which src the browser has finished with. Held as the src rather than a
  // boolean so it can't be left true from the previous image.
  const [readySrc, setReadySrc] = useState(null);
  // The hold has elapsed and the crossfade may start. Separate from "which
  // image is next", because at this cadence the next image has to be on its
  // way well before it is due on screen.
  const [armed, setArmed] = useState(false);
  const timers = useRef([]);

  function clearTimers() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }

  const shownSrc = shown?.src;

  // The next image is decided the moment the current one lands, not when its
  // turn comes, so it is mounted (hidden, at opacity 0) and downloading for
  // the whole hold. At a two-second cadence there isn't time to start
  // fetching when the fade is already due - it would stretch the first pass
  // through the set until everything was cached.
  const at = images.findIndex((image) => image.src === shownSrc);
  const rotating = rotate && images.length > 1;
  const incoming = rotating
    ? images[(at + 1) % images.length]
    : images[0]?.src !== shownSrc
      ? images[0]
      : null;

  const loaded = Boolean(incoming) && readySrc === incoming.src;
  // A rotation waits out its hold; a trip hero swapping to the destination's
  // real photograph has nothing to wait for and goes as soon as it's loaded.
  const fading = loaded && (rotating ? armed : true);

  // Advance on a timer, but only while the tab is actually being looked at.
  // A backdrop crossfading in a background tab is pure battery for nobody -
  // and it resumes on its own, so nothing is lost by skipping it.
  useEffect(() => {
    if (!rotating) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let timer;
    const schedule = () => {
      timer = setTimeout(() => {
        if (document.hidden) return schedule();
        setArmed(true);
      }, HOLD_MS);
    };
    schedule();
    return () => clearTimeout(timer);
  }, [rotating, shownSrc]);

  // The layer is committed with the fade-in class and the animation runs
  // itself. All this has left to do is promote the incoming image once the
  // fade is over - a plain timer, so a tab that was hidden throughout still
  // lands in the right state rather than stranded mid-crossfade.
  useEffect(() => {
    if (!fading) return;
    const done = setTimeout(() => {
      setShown(incoming);
      setArmed(false);
      setReadySrc(null);
    }, FADE_MS + 40);
    timers.current.push(done);
    return () => clearTimeout(done);
  }, [fading, incoming]);

  useEffect(() => clearTimers, []);

  const current = shown;
  const incomingImage = incoming;

  return (
    <div
      aria-hidden
      className={`absolute inset-0 -z-20 overflow-hidden ${className}`}
      // Something in the right key underneath while the first image decodes,
      // so the page never flashes black behind the headline.
      style={seedColor ? { backgroundColor: seedColor } : undefined}
    >
      <Layer image={current} preload={preload} />

      {incomingImage && (
        <Layer
          image={incomingImage}
          // Eager, not the default lazy. A layer that's about to be faded in
          // is already inside the viewport, so lazy loading leaves it waiting
          // on an IntersectionObserver that fires late - or, in a background
          // tab, never - and the crossfade silently stalls at opacity 0.
          // Low priority because there are seconds in hand and nothing on the
          // critical path should be pushed aside for it.
          eager
          // Only opacity is animated. It's a compositor-only property, so the
          // crossfade never touches the main thread and can't be janked by
          // React rendering the itinerary above it.
          className={fading ? "hero-fade-in" : undefined}
          style={{
            // Mounted and loading well before its turn, but invisible until
            // the hold is up.
            opacity: fading ? undefined : 0,
            "--hero-fade-ms": `${FADE_MS}ms`,
          }}
          onReady={() => setReadySrc(incomingImage.src)}
        />
      )}

      {overlayClassName && <div className={overlayClassName} />}
    </div>
  );
}

// decode() resolves once the frame is genuinely ready to paint, which is what
// keeps a crossfade from hitching halfway through on the decode. But it is an
// optimisation and must never be a gate: in a backgrounded tab it does not
// resolve at all (verified - a fully loaded image, complete and with a real
// naturalWidth, left decode() pending indefinitely). Gating on it meant a
// landing page opened in a background tab deadlocked its own rotation and was
// still stuck when the tab was finally looked at. So it races a short timer,
// and the fade starts either way.
const DECODE_BUDGET_MS = 250;

function settleWhenPainted(img, done) {
  if (!img?.decode) return done();
  let settled = false;
  const once = () => {
    if (!settled) {
      settled = true;
      done();
    }
  };
  img.decode().then(once, once);
  setTimeout(once, DECODE_BUDGET_MS);
}

function Layer({
  image,
  preload = false,
  eager = false,
  className = "",
  style,
  onReady,
}) {
  if (!image) return null;
  return (
    <Image
      key={image.src}
      src={image.src}
      alt=""
      fill
      // `preload` rather than `priority`: the latter is deprecated as of
      // Next 16, and only the first image on screen earns a <link rel>.
      preload={preload}
      {...(eager ? { loading: "eager", fetchPriority: "low" } : null)}
      sizes="100vw"
      quality={72}
      // A native listener on the element rather than React's `onLoad`, which
      // next/image does not forward (verified: the ref fires, the image
      // completes, and onLoad is never called). Both branches are needed -
      // an image already in the HTTP cache can be complete before this ref
      // ever runs, and that's the normal case on a second visit.
      ref={(node) => {
        if (!node || !onReady) return;
        if (node.complete && node.naturalWidth > 0) {
          settleWhenPainted(node, onReady);
          return;
        }
        const handle = () => settleWhenPainted(node, onReady);
        node.addEventListener("load", handle, { once: true });
        node.addEventListener("error", handle, { once: true });
        return () => {
          node.removeEventListener("load", handle);
          node.removeEventListener("error", handle);
        };
      }}
      className={`object-cover ${className}`}
      style={{ objectPosition: image.position ?? "50% 50%", ...style }}
    />
  );
}
