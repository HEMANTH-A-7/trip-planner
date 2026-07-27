const STORAGE_KEY = "trip-planner:session";
const HISTORY_KEY = "trip-planner:history";
// Trips are kept whole (not just their prompt) so reopening one is instant and
// costs no tokens. Capped because localStorage is a few MB and a large
// itinerary is a few KB - ten is far inside the budget and keeps the sidebar
// list scannable.
const HISTORY_LIMIT = 10;

// Loading a saved session is a nice-to-have, not a source of truth: any
// failure (corrupted JSON, an old shape from a previous version, storage
// disabled) just means "no saved session" rather than a crash.
export function loadSession() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed?.itinerary?.days)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveSession(session) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Storage can fail (quota exceeded, private browsing) - losing the
    // save-for-later convenience isn't worth surfacing as an app error.
  }
}

export function clearSession() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Same as above - nothing to surface if this fails.
  }
}

// Same forgiving contract as loadSession: any failure means "no history"
// rather than a crash. Entries that don't hold a usable itinerary are dropped
// instead of being handed to the UI.
export function loadHistory() {
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry) => entry?.id && Array.isArray(entry?.itinerary?.days)
    );
  } catch {
    return [];
  }
}

// Upsert by id, newest first. Called on every itinerary edit (not just on
// creation), so reopening a trip from history gets the removals, renames and
// reorderings that were made to it - not the itinerary as first generated.
// Returns the new list so callers can drive state off it directly.
export function saveToHistory(entry) {
  const next = [entry, ...loadHistory().filter((e) => e.id !== entry.id)].slice(
    0,
    HISTORY_LIMIT
  );
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch {
    // Quota exceeded or storage disabled - the in-memory list is still
    // correct for this session, so hand it back either way.
  }
  return next;
}

export function removeFromHistory(id) {
  const next = loadHistory().filter((entry) => entry.id !== id);
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch {
    // Same as above.
  }
  return next;
}
