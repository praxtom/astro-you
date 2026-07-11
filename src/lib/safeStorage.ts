/**
 * Parse a JSON value from web storage, tolerating corruption.
 *
 * A malformed stored value would otherwise throw at JSON.parse and — with only
 * a root error boundary — white-screen the whole app permanently, because the
 * bad key is re-read on every reload. On parse failure we remove the offending
 * key and return null so the app can fall back to a clean state.
 */
export function parseStoredJSON<T = unknown>(
  storage: Storage,
  key: string,
): T | null {
  let raw: string | null;
  try {
    raw = storage.getItem(key);
  } catch {
    return null;
  }
  if (raw == null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    try {
      storage.removeItem(key);
    } catch {
      /* ignore */
    }
    return null;
  }
}
