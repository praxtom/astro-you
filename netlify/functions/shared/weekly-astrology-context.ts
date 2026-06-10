import { createHash } from "node:crypto";
import type { UserContext } from "./gemini.js";

const WEEKLY_ASTROLOGY_CONTEXT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

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
}

export interface WeeklyAstrologyContextStore {
  get(docId: string): Promise<WeeklyAstrologyCacheRecord | null | undefined>;
  set(docId: string, record: WeeklyAstrologyCacheRecord): Promise<void>;
}

export interface WeeklyAstrologyContextResult {
  docId: string;
  source: "cache" | "fresh" | "stale";
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
  const cached = await options.store.get(docId);

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

    throw error;
  }
}

function createWeeklyAstrologyContextDocId(
  uid: string | undefined,
  birthData: BirthDataLike,
) {
  const birthKey = JSON.stringify({
    dob: birthData.dob || "",
    tob: birthData.tob || "",
    pob: birthData.pob || "",
    lat: birthData.lat ?? birthData.coordinates?.lat ?? "",
    lng: birthData.lng ?? birthData.coordinates?.lng ?? "",
  });
  const cacheKey = JSON.stringify({ uid: uid || "guest", birthKey });
  return createHash("sha256").update(cacheKey).digest("hex").slice(0, 32);
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
