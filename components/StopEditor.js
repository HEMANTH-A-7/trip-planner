"use client";

import { useState } from "react";
import { Loader2, Sparkles, SlidersHorizontal } from "lucide-react";
import { CATEGORY_LABELS } from "@/lib/categories";
import { formatDuration, formatStopCost } from "@/lib/tripStats";

// Bounds mirror StopSchema in lib/schema.js. They're enforced here as well as
// there because a manual edit goes straight into the itinerary without
// passing through the model - and that same itinerary is later posted back as
// context for a refine, where ItinerarySchema *will* reject it. Catching an
// over-long description at the keystroke is far better than surfacing it as a
// mysterious "no valid itinerary to refine" ten minutes later.
const LIMITS = {
  name: 120,
  time: 40,
  description: 700,
  currency: 8,
  durationMin: 5,
  durationMax: 1440,
  costMax: 100_000,
  instruction: 500,
};

const MODE = { MANUAL: "manual", AI: "ai" };

// Number inputs hand back strings, and "" has to mean "no value" rather than
// 0 - a stop with no duration is normal, a stop that takes zero minutes isn't.
function toOptionalNumber(raw, { min, max, integer }) {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const value = Number(trimmed);
  if (!Number.isFinite(value)) return undefined;
  const clamped = Math.min(Math.max(value, min), max);
  return integer ? Math.round(clamped) : clamped;
}

function fieldClass(extra = "") {
  return `w-full rounded-lg border border-hairline-strong bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:ring-2 focus:ring-accent ${extra}`;
}

function Label({ htmlFor, children }) {
  return (
    <label
      htmlFor={htmlFor}
      className="type-label mb-1.5 block"
    >
      {children}
    </label>
  );
}

