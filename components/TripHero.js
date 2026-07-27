import Image from "next/image";

// The banner above a generated itinerary. Shares the landing photo and the
// same fixed-white-on-scrim treatment, so moving from the landing into a trip
// reads as one continuous surface rather than two different pages.
//
// It's one stock photo for every destination, not a per-trip image: fetching a
// real photo per destination was ruled out to keep the app's cost down.
export default function TripHero({ itinerary, dayCount }) {
  return (
    <div className="relative isolate overflow-hidden border-b border-hairline">
      <Image
        src="/beach-hero.jpg"
        alt=""
        fill
        preload
        sizes="(min-width: 64rem) calc(100vw - 16rem), 100vw"
        className="-z-20 object-cover"
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[linear-gradient(to_bottom,rgba(6,12,18,0.38),rgba(6,12,18,0.62)_60%,var(--canvas))]"
      />

      <div className="px-4 pb-8 pt-16 sm:px-8 sm:pb-10 sm:pt-24">
        <div className="mx-auto max-w-3xl">
          <span className="inline-block rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
            {dayCount}-day itinerary
          </span>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white drop-shadow sm:text-4xl">
            {itinerary.destination}
          </h1>
          {itinerary.summary && (
            <p className="mt-2 max-w-2xl text-sm text-white/85 sm:text-base">
              {itinerary.summary}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
