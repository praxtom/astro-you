/**
 * Firestore caching helpers for shared astronomical data.
 * Prevents redundant API calls for data that's the same for all users on a given day.
 */
import { db } from "./firebase-admin.js";
import { cacheExpiresAt } from "./chart-cache.js";

export interface CacheOptions {
  serialize?: boolean;
}

// Firestore's hard document limit is 1 MiB; leave room for the envelope.
const MAX_SERIALIZED_CHARS = 900_000;

/**
 * Get or set a cached document. Returns cached data if fresh, otherwise calls fetcher and caches result.
 *
 * Payloads are stored in an envelope ({ _payload, _cachedAt }) — spreading the
 * payload into the doc corrupts arrays into {0:…,1:…} objects on read-back.
 * Legacy docs (written pre-envelope) carry no _payload key and are read via the
 * old spread format.
 *
 * @param collection - Firestore collection name (e.g., "panchang", "transits")
 * @param docId - Document ID (typically a date string like "2026-03-29")
 * @param fetcher - Async function that fetches fresh data from the API
 * @param ttlHours - Cache TTL in hours (default 20 — covers a full day with buffer)
 * @param options.serialize - Store the payload as a JSON string. Use for
 *   upstream payloads of unknown shape: Firestore rejects nested arrays and
 *   `undefined` values, which would otherwise make every write fail silently.
 */
export async function getCachedOrFetch<T>(
  collection: string,
  docId: string,
  fetcher: () => Promise<T>,
  ttlHours: number = 20,
  options: CacheOptions = {},
): Promise<T> {
  const docRef = db.collection(collection).doc(docId);

  try {
    const cached = await docRef.get();

    if (cached.exists) {
      const data = cached.data()!;
      const cachedAt = data._cachedAt?.toDate?.() || new Date(data._cachedAt);
      const ageHours = (Date.now() - cachedAt.getTime()) / (1000 * 60 * 60);

      if (ageHours < ttlHours) {
        if (typeof data._json === "string") return JSON.parse(data._json) as T;
        if ("_payload" in data) return data._payload as T;
        const { _cachedAt, expiresAt: _expiresAt, ...rest } = data;
        return rest as T;
      }
    }
  } catch (err) {
    // Firestore read failure must not break the request — fall through to fetch.
    console.warn(
      `[Cache] Firestore read failed for ${collection}/${docId}:`,
      err,
    );
  }

  // Cache miss or expired — fetch fresh. Fetcher errors propagate to the caller.
  const fresh = await fetcher();

  // Empty results indicate an upstream failure or a no-data response; caching
  // them would poison the collection for the full TTL after one blip.
  const isEmpty =
    fresh == null ||
    (Array.isArray(fresh) && fresh.length === 0) ||
    (typeof fresh === "object" && Object.keys(fresh as object).length === 0);

  if (!isEmpty) {
    const cachedAt = new Date();
    // Firestore TTL policy field (firestore.indexes.json fieldOverrides):
    // expired cache docs are deleted automatically instead of lingering.
    const expiresAt = cacheExpiresAt(cachedAt, ttlHours);
    let envelope: Record<string, unknown> = {
      _payload: fresh,
      _cachedAt: cachedAt,
      expiresAt,
    };
    if (options.serialize) {
      const json = JSON.stringify(fresh);
      if (json.length > MAX_SERIALIZED_CHARS) return fresh;
      envelope = { _json: json, _cachedAt: cachedAt, expiresAt };
    }
    // Fire-and-forget, don't block response.
    docRef.set(envelope).catch((err) => {
      console.warn(
        `[Cache] Failed to write ${collection}/${docId}:`,
        err.message,
      );
    });
  }

  return fresh;
}
