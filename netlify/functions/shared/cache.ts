/**
 * Firestore caching helpers for shared astronomical data.
 * Prevents redundant API calls for data that's the same for all users on a given day.
 */
import { db } from "./firebase-admin";

/**
 * Get or set a cached document. Returns cached data if fresh, otherwise calls fetcher and caches result.
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
    try {
        const docRef = db.collection(collection).doc(docId);
        const cached = await docRef.get();

        if (cached.exists) {
            const data = cached.data()!;
            const cachedAt = data._cachedAt?.toDate?.() || new Date(data._cachedAt);
            const ageHours = (Date.now() - cachedAt.getTime()) / (1000 * 60 * 60);

            if (ageHours < ttlHours) {
                const { _cachedAt, ...rest } = data;
                return rest as T;
            }
        }

        // Cache miss or expired — fetch fresh
        const fresh = await fetcher();

        // Store in Firestore (fire-and-forget, don't block response)
        docRef.set({ ...(fresh as any), _cachedAt: new Date() }).catch(err => {
            console.warn(`[Cache] Failed to write ${collection}/${docId}:`, err.message);
        });

        return fresh;
    } catch (err) {
        // If Firestore fails entirely, still return fresh data
        console.warn(`[Cache] Firestore error for ${collection}/${docId}, fetching fresh:`, err);
        return fetcher();
    }
}
