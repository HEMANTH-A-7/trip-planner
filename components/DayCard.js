import StopCard from "./StopCard";
import ChecklistBlock from "./ChecklistBlock";

export default function DayCard({ day, onRemoveStop, onMoveStop, onToggleChecklistItem }) {
  return (
    <section className="rounded-3xl border border-hairline bg-surface p-5">
      <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-ink-subtle">
        Day {day.day}
        {day.title ? ` — ${day.title}` : ""}
      </h3>
      {day.stops.length === 0 ? (
        <p className="text-sm text-ink-subtle">No stops left for this day.</p>
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
      {day.packingChecklist?.length > 0 && (
        <ChecklistBlock
          items={day.packingChecklist}
          onToggle={(itemId) => onToggleChecklistItem(day.id, itemId)}
        />
      )}
    </section>
  );
}
