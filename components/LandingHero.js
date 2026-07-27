import Image from "next/image";

// The landing pane: a full-height photo with the headline centred in it and
// the search box sitting at the bottom of the viewport. No sidebar here - the
// landing is deliberately a single uninterrupted image.
//
// Sizing notes, because this band has to survive any window shape:
// - `100svh`, not `100vh`. On mobile browsers `vh` is measured against the
//   viewport with the URL bar *hidden*, so a `100vh` hero is taller than the
//   screen on first paint and pushes the search box out of sight. `svh` is
//   the small-viewport height, which is the one actually visible.
// - Every vertical dimension is `clamp()`ed rather than fixed, so a short
//   window (a half-height laptop window) compresses the type and padding
//   instead of overflowing and hiding the search box below the fold.
//
// Text is fixed white over a dark scrim rather than the theme's ink token.
// Ink flips to near-black in the light theme, which would be unreadable over
// a bright beach photo, so this band commits to one treatment in both themes.
export default function LandingHero({ status, children }) {
  return (
    <div className="relative isolate flex min-h-[100svh] flex-col px-4 py-[clamp(1rem,4vh,2.5rem)] sm:px-8">
      <Image
        src="/beach-hero.jpg"
        alt=""
        fill
        // The LCP element of this route. `preload` rather than `priority` -
        // the latter is deprecated as of Next 16.
        preload
        sizes="100vw"
        className="-z-20 object-cover"
      />
      {/* Enough scrim for white text over the bright sky, resolving to the
          page colour at the bottom so the photo doesn't end on a hard edge. */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[linear-gradient(to_bottom,rgba(6,12,18,0.30),rgba(6,12,18,0.52)_55%,var(--canvas))]"
      />

      <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center gap-[clamp(0.5rem,2vh,1rem)] py-[clamp(1rem,4vh,2.5rem)]">
        <h1 className="text-center text-[clamp(2rem,7vw,3.75rem)] font-semibold leading-tight tracking-tight text-white drop-shadow">
          Where to next?
        </h1>
        <p className="mx-auto max-w-xl text-center text-[clamp(0.8125rem,1.6vw,1rem)] text-white/85">
          Describe your perfect trip in plain language and get an editable,
          day-by-day itinerary.
        </p>
        {/* Errors surface here, above the box that produced them, so the
            search bar keeps its place at the bottom. */}
        {status && <div className="mt-4 w-full max-w-2xl">{status}</div>}
      </div>

      <div className="relative mx-auto w-full max-w-2xl">{children}</div>
    </div>
  );
}