// Used for both editing a stop that exists and composing one that doesn't:
// the fields are the same either way, and so is the AI tab - a new stop just
// starts blank. `intent` picks the wording.
export default function StopEditor({
  stop = {},
  fieldId,
  defaultCurrency,
  intent = "edit",
  onSave,
  onCancel,
  onRequestSuggestion,
}) {
  const isCreate = intent === "create";
  const [mode, setMode] = useState(MODE.MANUAL);

  const [name, setName] = useState(stop.name ?? "");
  const [time, setTime] = useState(stop.time ?? "");
  const [category, setCategory] = useState(stop.category ?? "");
  const [duration, setDuration] = useState(
    stop.durationMinutes == null ? "" : String(stop.durationMinutes)
  );
  const [cost, setCost] = useState(
    stop.estimatedCost?.amount == null ? "" : String(stop.estimatedCost.amount)
  );
  const [currency, setCurrency] = useState(
    stop.estimatedCost?.currency ?? defaultCurrency ?? ""
  );
  const [description, setDescription] = useState(stop.description ?? "");

  const [instruction, setInstruction] = useState("");
  const [pending, setPending] = useState(false);
  const [aiError, setAiError] = useState(null);
  // The model's proposal, held here until it's accepted. Nothing touches the
  // itinerary until the traveler says so - an AI suggestion they don't like
  // shouldn't have already overwritten the stop they had.
  const [suggestion, setSuggestion] = useState(null);

  const trimmedName = name.trim();

  function buildPatch(source) {
    const amount = toOptionalNumber(source.cost, {
      min: 0,
      max: LIMITS.costMax,
    });
    const trimmedCurrency = source.currency.trim();
    return {
      name: source.name.trim().slice(0, LIMITS.name),
      time: source.time.trim() ? source.time.trim().slice(0, LIMITS.time) : undefined,
      category: source.category || undefined,
      durationMinutes: toOptionalNumber(source.duration, {
        min: LIMITS.durationMin,
        max: LIMITS.durationMax,
        integer: true,
      }),
      // A cost needs both halves to mean anything; an amount with no currency
      // would render as a bare number next to properly formatted ones.
      estimatedCost:
        amount === undefined || !trimmedCurrency
          ? undefined
          : { amount, currency: trimmedCurrency.slice(0, LIMITS.currency) },
      description: source.description.trim()
        ? source.description.trim().slice(0, LIMITS.description)
        : undefined,
    };
  }

  function handleManualSave(event) {
    event.preventDefault();
    // An emptied name is a mistake, not a request for a nameless stop.
    if (!trimmedName) return;
    onSave(
      buildPatch({
        name,
        time,
        category,
        duration,
        cost,
        currency,
        description,
      })
    );
  }

  async function handleAsk(event) {
    event.preventDefault();
    if (!instruction.trim() || pending) return;
    setPending(true);
    setAiError(null);
    setSuggestion(null);

    const result = await onRequestSuggestion(instruction.trim());

    setPending(false);
    if (!result.ok) {
      setAiError(result.message);
      return;
    }
    setSuggestion(result.stop);
  }

  // Accepting drops the proposal into the manual fields rather than saving
  // outright, so "close, but call it dinner not lunch" is one more keystroke
  // instead of another round trip.
  function handleAccept() {
    if (!suggestion) return;
    setName(suggestion.name ?? "");
    setTime(suggestion.time ?? "");
    setCategory(suggestion.category ?? "");
    setDuration(
      suggestion.durationMinutes == null ? "" : String(suggestion.durationMinutes)
    );
    setCost(
      suggestion.estimatedCost?.amount == null
        ? ""
        : String(suggestion.estimatedCost.amount)
    );
    setCurrency(suggestion.estimatedCost?.currency ?? currency);
    setDescription(suggestion.description ?? "");
    setSuggestion(null);
    setInstruction("");
    setMode(MODE.MANUAL);
  }

  const tabClass = (active) =>
    `flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
      active ? "bg-surface text-ink" : "text-ink-subtle hover:text-ink-muted"
    }`;

  return (
    <form onSubmit={mode === MODE.MANUAL ? handleManualSave : handleAsk}>
      <div
        role="tablist"
        aria-label="How to edit this stop"
        className="mb-3 flex gap-1 rounded-xl bg-surface-2 p-1"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === MODE.MANUAL}
          onClick={() => setMode(MODE.MANUAL)}
          className={tabClass(mode === MODE.MANUAL)}
        >
          <SlidersHorizontal size={13} aria-hidden />
          Edit details
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === MODE.AI}
          onClick={() => setMode(MODE.AI)}
          className={tabClass(mode === MODE.AI)}
        >
          <Sparkles size={13} aria-hidden />
          Ask AI
        </button>
      </div>

      {mode === MODE.MANUAL ? (
        <div className="flex flex-col gap-3">
          <div>
            <Label htmlFor={`${fieldId}-name`}>Name</Label>
            <input
              id={`${fieldId}-name`}
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={LIMITS.name}
              autoFocus
              className={fieldClass("font-semibold")}
            />
          </div>

          <div className={isCreate ? "" : "grid grid-cols-2 gap-3"}>
            {/* No time field on a new stop: it lands at the end of the day, so
                the schedule works out when it starts from what comes before
                it. A box here would offer a value applySchedule immediately
                overwrites. Add it, then edit it if you want a specific time. */}
            {!isCreate && (
              <div>
                <Label htmlFor={`${fieldId}-time`}>Time</Label>
                <input
                  id={`${fieldId}-time`}
                  value={time}
                  onChange={(event) => setTime(event.target.value)}
                  maxLength={LIMITS.time}
                  placeholder="09:00 AM"
                  className={fieldClass()}
                />
              </div>
            )}
            <div>
              <Label htmlFor={`${fieldId}-category`}>Category</Label>
              <select
                id={`${fieldId}-category`}
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className={fieldClass()}
              >
                <option value="">None</option>
                {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-[1fr_1fr_5rem] gap-3">
            <div>
              <Label htmlFor={`${fieldId}-duration`}>Minutes</Label>
              <input
                id={`${fieldId}-duration`}
                type="number"
                inputMode="numeric"
                value={duration}
                onChange={(event) => setDuration(event.target.value)}
                min={LIMITS.durationMin}
                max={LIMITS.durationMax}
                placeholder="90"
                className={fieldClass()}
              />
            </div>
            <div>
              <Label htmlFor={`${fieldId}-cost`}>Cost</Label>
              <input
                id={`${fieldId}-cost`}
                type="number"
                inputMode="decimal"
                value={cost}
                onChange={(event) => setCost(event.target.value)}
                min={0}
                max={LIMITS.costMax}
                placeholder="0"
                className={fieldClass()}
              />
            </div>
            <div>
              <Label htmlFor={`${fieldId}-currency`}>Currency</Label>
              <input
                id={`${fieldId}-currency`}
                value={currency}
                onChange={(event) => setCurrency(event.target.value)}
                maxLength={LIMITS.currency}
                placeholder="USD"
                className={fieldClass("uppercase")}
              />
            </div>
          </div>

          <div>
            <Label htmlFor={`${fieldId}-description`}>Description</Label>
            <textarea
              id={`${fieldId}-description`}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={LIMITS.description}
              rows={4}
              className={fieldClass("resize-y leading-relaxed")}
            />
            <p className="mt-1 text-right text-[10px] text-ink-subtle">
              {description.length}/{LIMITS.description}
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-ink-subtle hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!trimmedName}
              className="rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-canvas disabled:opacity-40"
            >
              {isCreate ? "Add stop" : "Save changes"}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div>
            <Label htmlFor={`${fieldId}-instruction`}>What should this stop be?</Label>
            <textarea
              id={`${fieldId}-instruction`}
              value={instruction}
              onChange={(event) => setInstruction(event.target.value)}
              maxLength={LIMITS.instruction}
              rows={3}
              autoFocus
              placeholder={
                isCreate
                  ? "e.g. somewhere to watch the sunset, or a late dinner nearby"
                  : "e.g. swap this for a rooftop dinner nearby, or make it the Egyptian Museum instead"
              }
              className={fieldClass("resize-none leading-relaxed")}
            />
            <p className="mt-1 text-[11px] leading-relaxed text-ink-subtle">
              {isCreate
                ? "The AI picks something that follows on from the day’s last stop. You can drag it earlier once it’s added."
                : "The AI keeps this slot’s time and fits the change around the stops before and after it."}
            </p>
          </div>

          {aiError && (
            <p
              role="alert"
              className="rounded-lg bg-danger-bg px-3 py-2 text-xs text-danger"
            >
              {aiError}
            </p>
          )}

          {suggestion && (
            <div className="rounded-xl border border-dashed border-accent bg-surface p-3">
              <p className="type-label mb-1.5 text-[10px]">
                {isCreate ? "Suggested stop" : "Suggested replacement"}
              </p>
              <p className="text-sm font-semibold text-ink">{suggestion.name}</p>
              {suggestion.description && (
                <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                  {suggestion.description}
                </p>
              )}
              <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-ink-muted">
                {[
                  suggestion.category && CATEGORY_LABELS[suggestion.category],
                  formatStopCost(suggestion.estimatedCost),
                  formatDuration(suggestion.durationMinutes),
                ]
                  .filter(Boolean)
                  .map((chip) => (
                    <span key={chip} className="rounded-full bg-surface-2 px-2 py-0.5">
                      {chip}
                    </span>
                  ))}
              </div>
              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSuggestion(null)}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-ink-subtle hover:text-ink"
                >
                  Discard
                </button>
                <button
                  type="button"
                  onClick={handleAccept}
                  className="rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-canvas"
                >
                  Use this
                </button>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-ink-subtle hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!instruction.trim() || pending}
              className="flex items-center gap-1.5 rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-canvas disabled:opacity-40"
            >
              {pending && <Loader2 size={13} aria-hidden className="animate-spin" />}
              {pending ? "Asking…" : suggestion ? "Try again" : "Ask AI"}
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
