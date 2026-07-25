export default function ChecklistBlock({ items, onToggle }) {
  return (
    <div className="mt-3 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
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
                className="h-4 w-4 shrink-0 accent-zinc-700 dark:accent-zinc-300"
              />
              <span
                className={
                  item.checked
                    ? "text-zinc-400 line-through dark:text-zinc-600"
                    : "text-zinc-700 dark:text-zinc-300"
                }
              >
                {item.text}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
