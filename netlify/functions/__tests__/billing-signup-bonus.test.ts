import test from "node:test";
import assert from "node:assert/strict";
import {
  canonicalizeEmail,
  initializeUserCredits,
  signupGrantKey,
  type CreditDeps,
} from "../shared/credits.js";
import { createFakeFirestore } from "./helpers/fake-firestore.js";

const SECRET_ENV = { OTP_HASH_SECRET: "x".repeat(40) };

test("canonicalizeEmail folds case, +tags and Gmail dots", () => {
  assert.equal(
    canonicalizeEmail("John.Doe+promo@GMAIL.com"),
    "johndoe@gmail.com",
  );
  assert.equal(
    canonicalizeEmail("j.o.h.n.doe@googlemail.com"),
    "johndoe@gmail.com",
  );
  // Dots matter outside Gmail.
  assert.equal(
    canonicalizeEmail("john.doe+x@example.com"),
    "john.doe@example.com",
  );
  assert.equal(canonicalizeEmail("not-an-email"), null);
  assert.equal(canonicalizeEmail(undefined), null);
});

test("signupGrantKey is a keyed hash, stable across email variants", () => {
  const a = signupGrantKey("John.Doe+x@gmail.com", SECRET_ENV);
  const b = signupGrantKey("johndoe@gmail.com", SECRET_ENV);
  assert.equal(a, b);
  assert.match(a || "", /^[0-9a-f]{64}$/);
  assert.equal((a || "").includes("johndoe"), false);
  // A different secret gives a different key (it is keyed, not a plain hash).
  assert.notEqual(
    signupGrantKey("johndoe@gmail.com", { OTP_HASH_SECRET: "y".repeat(40) }),
    a,
  );
});

test("delete + re-signup with the same mailbox gets no second signup bonus", async () => {
  const fake = createFakeFirestore();
  const first = await initializeUserCredits(fake, {
    uid: "first_uid",
    email: "johndoe@gmail.com",
    env: SECRET_ENV,
  });
  assert.equal(first.balanceAfter, 15);

  // Account deleted: the whole users/first_uid tree goes away.
  for (const key of [...fake.store.keys()]) {
    if (key.startsWith("users/first_uid")) fake.store.delete(key);
  }

  const second = await initializeUserCredits(fake, {
    uid: "second_uid",
    email: "John.Doe+again@gmail.com",
    env: SECRET_ENV,
  });
  assert.equal(second.duplicate, false);
  assert.equal(second.balanceAfter, 0);
  assert.equal(fake.get("users/second_uid")?.credits, 0);
  // The sentinel is still written so repeat calls are idempotent.
  assert.equal(
    fake.get("users/second_uid/creditLedger/signup_bonus")?.amount,
    0,
  );
  const again = await initializeUserCredits(fake, {
    uid: "second_uid",
    email: "johndoe@gmail.com",
    env: SECRET_ENV,
  });
  assert.equal(again.duplicate, true);
});

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
  assert.equal(writes.length, 3);
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
  assert.equal(writes.length, 3);
  assert.deepEqual(writes[0].data.credits, { op: "increment", value: 15 });
  assert.equal(writes[1].path, "users/user_123/creditLedger/signup_bonus");
});
