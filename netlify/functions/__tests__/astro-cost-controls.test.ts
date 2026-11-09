import test from "node:test";
import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import {
  astroBudgetLimits,
  firestoreBudgetStore,
  noteAstroResponse,
  parseBudget,
  quotaPeriodIds,
  reserveAstroCall,
  resetAstroBudgetMemo,
  setAstroBudgetStore,
  ASTRO_QUOTA_COLLECTION,
  QUOTA_BREAKER_MS,
  type AstroBudgetSnapshot,
  type AstroBudgetStore,
} from "../shared/astro-budget.js";
import {
  getCachedOrFetchWith,
  CACHE_LEASE_COLLECTION,
} from "../shared/cache.js";
import {
  birthChartCacheKey,
  chartCacheKey,
  keyedCacheId,
  resolveChartCacheKeySecret,
} from "../shared/chart-cache.js";
import {
  chartErrorKind,
  isUpstreamQuotaError,
  upstreamQuotaResponse,
} from "../shared/kundali-errors.js";
import {
  createWeeklyAstrologyContextDocId,
  getWeeklyAstrologyContext,
  WEEKLY_ASTROLOGY_NEGATIVE_TTL_MS,
  type WeeklyAstrologyCacheRecord,
} from "../shared/weekly-astrology-context.js";
import { getPanchang, getDashaPeriods } from "../shared/astro-api.js";

// ─── In-memory Firestore fake ────────────────────────────────────────────────

const INC = Symbol("increment");
const fakeFieldValue = {
  increment: (n: number) => ({ [INC]: n }),
};

function hasNestedArray(value: unknown, inArray = false): boolean {
  if (Array.isArray(value)) {
    if (inArray) return true;
    return value.some((v) => hasNestedArray(v, true));
  }
  if (value && typeof value === "object" && !(value instanceof Date)) {
    return Object.values(value).some((v) => hasNestedArray(v, false));
  }
  return false;
}

class FakeDb {
  docs = new Map<string, Record<string, any>>();
  writes = 0;
  failAll = false;
  collection(name: string) {
    return { doc: (id: string) => new FakeRef(this, `${name}/${id}`) };
  }
  async runTransaction<R>(fn: (tx: any) => Promise<R>): Promise<R> {
    if (this.failAll) throw new Error("firestore down");
    return fn({
      get: (ref: FakeRef) => ref.get(),
      set: (ref: FakeRef, data: Record<string, unknown>) => {
        this.docs.set(ref.path, { ...data });
      },
    });
  }
}

class FakeRef {
  constructor(
    private db: FakeDb,
    readonly path: string,
  ) {}
  async get() {
    if (this.db.failAll) throw new Error("firestore down");
    const doc = this.db.docs.get(this.path);
    return {
      exists: doc !== undefined,
      data: () => (doc ? { ...doc } : undefined),
    };
  }
  async set(data: Record<string, unknown>, options?: { merge?: boolean }) {
    if (this.db.failAll) throw new Error("firestore down");
    // Firestore rejects nested arrays (and so did the old cache writes).
    if (hasNestedArray(data))
      throw new Error("Nested arrays are not supported");
    this.db.writes += 1;
    const base = options?.merge
      ? { ...(this.db.docs.get(this.path) ?? {}) }
      : {};
    for (const [k, v] of Object.entries(data)) {
      if (v && typeof v === "object" && INC in (v as object)) {
        base[k] = Number(base[k] ?? 0) + (v as any)[INC];
      } else {
        base[k] = v;
      }
    }
    this.db.docs.set(this.path, base);
  }
  async delete() {
    this.db.docs.delete(this.path);
  }
}

function memoryBudgetStore(
  init: Partial<AstroBudgetSnapshot> = {},
): AstroBudgetStore & { snapshot: AstroBudgetSnapshot; increments: number } {
  const store = {
    snapshot: {
      dayCount: init.dayCount ?? 0,
      monthCount: init.monthCount ?? 0,
      exhaustedUntilMs: init.exhaustedUntilMs ?? null,
    },
    increments: 0,
    async read() {
      return { ...store.snapshot };
    },
    async increment() {
      store.increments += 1;
      store.snapshot.dayCount += 1;
      store.snapshot.monthCount += 1;
    },
    async tripBreaker(untilMs: number) {
      store.snapshot.exhaustedUntilMs = untilMs;
    },
  };
  return store;
}

