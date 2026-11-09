/**
 * Firestore caching helpers for shared astronomical data.
 * Prevents redundant API calls for data that's the same for all users on a given day.
 *
 * No static Firebase import: getCachedOrFetch() loads the Admin SDK lazily, and
 * getCachedOrFetchWith() takes any Firestore-shaped db so the cache behaviour
 * can be unit-tested with an in-memory fake.
 */
import { cacheExpiresAt } from "./chart-cache.js";

export interface CacheOptions<T = unknown> {
  /**
   * Store the payload as a JSON string (default true). Upstream payloads have
   * unknown shapes and Firestore rejects nested arrays and `undefined`, which
   * made native writes fail silently. Pass `false` only for payloads known to
   * be Firestore-safe that something needs to query field-by-field.
   */
  serialize?: boolean;
  /** Extra guard: a fresh value is written only when this returns true. */
  shouldCache?: (value: T) => boolean;
  /** Cross-instance fetch lease length (ms). 0 disables the lease. */
  leaseMs?: number;
  /** While another instance holds the lease: how often / how many times to re-check the cache. */
  leasePollMs?: number;
  leasePollAttempts?: number;
}

// Firestore's hard document limit is 1 MiB; leave room for the envelope.
const MAX_SERIALIZED_CHARS = 900_000;

/** Collection holding short fetch leases (admin-only via the rules catch-all). */
export const CACHE_LEASE_COLLECTION = "cacheLeases";
/** Upstream calls time out at 8 s; a lease outlives one attempt and no more. */
const DEFAULT_LEASE_MS = 12_000;
const DEFAULT_LEASE_POLL_MS = 400;
const DEFAULT_LEASE_POLL_ATTEMPTS = 6;
const LEASE_STORE_TIMEOUT_MS = 1500;

interface SnapLike {
  exists: boolean;
  data(): Record<string, any> | undefined;
}
interface DocRefLike {
  get(): Promise<SnapLike>;
  set(data: Record<string, unknown>): Promise<unknown>;
  delete(): Promise<unknown>;
}
interface TxLike {
  get(ref: any): Promise<SnapLike>;
  set(ref: any, data: Record<string, unknown>): unknown;
}
/** The slice of Firestore the cache uses. */
export interface CacheDb {
  collection(name: string): { doc(id: string): any };
  runTransaction<R>(fn: (tx: any) => Promise<R>): Promise<R>;
}

let defaultDbPromise: Promise<CacheDb> | null = null;
function defaultDb(): Promise<CacheDb> {
  defaultDbPromise ??= import("./firebase-admin.js").then(
    ({ db }) => db as unknown as CacheDb,
  );
  return defaultDbPromise;
}

/** In-process dedupe: concurrent misses for one doc share a single fetch. */
const inflight = new Map<string, Promise<unknown>>();

type CacheRead<T> = { hit: true; value: T } | { hit: false };

function toDateValue(value: any): Date | null {
  if (!value) return null;
  const d =
    typeof value.toDate === "function" ? value.toDate() : new Date(value);
  return Number.isFinite(d.getTime()) ? d : null;
}

/** Decode a cache doc in any of the three stored formats. */
export function decodeCacheDoc<T>(data: Record<string, any>): T {
  if (typeof data._json === "string") return JSON.parse(data._json) as T;
  if ("_payload" in data) return data._payload as T;
  // Legacy (pre-envelope) docs spread the payload into the doc itself.
  const { _cachedAt, expiresAt: _expiresAt, ...rest } = data;
  return rest as T;
}

async function readFresh<T>(
  docRef: DocRefLike,
  ttlHours: number,
  label: string,
): Promise<CacheRead<T>> {
  try {
    const cached = await docRef.get();
    if (!cached.exists) return { hit: false };
    const data = cached.data();
    if (!data) return { hit: false };
    const cachedAt = toDateValue(data._cachedAt);
    if (!cachedAt) return { hit: false };
    const ageHours = (Date.now() - cachedAt.getTime()) / (1000 * 60 * 60);
    if (ageHours >= ttlHours) return { hit: false };
    return { hit: true, value: decodeCacheDoc<T>(data) };
  } catch (err) {
    // Firestore read (or a corrupt _json) must not break the request — fall
    // through to fetch.
    console.warn(`[Cache] Firestore read failed for ${label}:`, describe(err));
    return { hit: false };
  }
}

