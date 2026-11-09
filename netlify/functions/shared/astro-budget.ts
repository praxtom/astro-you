/**
 * Global spend cap and circuit breaker for the paid astrology API.
 *
 * The astrology-api.io plan is ~1,000 calls a month and has already run out
 * once. Per-IP and per-user limits do not bound the total, so every upstream
 * call (shared/astro-api.ts apiFetch) first reserves one unit here:
 *
 * - Counters: one Firestore doc per UTC day and one per UTC month in
 *   ASTRO_QUOTA_COLLECTION, bumped with FieldValue.increment. When either
 *   reaches its budget (ASTRO_DAILY_CALL_BUDGET / ASTRO_MONTHLY_CALL_BUDGET),
 *   the call is refused and the caller throws the existing quota error, so
 *   endpoints answer with their 503 `upstream_quota`.
 * - Breaker: when the upstream itself answers with a quota 429, the
 *   `state` doc gets `exhaustedUntil` (now + 30 min) and every call is
 *   short-circuited until then, instead of each request burning a round trip
 *   to learn the same thing.
 *
 * Counter and breaker storage are fail-open: a Firestore problem is logged and
 * the call goes ahead (the upstream's own quota is the backstop). The module
 * has no static Firebase import, so it stays unit-testable; the Firestore
 * store is loaded lazily and can be replaced with setAstroBudgetStore().
 */
import { classifyUpstreamChartError } from "./astro-error-classify.js";

export const ASTRO_QUOTA_COLLECTION = "astroQuota";
export const ASTRO_QUOTA_STATE_DOC = "state";
export const DEFAULT_DAILY_CALL_BUDGET = 60;
export const DEFAULT_MONTHLY_CALL_BUDGET = 900;
/** How long an upstream quota 429 short-circuits further calls. */
export const QUOTA_BREAKER_MS = 30 * 60 * 1000;
/** A refused call is remembered briefly so a burst doesn't re-read Firestore. */
const DENIAL_MEMO_MS = 60 * 1000;
/** Budget storage must never hold up a request for long. */
const STORE_TIMEOUT_MS = 1500;
/** Counter docs outlive their period so ops can look back (Firestore TTL). */
const DAY_DOC_RETENTION_MS = 45 * 24 * 60 * 60 * 1000;
const MONTH_DOC_RETENTION_MS = 400 * 24 * 60 * 60 * 1000;

type Env = Record<string, string | undefined>;

export interface QuotaPeriodIds {
  day: string;
  month: string;
}

export interface AstroBudgetSnapshot {
  dayCount: number;
  monthCount: number;
  exhaustedUntilMs: number | null;
}

export interface AstroBudgetStore {
  read(ids: QuotaPeriodIds): Promise<AstroBudgetSnapshot>;
  increment(ids: QuotaPeriodIds, now: Date): Promise<void>;
  tripBreaker(untilMs: number, now: Date): Promise<void>;
}

export type BudgetDenialReason = "breaker" | "daily_budget" | "monthly_budget";

export type BudgetDecision =
  | { allowed: true; commit: () => Promise<void> }
  | { allowed: false; reason: BudgetDenialReason };

/** A non-negative integer from env, or the fallback. "0" disables upstream calls. */
export function parseBudget(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === "") return fallback;
  const n = Number(raw.trim());
  return Number.isInteger(n) && n >= 0 ? n : fallback;
}

export function astroBudgetLimits(env: Env = process.env): {
  daily: number;
  monthly: number;
} {
  return {
    daily: parseBudget(env.ASTRO_DAILY_CALL_BUDGET, DEFAULT_DAILY_CALL_BUDGET),
    monthly: parseBudget(
      env.ASTRO_MONTHLY_CALL_BUDGET,
      DEFAULT_MONTHLY_CALL_BUDGET,
    ),
  };
}

/** Counter doc ids for the UTC day and month containing `nowMs`. */
export function quotaPeriodIds(nowMs: number = Date.now()): QuotaPeriodIds {
  const iso = new Date(nowMs).toISOString();
  return { day: `day_${iso.slice(0, 10)}`, month: `month_${iso.slice(0, 7)}` };
}