const QUOTA_429 = JSON.stringify({
  success: false,
  error: {
    error_code: "RATE_LIMIT_EXCEEDED",
    message: "Quota exceeded for this billing period",
  },
});

function quietly<T>(fn: () => Promise<T>): Promise<T> {
  const { warn, error } = console;
  console.warn = () => undefined;
  console.error = () => undefined;
  return fn().finally(() => {
    console.warn = warn;
    console.error = error;
  });
}

// ─── Budget & breaker ────────────────────────────────────────────────────────

test("budget env parsing: defaults, overrides, zero, garbage", () => {
  assert.deepEqual(astroBudgetLimits({}), { daily: 60, monthly: 900 });
  assert.deepEqual(
    astroBudgetLimits({
      ASTRO_DAILY_CALL_BUDGET: "25",
      ASTRO_MONTHLY_CALL_BUDGET: "500",
    }),
    { daily: 25, monthly: 500 },
  );
  assert.equal(parseBudget("0", 60), 0);
  assert.equal(parseBudget("-3", 60), 60);
  assert.equal(parseBudget("12.5", 60), 60);
  assert.equal(parseBudget("lots", 60), 60);
  assert.equal(parseBudget("  ", 60), 60);
});

test("quota counters are one doc per UTC day and per UTC month", () => {
  const ids = quotaPeriodIds(Date.parse("2026-11-30T23:59:00Z"));
  assert.deepEqual(ids, { day: "day_2026-11-30", month: "month_2026-11" });
  assert.deepEqual(quotaPeriodIds(Date.parse("2026-12-01T00:00:01Z")), {
    day: "day_2026-12-01",
    month: "month_2026-12",
  });
});

test("reserve: within budget allows and commit counts the call", async () => {
  const store = memoryBudgetStore({ dayCount: 3, monthCount: 40 });
  setAstroBudgetStore(store);
  const decision = await reserveAstroCall({ env: {} });
  assert.equal(decision.allowed, true);
  if (decision.allowed) await decision.commit();
  assert.equal(store.increments, 1);
});

test("reserve: daily and monthly budgets refuse at the limit", async () => {
  setAstroBudgetStore(memoryBudgetStore({ dayCount: 60, monthCount: 100 }));
  const daily = await quietly(() => reserveAstroCall({ env: {} }));
  assert.deepEqual(daily, { allowed: false, reason: "daily_budget" });

  setAstroBudgetStore(memoryBudgetStore({ dayCount: 1, monthCount: 900 }));
  const monthly = await quietly(() => reserveAstroCall({ env: {} }));
  assert.deepEqual(monthly, { allowed: false, reason: "monthly_budget" });

  // Env override raises the ceiling.
  setAstroBudgetStore(memoryBudgetStore({ dayCount: 60, monthCount: 100 }));
  const raised = await reserveAstroCall({
    env: { ASTRO_DAILY_CALL_BUDGET: "100" },
  });
  assert.equal(raised.allowed, true);
});

test("reserve: an open breaker in Firestore short-circuits", async () => {
  const now = Date.parse("2026-11-10T10:00:00Z");
  setAstroBudgetStore(
    memoryBudgetStore({ exhaustedUntilMs: now + 5 * 60 * 1000 }),
  );
  assert.deepEqual(await reserveAstroCall({ now, env: {} }), {
    allowed: false,
    reason: "breaker",
  });
  // An expired breaker no longer blocks.
  setAstroBudgetStore(memoryBudgetStore({ exhaustedUntilMs: now - 1 }));
  assert.equal((await reserveAstroCall({ now, env: {} })).allowed, true);
});

test("reserve: counter store failures fail open (logged)", async () => {
  const broken: AstroBudgetStore = {
    async read() {
      throw new Error("firestore down");
    },
    async increment() {
      throw new Error("firestore down");
    },
    async tripBreaker() {
      throw new Error("firestore down");
    },
  };
  setAstroBudgetStore(broken);
  const warnings: unknown[] = [];
  const { warn } = console;
  console.warn = (...args: unknown[]) => warnings.push(args);
  try {
    const decision = await reserveAstroCall({ env: {} });
    assert.equal(decision.allowed, true);
    if (decision.allowed) await decision.commit(); // never throws
  } finally {
    console.warn = warn;
  }
  assert.ok(warnings.length >= 2, "both failures are logged");

  setAstroBudgetStore(null); // no store at all → allowed
  assert.equal((await reserveAstroCall({ env: {} })).allowed, true);
});

