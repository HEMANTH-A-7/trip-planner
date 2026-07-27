"use client";

import { useEffect, useState } from "react";
import HeroBackdrop from "./HeroBackdrop";
import { heroFallback } from "@/lib/heroImages";

// The banner above a generated itinerary.
//
// It used to be one stock beach for every destination, which was the loudest
// remaining thing in the app: "Tokyo, Japan" set over a palm tree. Now the
// model picks a theme, that image renders immediately, and a real photograph
// of the destination crossfades in once the lookup returns.
//
// The order matters more than the lookup does. Because the themed image is
// already on screen, the network call is never on the critical path, never
// blocks paint, and never shows a spinner or an empty box - if it's slow, or
// fails, or the destination is too vague to search well, nothing happens.
export default function TripHero({ itinerary, dayCount }) {
  const fallback = heroFallback(itinerary.heroTheme);
  const destination = itinerary.destination;

  // The photo is stored with the destination it belongs to, and read back by
  // comparison. Switching trips then drops the previous hero on the very same
  // render as the new title, with no reset step that could let Kyoto's
  // photograph sit under the word Lisbon for a frame.
  const [found, setFound] = useState(null);
  const photo = found?.destination === destination ? found.photo : null;

  useEffect(() => {
    if (!destination) return;

    const controller = new AbortController();
    fetch(`/api/hero-image?destination=${encodeURIComponent(destination)}`, {
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data?.photo?.src) setFound({ destination, photo: data.photo });
      })
      // Offline, aborted, rate-limited, malformed - the themed image stays,
      // and there is nothing to tell the user because nothing broke.
      .catch(() => {});

    return () => controller.abort();
  }, [destination]);

  const images = photo
    ? [{ src: photo.src, position: "50% 50%" }]
    : [{ src: fallback.src, position: fallback.position }];

  const credit = photo?.credit ?? fallback.credit;

  return (
    <div className="relative isolate overflow-hidden border-b border-hairline">
      <HeroBackdrop
        images={images}
        preload
        seedColor={photo?.averageColor}
        overlayClassName="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(6,10,14,0.2),rgba(6,10,14,0.5)_55%,var(--canvas))]"
      />

      <div className="px-4 pb-8 pt-16 sm:px-8 sm:pb-10 sm:pt-24">
        <div className="mx-auto max-w-3xl">
          <span className="type-label type-figure inline-block rounded-full border border-white/20 bg-white/10 px-3 py-1 text-white/90 backdrop-blur-sm">
            {dayCount}-day itinerary
          </span>
          <h1 className="type-display mt-4 text-[38px] text-white drop-shadow sm:text-[52px]">
            {itinerary.destination}
          </h1>
          {itinerary.summary && (
            <p className="mt-3 max-w-2xl text-[15px] text-white/75 sm:text-base">
              {itinerary.summary}
            </p>
          )}
        </div>
      </div>

      {credit && <HeroCredit credit={credit} />}
    </div>
  );
}

// Pexels' API guidelines require the photographer to be credited and the
// photo linked back, so this isn't decoration - it's the terms the images
// arrive under. Small, bottom-right, out of the headline's way.
function HeroCredit({ credit }) {
  const label = `Photo: ${credit.photographer}${
    credit.source ? ` / ${credit.source}` : ""
  }`;

  if (!credit.url) {
    return (
      <span className="pointer-events-none absolute bottom-2 right-3 text-[10px] text-white/45">
        {label}
      </span>
    );
  }

  return (
    <a
      href={credit.url}
      target="_blank"
      rel="noreferrer noopener"
      className="absolute bottom-2 right-3 text-[10px] text-white/45 transition-colors hover:text-white/80 focus-visible:text-white/80 focus-visible:outline-none"
    >
      {label}
    </a>
  );
}
