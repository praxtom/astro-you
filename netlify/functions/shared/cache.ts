/**
 * Firestore caching helpers for shared astronomical data.
 * Prevents redundant API calls for data that's the same for all users on a given day.
 */
import { db } from "./firebase-admin.js";

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
 */
export async function getCachedOrFetch<T>(
  collection: string,
  docId: string,
  fetcher: () => Promise<T>,
  ttlHours: number = 20,
): Promise<T> {
  const docRef = db.collection(collection).doc(docId);

  try {
    const cached = await docRef.get();

    if (cached.exists) {
      const data = cached.data()!;
      const cachedAt = data._cachedAt?.toDate?.() || new Date(data._cachedAt);
      const ageHours = (Date.now() - cachedAt.getTime()) / (1000 * 60 * 60);

      if (ageHours < ttlHours) {
        if ("_payload" in data) return data._payload as T;
        const { _cachedAt, ...rest } = data;
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
    // Fire-and-forget, don't block response.
    docRef.set({ _payload: fresh, _cachedAt: new Date() }).catch((err) => {
      console.warn(
        `[Cache] Failed to write ${collection}/${docId}:`,
        err.message,
      );
    });
  }

  return fresh;
}
