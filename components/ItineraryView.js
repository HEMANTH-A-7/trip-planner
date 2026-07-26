import DayCard from "./DayCard";
import TripOverviewChart from "./TripOverviewChart";

export default function ItineraryView({
  itinerary,
  onRemoveStop,
  onMoveStop,
  onToggleChecklistItem,
}) {
  return (
    <div className="animate-fade-in flex flex-col gap-5">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-ink">
          {itinerary.destination}
        </h2>
        {itinerary.summary && (
          <p className="mt-1 text-sm text-ink-muted">{itinerary.summary}</p>
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