test("an upstream quota 429 opens the breaker for 30 minutes; a throttle 429 does not", async () => {
  const now = Date.parse("2026-11-10T10:00:00Z");
  const store = memoryBudgetStore();
  setAstroBudgetStore(store);

  await noteAstroResponse(new Response("slow down", { status: 429 }), { now });
  assert.equal(store.snapshot.exhaustedUntilMs, null);

  const res = new Response(QUOTA_429, { status: 429 });
  await quietly(() => noteAstroResponse(res, { now }));
  assert.equal(store.snapshot.exhaustedUntilMs, now + QUOTA_BREAKER_MS);
  // The caller's body is untouched (we read a clone).
  assert.equal(await res.text(), QUOTA_429);
  // In-memory breaker: refused without even reading the store.
  assert.deepEqual(await reserveAstroCall({ now: now + 60_000, env: {} }), {
    allowed: false,
    reason: "breaker",
  });
  assert.equal(
    (await reserveAstroCall({ now: now + QUOTA_BREAKER_MS + 1, env: {} }))
      .allowed,
    true,
  );
});

test("firestoreBudgetStore: increments day+month docs and reads the breaker", async () => {
  const db = new FakeDb();
  const store = firestoreBudgetStore(db as any, fakeFieldValue);
  const ids = quotaPeriodIds(Date.parse("2026-11-10T10:00:00Z"));
  const now = new Date("2026-11-10T10:00:00Z");
  await store.increment(ids, now);
  await store.increment(ids, now);
  const day = db.docs.get(`${ASTRO_QUOTA_COLLECTION}/day_2026-11-10`);
  assert.equal(day?.count, 2);
  assert.ok(day?.expiresAt instanceof Date, "TTL field set");
  assert.equal(
    db.docs.get(`${ASTRO_QUOTA_COLLECTION}/month_2026-11`)?.count,
    2,
  );
  await store.tripBreaker(now.getTime() + 1000, now);
  const snap = await store.read(ids);
  assert.deepEqual(snap, {
    dayCount: 2,
    monthCount: 2,
    exhaustedUntilMs: now.getTime() + 1000,
  });
});

test("astro-api: a spent budget throws the quota error without calling upstream", async () => {
  setAstroBudgetStore(memoryBudgetStore({ dayCount: 999, monthCount: 999 }));
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    return new Response("{}", { status: 200 });
  }) as typeof fetch;
  try {
    const err = await quietly(() =>
      getPanchang("2026-11-10", "New Delhi", 28.6, 77.2).then(
        () => null,
        (e) => e,
      ),
    );
    assert.ok(err, "throws");
    assert.equal(chartErrorKind(err), "quota_exhausted");
    assert.equal(isUpstreamQuotaError(err), true);
    assert.equal(calls, 0);
    const res = upstreamQuotaResponse();
    assert.equal(res.status, 503);
    assert.equal((await res.json()).code, "upstream_quota");
  } finally {
    globalThis.fetch = original;
  }
});

test("astro-api: after an upstream quota 429 the next call is short-circuited", async () => {
  const store = memoryBudgetStore();
  setAstroBudgetStore(store);
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    return new Response(QUOTA_429, { status: 429 });
  }) as typeof fetch;
  try {
    await quietly(() =>
      getDashaPeriods({ dob: "1990-05-15", tob: "10:30", pob: "X" }).catch(
        () => null,
      ),
    );
    assert.equal(calls, 1);
    assert.equal(store.increments, 1, "the upstream call was counted");
    assert.ok(store.snapshot.exhaustedUntilMs, "breaker persisted");
    const err = await quietly(() =>
      getDashaPeriods({ dob: "1990-05-15", tob: "10:30", pob: "X" }).then(
        () => null,
        (e) => e,
      ),
    );
    assert.equal(chartErrorKind(err), "quota_exhausted");
    assert.equal(calls, 1, "no second upstream call while the breaker is open");
  } finally {
    globalThis.fetch = original;
    setAstroBudgetStore(null);
    resetAstroBudgetMemo();
  }
});

// ─── Cache keys ──────────────────────────────────────────────────────────────

const OTP = "otp-secret-at-least-32-characters-long-abc";
const DEDICATED = "dedicated-cache-secret-at-least-32-chars-xyz";

