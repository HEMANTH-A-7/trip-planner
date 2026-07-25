"use client";

import { useState } from "react";

const MAX_LENGTH = 2000;
const PLACEHOLDER =
  "e.g. 4 days in Kyoto in April, mostly temples and food, budget-friendly, no early mornings";

export default function TripForm({ onSubmit, disabled }) {
  const [text, setText] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSubmit(trimmed);
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-3">
      <label htmlFor="trip-prompt" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Describe your trip
      </label>
      <textarea
        id="trip-prompt"
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={MAX_LENGTH}
        rows={3}
        placeholder={PLACEHOLDER}
        disabled={disabled}
        className="w-full resize-none rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base text-zinc-900 shadow-sm outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-300 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-500 dark:focus:ring-zinc-700"
      />
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-zinc-400 dark:text-zinc-500">
          {text.length}/{MAX_LENGTH}
        </span>
        <button
          type="submit"
          disabled={disabled || !text.trim()}
          className="rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {disabled ? "Planning…" : "Plan my trip"}
        </button>
      </div>
    </form>
  );
}
