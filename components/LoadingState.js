// A preview of the shape that's arriving, not a spinner in a dashed box.
//
// This was the last thing in the app still wearing the pre-redesign look, and
// a dashed border around a rotating circle says nothing except "wait".
// Skeleton cards built on the same panel system as a real day mean the layout
// doesn't jump when the itinerary lands - what's on screen is already the
// right shape and roughly the right size.
const SKELETON_ROWS = [
  { title: "w-[62%]", body: ["w-full", "w-[84%]"] },
  { title: "w-[45%]", body: ["w-[92%]", "w-[70%]"] },
  { title: "w-[55%]", body: ["w-[88%]", "w-[60%]"] },
];

export default function LoadingState() {
  return (
    <section
      role="status"
      aria-live="polite"
      className="rounded-[26px] border border-hairline bg-surface p-2.5 sm:rounded-[32px] sm:p-[18px]"
    >
      <header className="px-3 pb-5 pt-4 sm:pt-3">
        <span className="type-label type-figure text-accent">Planning</span>
        <p className="type-display mt-2 text-[26px] text-ink sm:text-[30px]">
          Building your itinerary…
        </p>
        <p className="mt-2.5 text-[12.5px] text-ink-subtle">
          Choosing stops, ordering them by neighbourhood, and pricing the day.
        </p>
      </header>

      <div className="panel flex flex-col gap-3 rounded-[18px] p-2.5 sm:rounded-[20px] sm:p-4">
        {SKELETON_ROWS.map((row, index) => (
          <div
            key={index}
            className="rounded-[14px] border border-hairline bg-surface-2 p-3.5 sm:rounded-[16px] sm:p-4"
          >
            {/* Each row's shimmer starts a beat after the one above, so the
                day fills in top to bottom, in the order the stops will. */}
            <Bar className="h-2.5 w-16" delay={index * 140} />
            <Bar className={`mt-3 h-4 ${row.title}`} delay={index * 140 + 60} />
            {row.body.map((width, line) => (
              <Bar
                key={line}
                className={`mt-2 h-3 ${width}`}
                delay={index * 140 + 120 + line * 60}
              />
            ))}
            <div className="mt-4 flex gap-1.5">
              <Bar className="h-6 w-24 rounded-full" delay={index * 140 + 240} />
              <Bar className="h-6 w-16 rounded-full" delay={index * 140 + 280} />
              <Bar className="h-6 w-16 rounded-full" delay={index * 140 + 320} />
            </div>
          </div>
        ))}
      </div>

      <span className="sr-only">
        Planning your trip. This can take a few seconds.
      </span>
    </section>
  );
}

function Bar({ className = "", delay = 0 }) {
  return (
    <span
      aria-hidden
      className={`skeleton block rounded-md ${className}`}
      style={{ animationDelay: `${delay}ms` }}
    />
  );
}