function toMs(value: unknown): number | null {
  if (value == null) return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const ms = Date.parse(value);
    return Number.isFinite(ms) ? ms : null;
  }
  const toDate = (value as { toDate?: () => Date }).toDate;
  return typeof toDate === "function" ? toDate.call(value).getTime() : null;
}

function countOf(data: Record<string, unknown> | undefined): number {
  const n = Number(data?.count ?? 0);
  return Number.isFinite(n) ? n : 0;
}

interface DocSnapLike {
  exists: boolean;
  data(): Record<string, unknown> | undefined;
}
interface DocRefLike {
  get(): Promise<DocSnapLike>;
  set(
    data: Record<string, unknown>,
    options?: { merge?: boolean },
  ): Promise<unknown>;
}
export interface BudgetDbLike {
  collection(name: string): { doc(id: string): DocRefLike };
}
export interface FieldValueLike {
  increment(n: number): unknown;
}

/** The Firestore-backed store (exported so tests can drive it with a fake db). */
export function firestoreBudgetStore(
  db: BudgetDbLike,
  fieldValue: FieldValueLike,
): AstroBudgetStore {
  const col = () => db.collection(ASTRO_QUOTA_COLLECTION);
  return {
    async read(ids) {
      const [day, month, state] = await Promise.all([
        col().doc(ids.day).get(),
        col().doc(ids.month).get(),
        col().doc(ASTRO_QUOTA_STATE_DOC).get(),
      ]);
      return {
        dayCount: day.exists ? countOf(day.data()) : 0,
        monthCount: month.exists ? countOf(month.data()) : 0,
        exhaustedUntilMs: state.exists
          ? toMs(state.data()?.exhaustedUntil)
          : null,
      };
    },
    async increment(ids, now) {
      await Promise.all([
        col()
          .doc(ids.day)
          .set(
            {
              count: fieldValue.increment(1),
              period: ids.day.slice(4),
              updatedAt: now,
              expiresAt: new Date(now.getTime() + DAY_DOC_RETENTION_MS),
            },
            { merge: true },
          ),
        col()
          .doc(ids.month)
          .set(
            {
              count: fieldValue.increment(1),
              period: ids.month.slice(6),
              updatedAt: now,
              expiresAt: new Date(now.getTime() + MONTH_DOC_RETENTION_MS),
            },
            { merge: true },
          ),
      ]);
    },
    async tripBreaker(untilMs, now) {
      await col()
        .doc(ASTRO_QUOTA_STATE_DOC)
        .set(
          {
            exhaustedUntil: new Date(untilMs),
            lastQuotaErrorAt: now,
          },
          { merge: true },
        );
    },
  };
}

// ─── Store selection ─────────────────────────────────────────────────────────

let overrideStore: AstroBudgetStore | null | undefined;
let defaultStorePromise: Promise<AstroBudgetStore | null> | null = null;

function loadDefaultStore(): Promise<AstroBudgetStore | null> {
  defaultStorePromise ??= import("./firebase-admin.js")
    .then(({ db, FieldValue }) =>
      firestoreBudgetStore(db as unknown as BudgetDbLike, FieldValue),
    )
    .catch((err) => {
      console.warn(
        "[AstroBudget] Firestore unavailable; astrology call budget NOT enforced:",
        err instanceof Error ? err.message : String(err),
      );
      return null;
    });
  return defaultStorePromise;
}

/**
 * Replace the store (tests). `null` disables enforcement; `undefined` restores
 * the lazy Firestore store. Also clears the in-memory memos.
 */
export function setAstroBudgetStore(
  store: AstroBudgetStore | null | undefined,
): void {
  overrideStore = store;
  resetAstroBudgetMemo();
}

async function currentStore(): Promise<AstroBudgetStore | null> {
  return overrideStore !== undefined ? overrideStore : loadDefaultStore();
}

// ─── In-memory memos (per function instance) ─────────────────────────────────

let breakerUntilMs = 0;
let denialMemo: { reason: BudgetDenialReason; untilMs: number } | null = null;

export function resetAstroBudgetMemo(): void {
  breakerUntilMs = 0;
  denialMemo = null;
}

