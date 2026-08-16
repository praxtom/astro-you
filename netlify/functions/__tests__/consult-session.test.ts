import test from "node:test";
import assert from "node:assert/strict";
import {
  computeBillableCapMinutes,
  ConsultSessionError,
  endConsultSession,
  finalizeConsultSession,
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
  userExtra: Record<string, unknown> = {},
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
                data: () =>
                  credits === undefined
                    ? { ...userExtra }
                    : { credits, ...userExtra },
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
  // Session doc + the single-active pointer on the user doc.
  assert.equal(writes.length, 2);
  assert.equal(writes[0].type, "set");
  assert.equal(writes[0].path, "users/user_123/consultations/generated");
  assert.equal(writes[0].data.status, "active");
  assert.equal(writes[0].data.startedAtMs, now);
  assert.equal(writes[0].data.maxBillableMinutes, 5);
  assert.equal(writes[0].data.preferredLanguage, "Hindi");
  assert.equal(writes[1].type, "set");
  assert.equal(writes[1].path, "users/user_123");
  assert.equal(writes[1].data.activeConsultSessionId, "generated");
});

test("startConsultSession rejects a second concurrent session for another persona", async () => {
  const now = 1_800_000;
  // The user already has a live session (pointer set) for a different persona.
  const { deps, writes } = createDeps(
    200,
    now,
    {
      "users/user_123/consultations/live_session": {
        personaId: "acharya-priya",
        status: "active",
        startedAtMs: 1_700_000,
        pricePerMin: 5,
      },
    },
    { activeConsultSessionId: "live_session" },
  );

  await assert.rejects(
    () =>
      startConsultSession(deps, {
        idToken: "valid-token",
        personaId: "guru-vidyanath",
      }),
    (error) =>
      error instanceof ConsultSessionError &&
      error.status === 409 &&
      // The client needs to know WHICH session is blocking so it can offer to
      // resume or end it instead of dead-ending the user.
      error.details?.code === "active_session" &&
      error.details?.activeSessionId === "live_session" &&
      error.details?.activePersonaId === "acharya-priya",
  );

  assert.equal(writes.length, 0);
});

test("startConsultSession ignores a stale existingSessionId while the pointer session is live", async () => {
  const now = 1_800_000;
  // Regression: a client-supplied ENDED session id must not beat the pointer —
  // falling through on it would open a second live meter next to the active
  // session (the parallel-billing abuse).
  const { deps, writes } = createDeps(
    200,
    now,
    {
      "users/user_123/consultations/live_session": {
        personaId: "acharya-priya",
        status: "active",
        startedAtMs: 1_700_000,
        pricePerMin: 5,
      },
      "users/user_123/consultations/old_ended": {
        personaId: "guru-vidyanath",
        status: "ended",
        startedAtMs: 1_500_000,
        pricePerMin: 5,
      },
    },
    { activeConsultSessionId: "live_session" },
  );

  await assert.rejects(
    () =>
      startConsultSession(deps, {
        idToken: "valid-token",
        personaId: "guru-vidyanath",
        existingSessionId: "old_ended",
      }),
    (error) => error instanceof ConsultSessionError && error.status === 409,
  );

  // No new session, no pointer overwrite.
  assert.equal(writes.length, 0);
});