function describe(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`timed out after ${ms}ms`)),
      ms,
    );
    if (typeof timer === "object" && "unref" in timer) timer.unref();
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Lease doc id: Firestore ids cannot contain "/". */
export function cacheLeaseId(collection: string, docId: string): string {
  return `${collection}__${docId}`.replace(/\//g, "_").slice(0, 1400);
}

type LeaseState = "acquired" | "held" | "unavailable";

/**
 * Try to take the short fetch lease for a doc. "held" means another instance
 * is fetching it right now; "unavailable" (store error) fails open.
 */
async function acquireLease(
  db: CacheDb,
  leaseRef: unknown,
  leaseMs: number,
): Promise<LeaseState> {
  try {
    return await withTimeout(
      db.runTransaction(async (tx: TxLike) => {
        const snap = await tx.get(leaseRef);
        const until = snap.exists ? toDateValue(snap.data()?.until) : null;
        const now = Date.now();
        if (until && until.getTime() > now) return "held" as const;
        tx.set(leaseRef, {
          until: new Date(now + leaseMs),
          // Firestore TTL cleans up leases a crashed holder never released.
          expiresAt: new Date(now + leaseMs + 60 * 60 * 1000),
        });
        return "acquired" as const;
      }),
      LEASE_STORE_TIMEOUT_MS,
    );
  } catch (err) {
    console.warn("[Cache] Lease unavailable (fail-open):", describe(err));
    return "unavailable";
  }
}

function isEmptyValue(fresh: unknown): boolean {
  return (
    fresh == null ||
    (Array.isArray(fresh) && fresh.length === 0) ||
    (typeof fresh === "object" && Object.keys(fresh as object).length === 0)
  );
}

async function writeCache<T>(
  docRef: DocRefLike,
  fresh: T,
  ttlHours: number,
  options: CacheOptions<T>,
  label: string,
): Promise<void> {
  // Empty results indicate an upstream failure or a no-data response; caching
  // them would poison the collection for the full TTL after one blip.
  if (isEmptyValue(fresh)) return;
  if (options.shouldCache && !options.shouldCache(fresh)) return;
  const cachedAt = new Date();
  // Firestore TTL policy field (firestore.indexes.json fieldOverrides):
  // expired cache docs are deleted automatically instead of lingering.
  const expiresAt = cacheExpiresAt(cachedAt, ttlHours);
  let envelope: Record<string, unknown>;
  if (options.serialize === false) {
    envelope = { _payload: fresh, _cachedAt: cachedAt, expiresAt };
  } else {
    const json = JSON.stringify(fresh);
    if (json === undefined || json.length > MAX_SERIALIZED_CHARS) return;
    envelope = { _json: json, _cachedAt: cachedAt, expiresAt };
  }
  try {
    await docRef.set(envelope);
  } catch (err) {
    console.warn(`[Cache] Failed to write ${label}:`, describe(err));
  }
}

async function fillMiss<T>(
  db: CacheDb,
  collection: string,
  docId: string,
  docRef: DocRefLike,
  fetcher: () => Promise<T>,
  ttlHours: number,
  options: CacheOptions<T>,
): Promise<T> {
  const label = `${collection}/${docId}`;
  const leaseMs = options.leaseMs ?? DEFAULT_LEASE_MS;
  const leaseRef =
    leaseMs > 0
      ? db
          .collection(CACHE_LEASE_COLLECTION)
          .doc(cacheLeaseId(collection, docId))
      : null;
  const lease: LeaseState = leaseRef
    ? await acquireLease(db, leaseRef, leaseMs)
    : "unavailable";

  if (lease === "held") {
    // Another instance is fetching this doc: wait briefly for its write
    // rather than spending a second upstream call on the same answer.
    const attempts = options.leasePollAttempts ?? DEFAULT_LEASE_POLL_ATTEMPTS;
    const pollMs = options.leasePollMs ?? DEFAULT_LEASE_POLL_MS;
    for (let i = 0; i < attempts; i++) {
      await sleep(pollMs);
      const hit = await readFresh<T>(docRef, ttlHours, label);
      if (hit.hit) return hit.value;
    }
    // Holder is slow or failed — fetch ourselves (fail-open).
  }

  try {
    // Fetcher errors propagate to the caller; nothing is cached.
    const fresh = await fetcher();
    // Awaited (not fire-and-forget): a frozen serverless instance would drop
    // the write, and lease waiters poll for exactly this doc.
    await writeCache(docRef, fresh, ttlHours, options, label);
    return fresh;
  } finally {
    if (lease === "acquired" && leaseRef) {
      await Promise.resolve()
        .then(() => (leaseRef as DocRefLike).delete())
        .catch((err) =>
          console.warn(
            `[Cache] Lease release failed for ${label}:`,
            describe(err),
          ),
        );
    }
  }
}

/**
 * getCachedOrFetch against an explicit db (tests inject a fake Firestore).
 */
export async function getCachedOrFetchWith<T>(
  db: CacheDb,
  collection: string,
  docId: string,
  fetcher: () => Promise<T>,
  ttlHours: number = 20,
  options: CacheOptions<T> = {},
): Promise<T> {
  const label = `${collection}/${docId}`;
  const docRef = db.collection(collection).doc(docId) as DocRefLike;

  const hit = await readFresh<T>(docRef, ttlHours, label);
  if (hit.hit) return hit.value;

  const pending = inflight.get(label) as Promise<T> | undefined;
  if (pending) {
    try {
      return await pending;
    } catch {
      // The leader's fetch failed — possibly for a reason specific to its
      // request (e.g. a guest budget). Try with our own fetcher.
      return fillMiss(
        db,
        collection,
        docId,
        docRef,
        fetcher,
        ttlHours,
        options,
      );
    }
  }

  const own = fillMiss(
    db,
    collection,
    docId,
    docRef,
    fetcher,
    ttlHours,
    options,
  );
  inflight.set(label, own);
  try {
    return await own;
  } finally {
    if (inflight.get(label) === own) inflight.delete(label);
  }
}

/**
 * Get or set a cached document. Returns cached data if fresh, otherwise calls fetcher and caches result.
 *
 * Payloads are stored in an envelope — `{ _json, _cachedAt, expiresAt }` by
 * default (`{ _payload, … }` with serialize:false). Spreading the payload into
 * the doc corrupts arrays into {0:…,1:…} objects on read-back. Docs written in
 * any earlier format (`_payload`, or legacy spread) are still read.
 *
 * Concurrent misses are deduplicated in-process, and a short Firestore lease
 * keeps other instances from all going upstream for the same doc at once.
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
  options: CacheOptions<T> = {},
): Promise<T> {
  let db: CacheDb;
  try {
    db = await defaultDb();
  } catch (err) {
    console.warn(
      "[Cache] Firestore unavailable; fetching uncached:",
      describe(err),
    );
    return fetcher();
  }
  return getCachedOrFetchWith(
    db,
    collection,
    docId,
    fetcher,
    ttlHours,
    options,
  );
}
