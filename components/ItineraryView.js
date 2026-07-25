import DayCard from "./DayCard";
import TripOverviewChart from "./TripOverviewChart";

export default function ItineraryView({
  itinerary,
  onRemoveStop,
  onMoveStop,
  onToggleChecklistItem,
}) {
  return (
    <div className="animate-fade-in flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          {itinerary.destination}
        </h2>
        {itinerary.summary && (
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {itinerary.summary}
          </p>
        )}
      </div>
      <TripOverviewChart itinerary={itinerary} />
      {itinerary.days.map((day) => (
        <DayCard
          key={day.id}
          day={day}
          onRemoveStop={onRemoveStop}
          onMoveStop={onMoveStop}
          onToggleChecklistItem={onToggleChecklistItem}
        />
      ))}
    </div>
  );
}