test("startConsultSession resumes the live session when the pointer matches", async () => {
  const now = 1_800_000;
  // No explicit existingSessionId — resume is driven purely by the pointer.
  const { deps, writes } = createDeps(
    25,
    now,
    {
      "users/user_123/consultations/live_session": {
        personaId: "guru-vidyanath",
        status: "active",
        startedAtMs: 1_700_000,
        pricePerMin: 5,
        maxBillableMinutes: 5,
        preferredLanguage: "Hindi",
      },
    },
    { activeConsultSessionId: "live_session" },
  );

  const result = await startConsultSession(deps, {
    idToken: "valid-token",
    personaId: "guru-vidyanath",
  });

  assert.equal(result.sessionId, "live_session");
  assert.equal(result.startedAt, 1_700_000);
  // Resuming the already-live session writes nothing.
  assert.equal(writes.length, 0);
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

test("finalizeConsultSession bills an abandoned session by uid without a token", async () => {
  const now = 1_800_000;
  const startedAt = now - 61_000;
  const { deps, writes } = createDeps(25, now, {
    "users/user_123/consultations/session_123": {
      personaId: "guru-vidyanath",
      status: "active",
      startedAtMs: startedAt,
      pricePerMin: 5,
      maxBillableMinutes: 5,
      messageCount: 4,
    },
  });

  const result = await finalizeConsultSession(deps, {
    uid: "user_123",
    sessionId: "session_123",
    reason: "auto_timeout",
  });

  assert.deepEqual(result, {
    success: true,
    durationSeconds: 61,
    minutes: 2,
    cost: 10,
  });
  assert.equal(writes.length, 3);
  assert.equal(writes[2].path, "users/user_123/consultations/session_123");
  assert.equal(writes[2].data.status, "ended");
  assert.equal(writes[2].data.endReason, "auto_timeout");
  assert.equal(writes[2].data.messageCount, 4);
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

test("endConsultSession partial-bills the remaining balance when credits no longer cover the cost", async () => {
  const now = 1_800_000;
  const startedAt = now - 61_000; // 2 billable minutes at 5/min → metered cost 10
  const { deps, writes } = createDeps(5, now, {
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

  // Charged the wallet's remaining 5 (never the full 10, never free, never negative).
  assert.equal(result.cost, 5);
  assert.equal(result.minutes, 2);

  const closeWrite = writes.find(
    (w) => w.path === "users/user_123/consultations/session_123",
  );
  assert.ok(closeWrite);
  assert.equal(closeWrite.data.status, "ended");
  assert.equal(closeWrite.data.cost, 5);
  assert.equal(closeWrite.data.underbilled, true);
  assert.equal(closeWrite.data.meteredCost, 10);
});

test("computeBillableCapMinutes lifts the cap when credits are topped up mid-session", () => {
  // Started with 10 credits at 5/min → cap 2. After a top-up to 20 the live
  // wallet funds 4 minutes, so the cap must grow rather than stay frozen.
  assert.equal(
    computeBillableCapMinutes({ maxBillableMinutes: 2, pricePerMin: 5 }, 20, 5),
    4,
  );
  // Spending credits elsewhere never shrinks the cap reserved at start.
  assert.equal(
    computeBillableCapMinutes({ maxBillableMinutes: 2, pricePerMin: 5 }, 0, 5),
    2,
  );
  // Falls back to the persona price when the session has none recorded.
  assert.equal(computeBillableCapMinutes({}, 20, 5), 4);
  // No funded minutes at all → no cap value to apply.
  assert.equal(computeBillableCapMinutes({}, 4, 5), undefined);
  // Junk values do not produce NaN/Infinity caps.
  assert.equal(
    computeBillableCapMinutes(
      { maxBillableMinutes: "5", pricePerMin: 0 },
      20,
      5,
    ),
    4,
  );
});

test("endConsultSession bills the topped-up minutes past the start cap", async () => {
  const now = 1_800_000;
  const startedAt = now - 4 * 60_000; // 4 elapsed minutes
  // Start cap was 2 minutes (10 credits at 5/min); the user topped up to 20.
  const { deps } = createDeps(20, now, {
    "users/user_123/consultations/session_123": {
      personaId: "guru-vidyanath",
      status: "active",
      startedAtMs: startedAt,
      pricePerMin: 5,
      maxBillableMinutes: 2,
      messageCount: 3,
    },
  });

  const result = await endConsultSession(deps, {
    idToken: "valid-token",
    sessionId: "session_123",
  });

  assert.equal(result.minutes, 4);
  assert.equal(result.cost, 20);
});

test("finalizeConsultSession waives the minimum for a session with zero messages", async () => {
  const now = 1_800_000;
  const startedAt = now - 61_000; // would otherwise bill 2 minutes at 5/min
  const { deps, writes } = createDeps(
    25,
    now,
    {
      "users/user_123/consultations/session_123": {
        personaId: "guru-vidyanath",
        status: "active",
        startedAtMs: startedAt,
        pricePerMin: 5,
        maxBillableMinutes: 5,
        messageCount: 0,
      },
    },
    { activeConsultSessionId: "session_123" },
  );

  const result = await finalizeConsultSession(deps, {
    uid: "user_123",
    sessionId: "session_123",
    reason: "auto_timeout",
  });

  assert.deepEqual(result, {
    success: true,
    durationSeconds: 61,
    minutes: 0,
    cost: 0,
  });

  // No credit deduction and no ledger entry — just the close and the lock release.
  const closeWrite = writes.find(
    (w) => w.path === "users/user_123/consultations/session_123",
  );
  assert.ok(closeWrite);
  assert.equal(closeWrite.data.status, "ended");
  assert.equal(closeWrite.data.cost, 0);
  assert.equal(closeWrite.data.minutes, 0);
  // Not flagged as underbilled — nothing was owed.
  assert.equal(closeWrite.data.underbilled, undefined);
  assert.equal(
    writes.some((w) => (w.path || "").includes("creditLedger")),
    false,
  );
  // The single-active-session lock is still released so the user is not stuck.
  const lockRelease = writes.find(
    (w) =>
      w.path === "users/user_123" && w.data.activeConsultSessionId === null,
  );
  assert.ok(lockRelease, "expected the active-session lock to be released");
});

test("finalizeConsultSession still bills a session that had messages", async () => {
  const now = 1_800_000;
  const startedAt = now - 61_000;
  const { deps } = createDeps(25, now, {
    "users/user_123/consultations/session_123": {
      personaId: "guru-vidyanath",
      status: "active",
      startedAtMs: startedAt,
      pricePerMin: 5,
      maxBillableMinutes: 5,
      messageCount: 1,
    },
  });

  const result = await finalizeConsultSession(deps, {
    uid: "user_123",
    sessionId: "session_123",
  });

  assert.equal(result.minutes, 2);
  assert.equal(result.cost, 10);
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
