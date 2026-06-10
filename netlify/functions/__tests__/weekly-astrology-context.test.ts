import test from "node:test";
import assert from "node:assert/strict";
import {
  getWeeklyAstrologyContext,
  type WeeklyAstrologyCacheRecord,
} from "../shared/weekly-astrology-context.js";

const birthData = {
  name: "Test",
  dob: "1990-01-01",
  tob: "12:00",
  pob: "New Delhi",
  lat: 28.6139,
  lng: 77.209,
};

test("weekly astrology context reuses fresh cache without calling provider", async () => {
  let fetchCount = 0;
  const cachedAt = new Date("2026-06-08T00:00:00Z");
  const cached: WeeklyAstrologyCacheRecord = {
    cachedAt,
    data: {
      dashaInfo: { currentMahadasha: "Saturn" },
      transitContext: "Saturn aspecting natal Moon",
      yogaData: [{ name: "Gajakesari Yoga" }],
      panchangData: { tithi: "Dwitiya" },
    },
  };

  const result = await getWeeklyAstrologyContext({
    uid: "user_123",
    birthData,
    now: new Date("2026-06-10T00:00:00Z"),
    store: {
      async get() {
        return cached;
      },
      async set() {
        throw new Error("fresh cache should not be overwritten");
      },
    },
    async fetchFresh() {
      fetchCount += 1;
      return { transitContext: "fresh" };
    },
  });

  assert.equal(fetchCount, 0);
  assert.equal(result.source, "cache");
  assert.equal(result.data.transitContext, cached.data.transitContext);
});

test("weekly astrology context refreshes cache after seven days", async () => {
  let fetchCount = 0;
  const writes: WeeklyAstrologyCacheRecord[] = [];

  const result = await getWeeklyAstrologyContext({
    uid: "user_123",
    birthData,
    now: new Date("2026-06-10T00:00:00Z"),
    store: {
      async get() {
        return {
          cachedAt: new Date("2026-06-01T23:59:00Z"),
          data: { transitContext: "stale" },
        };
      },
      async set(_docId, record) {
        writes.push(record);
      },
    },
    async fetchFresh() {
      fetchCount += 1;
      return { transitContext: "fresh" };
    },
  });

  assert.equal(fetchCount, 1);
  assert.equal(result.source, "fresh");
  assert.equal(result.data.transitContext, "fresh");
  assert.equal(writes[0]?.data.transitContext, "fresh");
});

test("weekly astrology context keeps stale cache when fresh pull fails", async () => {
  const writes: WeeklyAstrologyCacheRecord[] = [];
  const originalWarn = console.warn;

  try {
    console.warn = () => undefined;

    const result = await getWeeklyAstrologyContext({
      uid: "user_123",
      birthData,
      now: new Date("2026-06-10T00:00:00Z"),
      store: {
        async get() {
          return {
            cachedAt: new Date("2026-06-01T00:00:00Z"),
            data: { transitContext: "older but useful" },
          };
        },
        async set(_docId, record) {
          writes.push(record);
        },
      },
      async fetchFresh() {
        throw new Error("provider quota exceeded");
      },
    });

    assert.equal(result.source, "stale");
    assert.equal(result.data.transitContext, "older but useful");
    assert.equal(writes.length, 0);
  } finally {
    console.warn = originalWarn;
  }
});
