import test from "node:test";
import assert from "node:assert/strict";
import { initializeUserCredits, type CreditDeps } from "../shared/credits.js";

type Write = {
  type: "update" | "set";
  path?: string;
  data: Record<string, unknown>;
};

type DocRef = {
  id: string;
  path: string;
  collection(name: string): CollectionRef;
};

type CollectionRef = {
  doc(id?: string): DocRef;
};

function createCollection(path: string): CollectionRef {
  return {
    doc(id = "generated") {
      const docPath = `${path}/${id}`;
      return {
        id,
        path: docPath,
        collection(name: string) {
          return createCollection(`${docPath}/${name}`);
        },
      };
    },
  };
}

function createDeps(documents: Record<string, Record<string, unknown>> = {}) {
  const writes: Write[] = [];
  const deps: CreditDeps = {
    db: {
      collection(name: string) {
        return createCollection(name);
      },
      async runTransaction(callback) {
        return callback({
          async get(ref) {
            const data = documents[ref.path || ""];
            return {
              exists: Boolean(data),
              data: () => data,
            };
          },
          update(ref, data) {
            writes.push({ type: "update", path: ref.path, data });
          },
          set(ref, data) {
            writes.push({ type: "set", path: ref.path, data });
          },
        });
      },
    },
    FieldValue: {
      increment(value: number) {
        return { op: "increment", value };
      },
      serverTimestamp() {
        return "server-timestamp";
      },
    },
  };

  return { deps, writes };
}

test("signup bonus is granted incrementally even when credits already exist (referral landed first)", async () => {
  // A referral claim merge-set credits: 10 before initialization ran. The
  // defined credits field must NOT be treated as "already initialized".
  const { deps, writes } = createDeps({
    "users/user_123": { credits: 10 },
  });

  const result = await initializeUserCredits(deps, {
    uid: "user_123",
    email: "user@example.com",
  });

  assert.deepEqual(result, {
    balanceBefore: 10,
    balanceAfter: 25,
    duplicate: false,
  });
  assert.equal(writes.length, 2);
  assert.equal(writes[0].path, "users/user_123");
  // Increment (not overwrite) so the referral credits are preserved.
  assert.deepEqual(writes[0].data.credits, { op: "increment", value: 15 });
  assert.equal(writes[1].path, "users/user_123/creditLedger/signup_bonus");
  assert.equal(writes[1].data.type, "signup_bonus");
  assert.equal(writes[1].data.balanceBefore, 10);
  assert.equal(writes[1].data.balanceAfter, 25);
});

test("signup bonus idempotency relies only on the ledger sentinel", async () => {
  const { deps, writes } = createDeps({
    "users/user_123": { credits: 25 },
    "users/user_123/creditLedger/signup_bonus": {
      type: "signup_bonus",
      amount: 15,
    },
  });

  const result = await initializeUserCredits(deps, {
    uid: "user_123",
    email: "user@example.com",
  });

  assert.deepEqual(result, {
    balanceBefore: 25,
    balanceAfter: 25,
    duplicate: true,
  });
  assert.equal(writes.length, 0);
});

test("signup bonus grants 15 credits to a brand-new user", async () => {
  const { deps, writes } = createDeps();

  const result = await initializeUserCredits(deps, {
    uid: "user_123",
    email: "user@example.com",
  });

  assert.deepEqual(result, {
    balanceBefore: 0,
    balanceAfter: 15,
    duplicate: false,
  });
  assert.equal(writes.length, 2);
  assert.deepEqual(writes[0].data.credits, { op: "increment", value: 15 });
  assert.equal(writes[1].path, "users/user_123/creditLedger/signup_bonus");
});
