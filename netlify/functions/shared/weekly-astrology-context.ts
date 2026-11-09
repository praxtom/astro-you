import type { UserContext } from "./gemini.js";
import { keyedCacheId } from "./chart-cache.js";

const WEEKLY_ASTROLOGY_CONTEXT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/**
 * A failed pull with no older copy is remembered this long, so every chat
 * turn doesn't retry the same three upstream calls.
 */
export const WEEKLY_ASTROLOGY_NEGATIVE_TTL_MS = 10 * 60 * 1000;
/**
 * Firestore TTL (`expiresAt`): a good record outlives its 7-day freshness so
 * it can still serve as the stale fallback when a refresh fails.
 */
const WEEKLY_ASTROLOGY_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

interface BirthDataLike {
  dob?: string;
  tob?: string;
  pob?: string;
  lat?: number;
  lng?: number;
  coordinates?: {
    lat?: number;
    lng?: number;
  };
}

interface FirestoreTimestampLike {
  toDate(): Date;
}

export interface WeeklyAstrologyContextData {
  dashaInfo?: UserContext["dashaInfo"];
  transitContext?: string;
  yogaData?: UserContext["yogaData"];
  panchangData?: UserContext["panchangData"];
}

export interface WeeklyAstrologyCacheRecord {
  cachedAt: Date | string | number | FirestoreTimestampLike;
  data: WeeklyAstrologyContextData;
  /**
   * Owner, so account deletion can find these docs with
   * where("uid", "==", uid). null for guest records.
   */
  uid?: string | null;
  /** Firestore TTL policy field. */
  expiresAt?: Date | string | number | FirestoreTimestampLike;
  /** Negative-cache marker: the last pull failed and no older copy existed. */
  failed?: boolean;
}

export interface WeeklyAstrologyContextStore {
  get(docId: string): Promise<WeeklyAstrologyCacheRecord | null | undefined>;
  set(docId: string, record: WeeklyAstrologyCacheRecord): Promise<void>;
}

export interface WeeklyAstrologyContextResult {
  docId: string;
  /** "unavailable": a recent pull failed (negative cache) — data is empty. */
  source: "cache" | "fresh" | "stale" | "unavailable";
  data: WeeklyAstrologyContextData;
}

interface WeeklyAstrologyContextOptions {
  uid?: string;
  birthData: BirthDataLike;
  now?: Date;
  store: WeeklyAstrologyContextStore;
  fetchFresh(): Promise<WeeklyAstrologyContextData>;
}

export async function getWeeklyAstrologyContext(
  options: WeeklyAstrologyContextOptions,
): Promise<WeeklyAstrologyContextResult> {
  const now = options.now || new Date();
  const docId = createWeeklyAstrologyContextDocId(
    options.uid,
    options.birthData,
  );
  const uid = options.uid || null;
  const stored = await options.store.get(docId);

  // A recent failure with nothing to fall back on: don't hammer upstream.
  if (stored?.failed) {
    const failedAt = toDate(stored.cachedAt);
    if (
      failedAt &&
      now.getTime() - failedAt.getTime() < WEEKLY_ASTROLOGY_NEGATIVE_TTL_MS
    ) {
      return { docId, source: "unavailable", data: {} };
    }
  }
  // A negative record is never a usable (stale) copy.
  const cached = stored && !stored.failed ? stored : null;

  if (cached && isCacheFresh(cached.cachedAt, now)) {
    return {
      docId,
      source: "cache",
      data: cached.data,
    };
  }

  try {
    const fresh = await options.fetchFresh();
    const record = stripUndefinedValues({
      cachedAt: now,
      data: fresh,
      uid,
      expiresAt: new Date(now.getTime() + WEEKLY_ASTROLOGY_RETENTION_MS),
    }) as WeeklyAstrologyCacheRecord;
    await options.store.set(docId, record);

    return {
      docId,
      source: "fresh",
      data: fresh,
    };
  } catch (error) {
    if (cached) {
      console.warn(
        `[WeeklyAstrologyContext] Fresh pull failed for ${docId}; using stale cache:`,
        error,
      );
      return {
        docId,
        source: "stale",
        data: cached.data,
      };
    }

    // Remember the failure briefly (best-effort) so the next turns skip
    // upstream; the caller still sees this turn's error.
    try {
      await options.store.set(docId, {
        cachedAt: now,
        data: {},
        uid,
        failed: true,
        expiresAt: new Date(now.getTime() + WEEKLY_ASTROLOGY_NEGATIVE_TTL_MS),
      });
    } catch (writeError) {
      console.warn(
        `[WeeklyAstrologyContext] Could not record failed pull for ${docId}:`,
        writeError,
      );
    }
    throw error;
  }
}

/**
 * Doc id: an HMAC (shared/chart-cache keyedCacheId) of the owner and birth
 * inputs. A plain SHA-256 of these could be brute-forced back to the birth
 * moment. Changing the scheme simply re-pulls each user's context once.
 */
export function createWeeklyAstrologyContextDocId(
  uid: string | undefined,
  birthData: BirthDataLike,
  env: Record<string, string | undefined> = process.env,
) {
  const birthKey = JSON.stringify({
    dob: birthData.dob || "",
    tob: birthData.tob || "",
    pob: birthData.pob || "",
    lat: birthData.lat ?? birthData.coordinates?.lat ?? "",
    lng: birthData.lng ?? birthData.coordinates?.lng ?? "",
  });
  const cacheKey = JSON.stringify({ uid: uid || "guest", birthKey });
  return keyedCacheId("weekly_astrology_context", [cacheKey], env, 32);
}

function isCacheFresh(
  cachedAtValue: WeeklyAstrologyCacheRecord["cachedAt"],
  now: Date,
) {
  const cachedAt = toDate(cachedAtValue);
  if (!cachedAt) return false;
  return now.getTime() - cachedAt.getTime() < WEEKLY_ASTROLOGY_CONTEXT_TTL_MS;
}

function toDate(value: WeeklyAstrologyCacheRecord["cachedAt"]) {
  if (value instanceof Date) return value;
  if (typeof value === "number" || typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }
  return value?.toDate?.();
}

function stripUndefinedValues(value: unknown): unknown {
  if (value === undefined) return undefined;
  if (value === null || value instanceof Date) return value;
  if (Array.isArray(value)) {
    return value
      .map((item) => stripUndefinedValues(item))
      .filter((item) => item !== undefined);
  }
  if (typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value)
      .map(([key, item]) => [key, stripUndefinedValues(item)] as const)
      .filter(([, item]) => item !== undefined),
  );
}