test("CACHE_KEY_SECRET: unset keeps the OTP-derived key (existing ids stay valid)", () => {
  const legacy = createHmac("sha256", OTP)
    .update("astroyou:chart-cache-key:v1")
    .digest("hex");
  assert.equal(resolveChartCacheKeySecret({ OTP_HASH_SECRET: OTP }), legacy);
  // Too short a dedicated secret is ignored.
  assert.equal(
    resolveChartCacheKeySecret({
      OTP_HASH_SECRET: OTP,
      CACHE_KEY_SECRET: "short",
    }),
    legacy,
  );
  const dedicated = resolveChartCacheKeySecret({
    OTP_HASH_SECRET: OTP,
    CACHE_KEY_SECRET: DEDICATED,
  });
  assert.notEqual(dedicated, legacy);
  // Works without OTP_HASH_SECRET too.
  assert.equal(
    resolveChartCacheKeySecret({ CACHE_KEY_SECRET: DEDICATED }),
    dedicated,
  );
});

test("keyedCacheId is deterministic, secret-dependent and not a plain hash", () => {
  const parts = [
    "1990-05-15|10:30|Delhi|28.6|77.2|male",
    "1992-01-02|06:00|Pune|||female",
  ];
  const a = keyedCacheId("match_guna", parts, { OTP_HASH_SECRET: OTP });
  assert.equal(a, keyedCacheId("match_guna", parts, { OTP_HASH_SECRET: OTP }));
  assert.match(a, /^[0-9a-f]{40}$/);
  assert.notEqual(
    a,
    keyedCacheId("match_synastry", parts, { OTP_HASH_SECRET: OTP }),
  );
  assert.notEqual(
    a,
    keyedCacheId("match_guna", parts, { CACHE_KEY_SECRET: DEDICATED }),
  );
  const plain = createHash("sha256")
    .update(`${parts[0]}#${parts[1]}`)
    .digest("hex");
  assert.ok(!plain.startsWith(a));
});

test("birthChartCacheKey matches the id /api/kundali builds for DASHAS", () => {
  const env = { OTP_HASH_SECRET: OTP };
  const bd = {
    dob: "1990-05-15",
    tob: "10:30",
    pob: "New Delhi",
    lat: 28.6139,
    lng: 77.209,
  };
  // kundali.ts: chartCacheKey with zodiacMode undefined for non-D1 types and
  // a variant object whose values are all undefined for DASHAS.
  const kundaliKey = chartCacheKey(
    {
      chartType: "DASHAS",
      ...bd,
      zodiacMode: undefined,
      birthTimeUnknown: false,
      variant: { remedyType: undefined, subject: undefined, date: undefined },
    },
    env,
  );
  assert.equal(birthChartCacheKey("DASHAS", bd, undefined, env), kundaliKey);
  assert.notEqual(
    birthChartCacheKey(
      "DASHAS",
      { ...bd, birthTimeUnknown: true },
      undefined,
      env,
    ),
    kundaliKey,
  );
  // Personal forecasts: same chart, different window → different entry.
  assert.notEqual(
    birthChartCacheKey("HOROSCOPE_WEEKLY", bd, { window: "2026-W45" }, env),
    birthChartCacheKey("HOROSCOPE_WEEKLY", bd, { window: "2026-W46" }, env),
  );
});

test("weekly context doc id is an HMAC, not sha256(uid+birth)", () => {
  const bd = {
    dob: "1990-05-15",
    tob: "10:30",
    pob: "Delhi",
    lat: 28.6,
    lng: 77.2,
  };
  const id = createWeeklyAstrologyContextDocId("user_1", bd, {
    OTP_HASH_SECRET: OTP,
  });
  assert.match(id, /^[0-9a-f]{32}$/);
  assert.equal(
    id,
    createWeeklyAstrologyContextDocId("user_1", bd, { OTP_HASH_SECRET: OTP }),
  );
  assert.notEqual(
    id,
    createWeeklyAstrologyContextDocId("user_2", bd, { OTP_HASH_SECRET: OTP }),
  );
  assert.notEqual(
    id,
    createWeeklyAstrologyContextDocId("user_1", bd, {
      CACHE_KEY_SECRET: DEDICATED,
    }),
  );
  const legacy = createHash("sha256")
    .update(
      JSON.stringify({
        uid: "user_1",
        birthKey: JSON.stringify({
          dob: bd.dob,
          tob: bd.tob,
          pob: bd.pob,
          lat: bd.lat,
          lng: bd.lng,
        }),
      }),
    )
    .digest("hex")
    .slice(0, 32);
  assert.notEqual(id, legacy);
});

