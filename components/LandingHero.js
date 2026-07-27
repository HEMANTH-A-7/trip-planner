import HeroBackdrop from "./HeroBackdrop";
import { LANDING_SEQUENCE } from "@/lib/heroImages";

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
      {/* No destination has been named yet, so there is nothing for these to
          contradict - which is exactly why the landing is the one place a
          rotation belongs. It's also the pitch: anywhere you want.
          The scrim rides inside the backdrop so it stays above every layer of
          the crossfade rather than only the first one. */}
      <HeroBackdrop
        images={LANDING_SEQUENCE}
        rotate
        preload
        overlayClassName="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(6,12,18,0.34),rgba(6,12,18,0.56)_55%,var(--canvas))]"
      />

      <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center gap-[clamp(0.5rem,2vh,1rem)] py-[clamp(1rem,4vh,2.5rem)]">
        <h1 className="type-display text-center text-[clamp(2.25rem,7.5vw,4.25rem)] text-white drop-shadow">
          Where to next?
        </h1>
        <p className="mx-auto max-w-xl text-center text-[clamp(0.8125rem,1.6vw,1rem)] text-white/80">
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
