import StopCard from "./StopCard";

export default function DayCard({ day, onRemoveStop, onMoveStop }) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Day {day.day}
        {day.title ? ` — ${day.title}` : ""}
      </h3>
      {day.stops.length === 0 ? (
        <p className="text-sm text-zinc-400 dark:text-zinc-500">
          No stops left for this day.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {day.stops.map((stop, index) => (
            <StopCard
              key={stop.id}
              stop={stop}
              isFirst={index === 0}
              isLast={index === day.stops.length - 1}
              onRemove={() => onRemoveStop(day.id, stop.id)}
              onMoveUp={() => onMoveStop(day.id, stop.id, -1)}
              onMoveDown={() => onMoveStop(day.id, stop.id, 1)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
