const EXAMPLES = [
  "4 days in Kyoto in April, temples and food, budget-friendly",
  "Weekend in Rome, ancient history and pasta",
  "5 days in Tokyo, anime culture and street food",
  "3 days in Paris, art museums and pastries",
];

// Populates the box rather than auto-submitting - a first-time visitor
// should still see (and can still edit) what they're about to send, not
// have a request fire the instant they click something.
export default function ExamplePrompts({ onSelect }) {
  return (
    <div className="flex flex-wrap gap-2">
      <span className="w-full text-xs text-zinc-400 dark:text-zinc-500">
        Not sure what to type? Try:
      </span>
      {EXAMPLES.map((example) => (
        <button
          key={example}
          type="button"
          onClick={() => onSelect(example)}
          className="rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-600 transition hover:border-zinc-400 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
        >
          {example}
        </button>
      ))}
    </div>
  );
}
