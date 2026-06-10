import test from "node:test";
import assert from "node:assert/strict";
import {
  ConsultSessionError,
  endConsultSession,
  startConsultSession,
  type ConsultSessionDeps,
} from "../shared/consult-session.js";
import { applyCreditChange, initializeUserCredits } from "../shared/credits.js";

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

function createDeps(
  credits: number | undefined,
  now: number,
  documents: Record<string, Record<string, unknown>> = {},
) {
  const writes: Write[] = [];
  const deps: ConsultSessionDeps = {
    auth: {
      async verifyIdToken(idToken: string) {
        assert.equal(idToken, "valid-token");
        return { uid: "user_123" };
      },
    },
    db: {
      collection(name: string) {
        return createCollection(name);
      },
      async runTransaction(callback) {
        return callback({
          async get(ref) {
            if (ref.path === "users/user_123") {
              return {
                exists: true,
                data: () => (credits === undefined ? {} : { credits }),
              };
            }

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
    now: () => now,
  };

  return { deps, writes };
}

test("startConsultSession creates an active server-owned session", async () => {
  const now = 1_800_000;
  const { deps, writes } = createDeps(25, now);

  const result = await startConsultSession(deps, {
    idToken: "valid-token",
    personaId: "guru-vidyanath",
    preferredLanguage: "Hindi",
  });

  assert.deepEqual(result, {
    success: true,
    sessionId: "generated",
    personaId: "guru-vidyanath",
    startedAt: now,
    pricePerMin: 5,
    credits: 25,
    estimatedMinutes: 5,
    preferredLanguage: "Hindi",
  });
  assert.equal(writes.length, 1);
  assert.equal(writes[0].type, "set");
  assert.equal(writes[0].path, "users/user_123/consultations/generated");
  assert.equal(writes[0].data.status, "active");
  assert.equal(writes[0].data.startedAtMs, now);
  assert.equal(writes[0].data.maxBillableMinutes, 5);
  assert.equal(writes[0].data.preferredLanguage, "Hindi");
});

test("startConsultSession rejects users without one minute of credits", async () => {
  const { deps, writes } = createDeps(4, 1_800_000);

  await assert.rejects(
    () =>
      startConsultSession(deps, {
        idToken: "valid-token",
        personaId: "guru-vidyanath",
      }),
    (error) =>
      error instanceof ConsultSessionError &&
      error.status === 402 &&
      error.message === "Insufficient credits to start this consultation",
  );

  assert.equal(writes.length, 0);
});

test("startConsultSession resumes an active existing session", async () => {
  const now = 1_800_000;
  const { deps, writes } = createDeps(25, now, {
    "users/user_123/consultations/session_123": {
      personaId: "guru-vidyanath",
      status: "active",
      startedAtMs: 1_700_000,
      pricePerMin: 5,
      maxBillableMinutes: 5,
      preferredLanguage: "Marathi",
    },
  });

  const result = await startConsultSession(deps, {
    idToken: "valid-token",
    personaId: "guru-vidyanath",
    existingSessionId: "session_123",
  });

  assert.deepEqual(result, {
    success: true,
    sessionId: "session_123",
    personaId: "guru-vidyanath",
    startedAt: 1_700_000,
    pricePerMin: 5,
    credits: 25,
    estimatedMinutes: 5,
    preferredLanguage: "Marathi",
  });
  assert.equal(writes.length, 0);
});

test("endConsultSession deducts credits and closes active sessions", async () => {
  const now = 1_800_000;
  const startedAt = now - 61_000;
  const { deps, writes } = createDeps(25, now, {
    "users/user_123/consultations/session_123": {
      personaId: "guru-vidyanath",
      status: "active",
      startedAtMs: startedAt,
      pricePerMin: 5,
      maxBillableMinutes: 5,
      messageCount: 3,
    },
  });

  const result = await endConsultSession(deps, {
    idToken: "valid-token",
    sessionId: "session_123",
  });

  assert.deepEqual(result, {
    success: true,
    durationSeconds: 61,
    minutes: 2,
    cost: 10,
  });
  assert.equal(writes.length, 3);
  assert.deepEqual(writes[0], {
    type: "update",
    path: "users/user_123",
    data: { credits: { op: "increment", value: -10 } },
  });
  assert.equal(writes[1].type, "set");
  assert.equal(
    writes[1].path,
    "users/user_123/creditLedger/consultation_session_123",
  );
  assert.equal(writes[1].data.type, "consultation");
  assert.equal(writes[1].data.amount, -10);
  assert.equal(writes[1].data.balanceAfter, 15);
  assert.equal(writes[2].type, "update");
  assert.equal(writes[2].path, "users/user_123/consultations/session_123");
  assert.equal(writes[2].data.status, "ended");
  assert.equal(writes[2].data.cost, 10);
  assert.equal(writes[2].data.messageCount, 3);
});

test("endConsultSession lets added credits extend the billable session window", async () => {
  const now = 1_800_000;
  const startedAt = now - 7 * 60_000;
  const { deps } = createDeps(50, now, {
    "users/user_123/consultations/session_123": {
      personaId: "guru-vidyanath",
      status: "active",
      startedAtMs: startedAt,
      pricePerMin: 5,
      maxBillableMinutes: 5,
    },
  });

  const result = await endConsultSession(deps, {
    idToken: "valid-token",
    sessionId: "session_123",
  });

  assert.equal(result.minutes, 7);
  assert.equal(result.cost, 35);
});

test("endConsultSession rejects insufficient credits without charging user", async () => {
  const now = 1_800_000;
  const startedAt = now - 61_000;
  const { deps, writes } = createDeps(5, now, {
    "users/user_123/consultations/session_123": {
      personaId: "guru-vidyanath",
      status: "active",
      startedAtMs: startedAt,
      pricePerMin: 5,
      maxBillableMinutes: 5,
    },
  });

  await assert.rejects(
    () =>
      endConsultSession(deps, {
        idToken: "valid-token",
        sessionId: "session_123",
      }),
    (error) =>
      error instanceof ConsultSessionError &&
      error.status === 402 &&
      error.message === "Insufficient credits for this consultation",
  );

  assert.equal(writes.length, 1);
  assert.equal(writes[0].type, "update");
  assert.equal(writes[0].path, "users/user_123/consultations/session_123");
  assert.equal(writes[0].data.status, "failed");
  assert.equal(writes[0].data.failureReason, "insufficient_credits");
});

test("endConsultSession rejects unknown personas before billing", async () => {
  const { deps, writes } = createDeps(100, 1_800_000, {
    "users/user_123/consultations/session_123": {
      personaId: "unknown",
      status: "active",
      startedAtMs: 1_700_000,
      pricePerMin: 5,
    },
  });

  await assert.rejects(
    () =>
      endConsultSession(deps, {
        idToken: "valid-token",
        sessionId: "session_123",
      }),
    (error) =>
      error instanceof ConsultSessionError &&
      error.status === 400 &&
      error.message === "Unknown persona",
  );

  assert.equal(writes.length, 0);
});

test("applyCreditChange writes a ledger entry and updates balance", async () => {
  const { deps, writes } = createDeps(10, 1_800_000);

  const result = await applyCreditChange(
    { db: deps.db, FieldValue: deps.FieldValue },
    {
      uid: "user_123",
      amount: 20,
      type: "purchase",
      source: "razorpay",
      referenceId: "pay_123",
      ledgerId: "razorpay_pay_123",
    },
  );

  assert.deepEqual(result, {
    balanceBefore: 10,
    balanceAfter: 30,
    duplicate: false,
  });
  assert.equal(writes.length, 2);
  assert.equal(writes[0].path, "users/user_123");
  assert.deepEqual(writes[0].data, {
    credits: { op: "increment", value: 20 },
  });
  assert.equal(writes[1].path, "users/user_123/creditLedger/razorpay_pay_123");
  assert.equal(writes[1].data.type, "purchase");
  assert.equal(writes[1].data.balanceAfter, 30);
});

test("applyCreditChange is idempotent when ledger id already exists", async () => {
  const { deps, writes } = createDeps(30, 1_800_000, {
    "users/user_123/creditLedger/razorpay_pay_123": {
      balanceBefore: 10,
      balanceAfter: 30,
    },
  });

  const result = await applyCreditChange(
    { db: deps.db, FieldValue: deps.FieldValue },
    {
      uid: "user_123",
      amount: 20,
      type: "purchase",
      source: "razorpay",
      referenceId: "pay_123",
      ledgerId: "razorpay_pay_123",
    },
  );

  assert.deepEqual(result, {
    balanceBefore: 10,
    balanceAfter: 30,
    duplicate: true,
  });
  assert.equal(writes.length, 0);
});

test("initializeUserCredits creates signup bonus ledger once", async () => {
  const { deps, writes } = createDeps(undefined, 1_800_000);

  const result = await initializeUserCredits(
    { db: deps.db, FieldValue: deps.FieldValue },
    { uid: "user_123", email: "user@example.com" },
  );

  assert.deepEqual(result, {
    balanceBefore: 0,
    balanceAfter: 15,
    duplicate: false,
  });
  assert.equal(writes.length, 2);
  assert.equal(writes[0].path, "users/user_123");
  assert.equal(writes[0].data.email, "user@example.com");
  assert.deepEqual(writes[0].data.credits, { op: "increment", value: 15 });
  assert.equal(writes[1].path, "users/user_123/creditLedger/signup_bonus");
  assert.equal(writes[1].data.type, "signup_bonus");
  assert.equal(writes[1].data.balanceAfter, 15);
});
