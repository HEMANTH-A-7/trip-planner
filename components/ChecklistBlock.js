export default function ChecklistBlock({ items, onToggle }) {
  return (
    <div className="panel mt-2.5 rounded-[18px] p-4 sm:rounded-[20px]">
      <p className="type-label mb-2.5">
        Packing checklist
      </p>
      <ul className="flex flex-col gap-1.5">
        {items.map((item) => (
          <li key={item.id}>
            {/* items-start, not items-center: an item now names the thing and
                what it's for, so it wraps to two lines often enough that a
                vertically centred box would sit in the gap between them. The
                nudge lines the box up with the first line of text. */}
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={item.checked}
                onChange={() => onToggle(item.id)}
                className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--accent)] sm:h-4 sm:w-4"
              />
              <span
                className={`leading-relaxed ${
                  item.checked ? "text-ink-subtle line-through" : "text-ink-muted"
                }`}
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