// ─── Cache behaviour ─────────────────────────────────────────────────────────

test("cache: miss fetches and stores serialized; nested arrays survive; hit skips fetcher", async () => {
  const db = new FakeDb();
  const payload = {
    grid: [
      [1, 2],
      [3, 4],
    ],
    name: "x",
  };
  let fetches = 0;
  const fetcher = async () => {
    fetches += 1;
    return payload;
  };
  const first = await getCachedOrFetchWith(
    db,
    "transit_reports",
    "k1",
    fetcher,
    12,
  );
  assert.deepEqual(first, payload);
  const doc = db.docs.get("transit_reports/k1");
  assert.equal(typeof doc?._json, "string", "stored as JSON by default");
  assert.ok(doc?.expiresAt instanceof Date);
  const second = await getCachedOrFetchWith(
    db,
    "transit_reports",
    "k1",
    fetcher,
    12,
  );
  assert.deepEqual(second, payload);
  assert.equal(fetches, 1);
  // The fetch lease is released.
  assert.equal(
    [...db.docs.keys()].filter((k) => k.startsWith(CACHE_LEASE_COLLECTION))
      .length,
    0,
  );
});

test("cache: legacy _payload and spread-format docs are still read", async () => {
  const db = new FakeDb();
  const fresh = new Date();
  db.docs.set("panchang/a", {
    _payload: { tithi: "Dwitiya" },
    _cachedAt: fresh,
  });
  db.docs.set("panchang/b", {
    tithi: "Tritiya",
    _cachedAt: fresh,
    expiresAt: fresh,
  });
  const never = async () => {
    throw new Error("should not fetch");
  };
  assert.deepEqual(await getCachedOrFetchWith(db, "panchang", "a", never), {
    tithi: "Dwitiya",
  });
  assert.deepEqual(await getCachedOrFetchWith(db, "panchang", "b", never), {
    tithi: "Tritiya",
  });
});

test("cache: expired entries refetch; empty and rejected values are not stored", async () => {
  const db = new FakeDb();
  db.docs.set("tarot_daily/d", {
    _json: JSON.stringify({ card: "old" }),
    _cachedAt: new Date(Date.now() - 30 * 3600 * 1000),
  });
  assert.deepEqual(
    await getCachedOrFetchWith(db, "tarot_daily", "d", async () => ({
      card: "new",
    })),
    { card: "new" },
  );
  await getCachedOrFetchWith(
    db,
    "match_cache",
    "empty",
    async () => [] as unknown[],
  );
  assert.equal(db.docs.has("match_cache/empty"), false);
  await getCachedOrFetchWith(
    db,
    "match_cache",
    "half",
    async () => ({ overall_score: 0 }),
    24,
    {
      shouldCache: (v) => Boolean(v.overall_score),
    },
  );
  assert.equal(db.docs.has("match_cache/half"), false);
  await assert.rejects(
    getCachedOrFetchWith(db, "match_cache", "boom", async () => {
      throw new Error("upstream down");
    }),
    /upstream down/,
  );
  assert.equal(db.docs.has("match_cache/boom"), false);
  assert.equal(
    db.docs.has(`${CACHE_LEASE_COLLECTION}/match_cache__boom`),
    false,
    "lease released on failure",
  );
});

test("cache: concurrent misses in one instance share a single upstream fetch", async () => {
  const db = new FakeDb();
  let fetches = 0;
  const fetcher = async () => {
    fetches += 1;
    await new Promise((r) => setTimeout(r, 20));
    return { v: 1 };
  };
  const results = await Promise.all(
    Array.from({ length: 5 }, () =>
      getCachedOrFetchWith(db, "panchang", "same", fetcher),
    ),
  );
  assert.equal(fetches, 1);
  for (const r of results) assert.deepEqual(r, { v: 1 });
});

test("cache: a waiter whose leader failed retries with its own fetcher", async () => {
  const db = new FakeDb();
  const leader = getCachedOrFetchWith(db, "chart_cache", "g", async () => {
    await new Promise((r) => setTimeout(r, 10));
    throw new Error("guest budget");
  });
  const follower = getCachedOrFetchWith(db, "chart_cache", "g", async () => ({
    ok: true,
  }));
  await assert.rejects(leader, /guest budget/);
  assert.deepEqual(await follower, { ok: true });
});

