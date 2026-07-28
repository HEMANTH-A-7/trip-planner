"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import useDragSort from "@/lib/useDragSort";
import { mainStopId } from "@/lib/tripStats";
import StopCard from "./StopCard";
import StopEditor from "./StopEditor";
import ChecklistBlock from "./ChecklistBlock";

export default function DayCard({
  day,
  defaultCurrency,
  onRemoveStop,
  onMoveStop,
  onUpdateStop,
  onAddStop,
  onRequestSuggestion,
  onRequestNewStopSuggestion,
  onReorderStop,
  onToggleChecklistItem,
}) {
  // A new stop is always composed at the end of the day, then dragged into
  // place with the reordering that already exists - rather than a plus in
  // every gap, which put a control between every pair of cards for something
  // the day can already do.
  const [adding, setAdding] = useState(false);
  // The drag lives here rather than in StopCard: it's a relationship between
  // two cards, and this is the component that knows about both.
  // One stop per day carries the accent, so a day has a focal point instead
  // of reading as a stack of identical blocks.
  const anchorId = mainStopId(day.stops);

  const { listRef, itemFor, pressCard, pressHandle } = useDragSort(
    (fromIndex, toIndex) => onReorderStop(day.id, fromIndex, toIndex),
  );

  return (
    /* The reference's nesting: an outer shell at 32px holding an inset panel
       at 20px, rather than one flat box. The 18px inset is what gives the
       card its depth - you can see the shell around the panel it holds. */
    <section className="rounded-[26px] border border-hairline bg-surface p-2.5 sm:rounded-[32px] sm:p-[18px]">
      <header className="px-3 pb-5 pt-4 sm:pt-3">
        <span className="type-label type-figure text-accent">Day {day.day}</span>
        {day.title && (
          <h3 className="type-display mt-2 text-[26px] text-ink sm:text-[30px]">
            {day.title}
          </h3>
        )}
        {/* A gesture nobody can see. Worth one line, and worth wording it for
            the pointer actually in use - the handle isn't on screen on touch,
            and holding a card does nothing with a mouse. */}
        {day.stops.length > 1 && (
          <p className="mt-2.5 text-[12.5px] text-ink-subtle">
            <span className="pointer-coarse:hidden">
              Drag a stop by its handle to reorder the day.
            </span>
            <span className="hidden pointer-coarse:inline">
              Hold a stop, then drag it to reorder the day.
            </span>
          </p>
        )}
      </header>

      {day.stops.length === 0 ? (
        <p className="panel rounded-[20px] p-6 text-sm text-ink-subtle">
          No stops left for this day.
        </p>
      ) : (
        /* Three tiers of depth, the way the reference stacks them: the shell
           above, this gradient panel inset within it, and the stops raised
           off that again. Flat-on-flat is what made the old cards read as
           one grey mass. */
        <ul
          ref={listRef}
          className="panel relative flex flex-col gap-3 overflow-hidden rounded-[18px] p-2.5 sm:rounded-[20px] sm:p-4"
        >
          {day.stops.map((stop, index) => {
            const item = itemFor(index);
            return (
              <StopCard
                key={stop.id}
                stop={stop}
                isAnchor={stop.id === anchorId}
                isFirst={index === 0}
                isLast={index === day.stops.length - 1}
                isPressed={item.pressed}
                isLifted={item.lifted}
                style={item.style}
                defaultCurrency={defaultCurrency}
                onRemove={() => onRemoveStop(day.id, stop.id)}
                onUpdate={(patch) => onUpdateStop(day.id, stop.id, patch)}
                // Bound to the index rather than the id: the server addresses
                // the slot being replaced by position, since that's what tells
                // it which stops sit either side of the gap it has to fill.
                onRequestSuggestion={(instruction) =>
                  onRequestSuggestion(day.id, index, instruction)
                }
                onMoveUp={() => onMoveStop(day.id, stop.id, -1)}
                onMoveDown={() => onMoveStop(day.id, stop.id, 1)}
                onPressCard={(event) => pressCard(index, event)}
                onPressHandle={(event) => pressHandle(index, event)}
              />
            );
          })}
        </ul>
      )}

      {adding ? (
        <div className="mt-2.5 rounded-[18px] border border-dashed border-accent bg-surface-2 p-3.5 sm:rounded-[20px] sm:p-4">
          <p className="type-label mb-3 text-accent">New stop</p>
          <StopEditor
            intent="create"
            fieldId={`${day.id}-new`}
            defaultCurrency={defaultCurrency}
            onSave={(patch) => {
              onAddStop(day.id, patch);
              setAdding(false);
            }}
            onCancel={() => setAdding(false)}
            onRequestSuggestion={(instruction) =>
              onRequestNewStopSuggestion(day.id, instruction)
            }
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-[18px] border border-dashed border-hairline px-4 py-3 text-[13px] font-medium text-ink-subtle transition-colors hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:rounded-[20px]"
        >
          <Plus size={15} aria-hidden />
          Add a stop
        </button>
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
