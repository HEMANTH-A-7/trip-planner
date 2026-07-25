export default function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-zinc-300 py-12 text-center text-zinc-400 dark:border-zinc-700 dark:text-zinc-500">
      <p className="text-sm">
        No itinerary yet — describe a trip above to get started.
      </p>
    </div>
  );
}