test("cache: another instance's lease makes us wait for its write instead of fetching", async () => {
  const db = new FakeDb();
  db.docs.set(`${CACHE_LEASE_COLLECTION}/panchang__p1`, {
    until: new Date(Date.now() + 10_000),
  });
  // The "other instance" writes the doc shortly.
  setTimeout(() => {
    db.docs.set("panchang/p1", {
      _json: JSON.stringify({ tithi: "Ekadashi" }),
      _cachedAt: new Date(),
    });
  }, 15);
  let fetches = 0;
  const value = await getCachedOrFetchWith(
    db,
    "panchang",
    "p1",
    async () => {
      fetches += 1;
      return { tithi: "mine" };
    },
    20,
    { leasePollMs: 10, leasePollAttempts: 10 },
  );
  assert.deepEqual(value, { tithi: "Ekadashi" });
  assert.equal(fetches, 0);
});

test("cache: a stuck lease holder only delays us; Firestore outage fails open", async () => {
  const db = new FakeDb();
  db.docs.set(`${CACHE_LEASE_COLLECTION}/panchang__p2`, {
    until: new Date(Date.now() + 10_000),
  });
  const value = await getCachedOrFetchWith(
    db,
    "panchang",
    "p2",
    async () => ({ x: 1 }),
    20,
    {
      leasePollMs: 1,
      leasePollAttempts: 2,
    },
  );
  assert.deepEqual(value, { x: 1 });

  const down = new FakeDb();
  down.failAll = true;
  const v2 = await quietly(() =>
    getCachedOrFetchWith(down, "panchang", "p3", async () => ({ y: 2 })),
  );
  assert.deepEqual(v2, { y: 2 });
});

// ─── Weekly context negative cache ───────────────────────────────────────────

test("weekly context: a failed pull with no copy is negatively cached for 10 minutes", async () => {
  const docs = new Map<string, WeeklyAstrologyCacheRecord>();
  const store = {
    async get(id: string) {
      return docs.get(id) ?? null;
    },
    async set(id: string, record: WeeklyAstrologyCacheRecord) {
      docs.set(id, record);
    },
  };
  const birthData = { dob: "1990-01-01", tob: "12:00", pob: "Delhi" };
  let pulls = 0;
  const failing = async () => {
    pulls += 1;
    throw new Error("upstream_quota");
  };
  const t0 = new Date("2026-11-10T10:00:00Z");

  await assert.rejects(
    getWeeklyAstrologyContext({
      uid: "u1",
      birthData,
      now: t0,
      store,
      fetchFresh: failing,
    }),
    /upstream_quota/,
  );
  assert.equal(pulls, 1);
  const negative = [...docs.values()][0];
  assert.equal(negative.failed, true);
  assert.equal(negative.uid, "u1");
  assert.ok(negative.expiresAt instanceof Date);

  // Next chat turn, 5 minutes later: no upstream retry.
  const t1 = new Date(t0.getTime() + 5 * 60 * 1000);
  const r1 = await getWeeklyAstrologyContext({
    uid: "u1",
    birthData,
    now: t1,
    store,
    fetchFresh: failing,
  });
  assert.equal(r1.source, "unavailable");
  assert.deepEqual(r1.data, {});
  assert.equal(pulls, 1);

  // After the negative TTL it tries again — and a success replaces the marker.
  const t2 = new Date(t0.getTime() + WEEKLY_ASTROLOGY_NEGATIVE_TTL_MS + 1);
  const r2 = await getWeeklyAstrologyContext({
    uid: "u1",
    birthData,
    now: t2,
    store,
    fetchFresh: async () => {
      pulls += 1;
      return { transitContext: "Saturn over Moon" };
    },
  });
  assert.equal(r2.source, "fresh");
  assert.equal(pulls, 2);
  const good = [...docs.values()][0];
  assert.equal(good.failed, undefined);
  assert.equal(good.uid, "u1");
  assert.ok(good.expiresAt instanceof Date);
  assert.ok(
    (good.expiresAt as Date).getTime() > t2.getTime() + 7 * 24 * 3600 * 1000,
  );
});

test("weekly context: guest records carry uid null", async () => {
  let written: WeeklyAstrologyCacheRecord | undefined;
  await getWeeklyAstrologyContext({
    birthData: { dob: "1990-01-01", tob: "12:00" },
    store: {
      async get() {
        return null;
      },
      async set(_id, record) {
        written = record;
      },
    },
    fetchFresh: async () => ({ transitContext: "x" }),
  });
  assert.equal(written?.uid, null);
});
