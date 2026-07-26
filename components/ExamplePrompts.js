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
      <span className="w-full text-xs text-ink-subtle">Not sure what to type? Try:</span>
      {EXAMPLES.map((example) => (
        <button
          key={example}
          type="button"
          onClick={() => onSelect(example)}
          className="rounded-full border border-hairline bg-surface-2 px-3 py-1.5 text-xs text-ink-muted transition hover:border-hairline-strong hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-lavender"
        >
          {example}
        </button>
      ))}
    </div>
  );
}
