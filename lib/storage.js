const STORAGE_KEY = "trip-planner:session";

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
