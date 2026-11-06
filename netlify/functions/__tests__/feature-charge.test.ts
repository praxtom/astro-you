import test from "node:test";
import assert from "node:assert/strict";
import { CreditError } from "../shared/credits.js";
import {
  ChargeAttemptsExhaustedError,
  chargeLedgerId,
  MAX_CHARGE_ATTEMPTS,
  refundLedgerId,
  reserveFeatureCharge,
} from "../shared/feature-charge.js";

/** Minimal in-memory Firestore stand-in (paths → docs) for credits.ts. */
function makeFakeDb(initialCredits: number) {
  const docs = new Map<string, Record<string, any>>();
  docs.set("users/u1", { credits: initialCredits });

  const ref = (path: string): any => ({
    path,
    id: path.split("/").pop(),
    collection: (name: string) => ({
      doc: (id?: string) => ref(`${path}/${name}/${id}`),
    }),
  });
  const FieldValue = {
    increment: (value: number) => ({ __inc: value }),
    serverTimestamp: () => "ts",
  };
  const db = {
    collection: (name: string) => ({ doc: (id?: string) => ref(`${name}/${id}`) }),
    runTransaction: async <T>(cb: (tx: any) => Promise<T>): Promise<T> => {
      const writes: Array<() => void> = [];
      const tx = {
        get: async (r: any) => {
          const data = docs.get(r.path);
          return { exists: data !== undefined, data: () => data };
        },
        update: (r: any, data: Record<string, any>) =>
          writes.push(() => {
            const cur = { ...(docs.get(r.path) || {}) };
            for (const [k, v] of Object.entries(data)) {
              cur[k] = v && typeof v === "object" && "__inc" in v
                ? (cur[k] ?? 0) + (v as any).__inc
                : v;
            }
            docs.set(r.path, cur);
          }),
        set: (r: any, data: Record<string, any>) =>
          writes.push(() => docs.set(r.path, { ...data })),
      };
      const out = await cb(tx); // throws → nothing committed
      writes.forEach((w) => w());
      return out;
    },
  };
  return {
    deps: { db, FieldValue } as any,
    balance: () => docs.get("users/u1")?.credits as number,
    has: (id: string) => docs.has(`users/u1/creditLedger/${id}`),
  };
}

const F = "horoscope_weekly";
const TXN = "abc123";

test("a duplicate request without a refund is charged exactly once", async () => {
  const fake = makeFakeDb(10);
  const first = await reserveFeatureCharge(fake.deps, "u1", F, 2, TXN);
  const again = await reserveFeatureCharge(fake.deps, "u1", F, 2, TXN);
  assert.equal(first.charged, true);
  assert.equal(again.charged, false, "same paid window must dedupe");
  assert.equal(fake.balance(), 8);
  // A no-op charge's refund must not hand credits back.
  await again.refund();
  assert.equal(fake.balance(), 8);
});

test("charge → refund → retry charges again (no free retries forever)", async () => {
  const fake = makeFakeDb(10);
  const first = await reserveFeatureCharge(fake.deps, "u1", F, 2, TXN);
  await first.refund();
  assert.equal(fake.balance(), 10);
  // Attempt 0 keeps the historical ledger ids.
  assert.ok(fake.has(chargeLedgerId(F, TXN, 0)));
  assert.ok(fake.has(`feature_${F}_refund_${TXN}`));

  const retry = await reserveFeatureCharge(fake.deps, "u1", F, 2, TXN);
  assert.equal(retry.charged, true, "a refunded window must be chargeable");
  assert.equal(fake.balance(), 8);
  assert.ok(fake.has(chargeLedgerId(F, TXN, 1)));

  // ...and after that successful retry, duplicates dedupe again.
  const dup = await reserveFeatureCharge(fake.deps, "u1", F, 2, TXN);
  assert.equal(dup.charged, false);
  assert.equal(fake.balance(), 8);

  // Refunding the second attempt uses its own refund id.
  await retry.refund();
  assert.equal(fake.balance(), 10);
  assert.ok(fake.has(refundLedgerId(F, TXN, 1)));
});

test("refund is idempotent per attempt", async () => {
  const fake = makeFakeDb(10);
  const c = await reserveFeatureCharge(fake.deps, "u1", F, 2, TXN);
  await c.refund();
  await c.refund();
  assert.equal(fake.balance(), 10);
});

test("insufficient balance throws CreditError and records nothing", async () => {
  const fake = makeFakeDb(1);
  await assert.rejects(
    reserveFeatureCharge(fake.deps, "u1", F, 2, TXN),
    (err: unknown) => err instanceof CreditError && err.status === 402,
  );
  assert.equal(fake.balance(), 1);
  assert.equal(fake.has(chargeLedgerId(F, TXN, 0)), false);
});

test("a zero-cost feature never touches the ledger", async () => {
  const fake = makeFakeDb(10);
  const c = await reserveFeatureCharge(fake.deps, "u1", F, 0, TXN);
  assert.equal(c.charged, false);
  assert.equal(fake.balance(), 10);
});

test("exhausted refund→retry attempts throw 429 instead of serving free", async () => {
  const fake = makeFakeDb(10);
  for (let n = 0; n < MAX_CHARGE_ATTEMPTS; n++) {
    const c = await reserveFeatureCharge(fake.deps, "u1", F, 2, TXN);
    assert.equal(c.charged, true);
    await c.refund();
  }
  assert.equal(fake.balance(), 10);
  await assert.rejects(
    reserveFeatureCharge(fake.deps, "u1", F, 2, TXN),
    (err: unknown) =>
      err instanceof ChargeAttemptsExhaustedError &&
      err instanceof CreditError &&
      err.status === 429,
  );
  assert.equal(fake.balance(), 10, "nothing charged, nothing served");
});
