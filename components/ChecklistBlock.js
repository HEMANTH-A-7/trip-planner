export default function ChecklistBlock({ items, onToggle }) {
  return (
    <div className="mt-3 rounded-2xl border border-hairline bg-surface-2 p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-ink-subtle">
        Packing checklist
      </p>
      <ul className="flex flex-col gap-1.5">
        {items.map((item) => (
          <li key={item.id}>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={item.checked}
                onChange={() => onToggle(item.id)}
                className="h-4 w-4 shrink-0 accent-accent-lavender"
              />
              <span className={item.checked ? "text-ink-subtle line-through" : "text-ink-muted"}>
                {item.text}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
