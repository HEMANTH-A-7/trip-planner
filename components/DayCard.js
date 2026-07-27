"use client";

import { useState } from "react";
import StopCard from "./StopCard";
import ChecklistBlock from "./ChecklistBlock";

export default function DayCard({
  day,
  onRemoveStop,
  onMoveStop,
  onRenameStop,
  onReorderStop,
  onToggleChecklistItem,
}) {
  // Drag state belongs here rather than in StopCard: a drag is a relationship
  // between two cards, and this is the component that knows about both.
  const [dragIndex, setDragIndex] = useState(null);
  const [overIndex, setOverIndex] = useState(null);

  function resetDrag() {
    setDragIndex(null);
    setOverIndex(null);
  }

  function handleDrop(toIndex) {
    if (dragIndex !== null && dragIndex !== toIndex) {
      onReorderStop(day.id, dragIndex, toIndex);
    }
    resetDrag();
  }

  return (
    <section className="rounded-3xl border border-hairline bg-surface p-5">
      <header className="mb-4">
        <span
          className="inline-block rounded-full px-3 py-1 text-xs font-semibold text-ink"
          style={{
            background: "color-mix(in oklab, var(--accent-peach) 22%, transparent)",
          }}
        >
          Day {day.day}
        </span>
        {day.title && (
          <h3 className="mt-2 text-xl font-semibold tracking-tight text-ink">
            {day.title}
          </h3>
        )}
      </header>

      {day.stops.length === 0 ? (
        <p className="text-sm text-ink-subtle">No stops left for this day.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {day.stops.map((stop, index) => (
            <StopCard
              key={stop.id}
              stop={stop}
              isFirst={index === 0}
              isLast={index === day.stops.length - 1}
              isDragging={dragIndex === index}
              isDropTarget={
                dragIndex !== null && overIndex === index && dragIndex !== index
              }
              onRemove={() => onRemoveStop(day.id, stop.id)}
              onRename={(name) => onRenameStop(day.id, stop.id, name)}
              onMoveUp={() => onMoveStop(day.id, stop.id, -1)}
              onMoveDown={() => onMoveStop(day.id, stop.id, 1)}
              onDragStart={() => setDragIndex(index)}
              onDragEnter={() => dragIndex !== null && setOverIndex(index)}
              onDrop={() => handleDrop(index)}
              onDragEnd={resetDrag}
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