function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${STORE_TIMEOUT_MS}ms`)),
      STORE_TIMEOUT_MS,
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

function describe(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

const NOOP_COMMIT = async () => {};

export interface BudgetOptions {
  now?: number;
  env?: Env;
}

/**
 * Reserve one upstream call. Returns `allowed: false` when the breaker is open
 * or a budget is spent; otherwise `commit()` records the call (run it
 * alongside the fetch; it never throws).
 */
export async function reserveAstroCall(
  options: BudgetOptions = {},
): Promise<BudgetDecision> {
  const nowMs = options.now ?? Date.now();
  if (breakerUntilMs > nowMs) return { allowed: false, reason: "breaker" };
  if (denialMemo && denialMemo.untilMs > nowMs) {
    return { allowed: false, reason: denialMemo.reason };
  }

  const store = await currentStore();
  if (!store) return { allowed: true, commit: NOOP_COMMIT };

  const ids = quotaPeriodIds(nowMs);
  const limits = astroBudgetLimits(options.env);
  let snapshot: AstroBudgetSnapshot;
  try {
    snapshot = await withTimeout(store.read(ids), "budget read");
  } catch (err) {
    console.warn(
      "[AstroBudget] Counter read failed; allowing call (fail-open):",
      describe(err),
    );
    return { allowed: true, commit: commitFor(store, ids, nowMs) };
  }

  if (snapshot.exhaustedUntilMs && snapshot.exhaustedUntilMs > nowMs) {
    breakerUntilMs = snapshot.exhaustedUntilMs;
    return { allowed: false, reason: "breaker" };
  }
  const reason: BudgetDenialReason | null =
    snapshot.monthCount >= limits.monthly
      ? "monthly_budget"
      : snapshot.dayCount >= limits.daily
        ? "daily_budget"
        : null;
  if (reason) {
    if (!denialMemo || denialMemo.reason !== reason) {
      console.error(
        `[AstroBudget] ${reason === "daily_budget" ? `Daily budget (${limits.daily})` : `Monthly budget (${limits.monthly})`} reached — refusing astrology API calls (day=${snapshot.dayCount}, month=${snapshot.monthCount}).`,
      );
    }
    denialMemo = { reason, untilMs: nowMs + DENIAL_MEMO_MS };
    return { allowed: false, reason };
  }
  return { allowed: true, commit: commitFor(store, ids, nowMs) };
}

function commitFor(
  store: AstroBudgetStore,
  ids: QuotaPeriodIds,
  nowMs: number,
): () => Promise<void> {
  return async () => {
    try {
      await withTimeout(
        store.increment(ids, new Date(nowMs)),
        "budget increment",
      );
    } catch (err) {
      console.warn(
        "[AstroBudget] Counter increment failed (fail-open):",
        describe(err),
      );
    }
  };
}

/**
 * Inspect an upstream response: a quota 429 opens the breaker for
 * QUOTA_BREAKER_MS. Reads a clone, so the caller's body stays unread.
 */
export async function noteAstroResponse(
  res: Response,
  options: BudgetOptions = {},
): Promise<void> {
  if (res.status !== 429) return;
  const body = await res
    .clone()
    .text()
    .catch(() => null);
  if (body === null) return;
  if (classifyUpstreamChartError(429, body) !== "quota_exhausted") return;
  await tripAstroBreaker(options.now);
}

/** Open the breaker locally and in Firestore (fail-open on storage errors). */
export async function tripAstroBreaker(
  now: number = Date.now(),
): Promise<void> {
  const untilMs = now + QUOTA_BREAKER_MS;
  breakerUntilMs = Math.max(breakerUntilMs, untilMs);
  console.error(
    `[AstroBudget] Upstream quota exhausted — short-circuiting astrology API calls until ${new Date(untilMs).toISOString()}.`,
  );
  const store = await currentStore();
  if (!store) return;
  try {
    await withTimeout(
      store.tripBreaker(untilMs, new Date(now)),
      "breaker write",
    );
  } catch (err) {
    console.warn("[AstroBudget] Breaker write failed:", describe(err));
  }
}
