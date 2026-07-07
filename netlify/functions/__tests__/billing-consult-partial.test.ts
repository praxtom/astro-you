import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateConsultCharge,
  finalizeConsultSession,
  type ConsultSessionDeps,
} from "../shared/consult-session.js";

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
      async verifyIdToken() {
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

test("calculateConsultCharge caps the charge at the wallet balance", () => {
  assert.deepEqual(calculateConsultCharge(10, 25), {
    charge: 10,
    underbilled: false,
  });
  assert.deepEqual(calculateConsultCharge(10, 5), {
    charge: 5,
    underbilled: true,
  });
  assert.deepEqual(calculateConsultCharge(10, 0), {
    charge: 0,
    underbilled: true,
  });
  // Never negative — a corrupted negative balance charges nothing.
  assert.deepEqual(calculateConsultCharge(10, -3), {
    charge: 0,
    underbilled: true,
  });
  // Fractional balances floor so we never overdraw by rounding up.
  assert.deepEqual(calculateConsultCharge(10, 7.9), {
    charge: 7,
    underbilled: true,
  });
});

test("finalize charges the remaining balance when credits no longer cover the cost", async () => {
  const now = 1_800_000;
  const startedAt = now - 61_000; // 2 billable minutes at 5/min → cost 10
  const { deps, writes } = createDeps(5, now, {
    "users/user_123/consultations/session_123": {
      personaId: "guru-vidyanath",
      status: "active",
      startedAtMs: startedAt,
      pricePerMin: 5,
      maxBillableMinutes: 5,
      messageCount: 3,
    },
  });

  const result = await finalizeConsultSession(deps, {
    uid: "user_123",
    sessionId: "session_123",
    reason: "client_end",
  });

  assert.deepEqual(result, {
    success: true,
    durationSeconds: 61,
    minutes: 2,
    cost: 5,
  });

  assert.equal(writes.length, 3);
  // Deducts exactly the remaining balance — never negative.
  assert.deepEqual(writes[0], {
    type: "update",
    path: "users/user_123",
    data: { credits: { op: "increment", value: -5 } },
  });
  // Keeps the idempotent per-session ledger id.
  assert.equal(
    writes[1].path,
    "users/user_123/creditLedger/consultation_session_123",
  );
  assert.equal(writes[1].data.amount, -5);
  assert.equal(writes[1].data.balanceAfter, 0);
  const ledgerMetadata = writes[1].data.metadata as Record<string, unknown>;
  assert.equal(ledgerMetadata.underbilled, true);
  assert.equal(ledgerMetadata.meteredCost, 10);
  // Session ends (not "failed") with the actual amount charged flagged.
  assert.equal(writes[2].path, "users/user_123/consultations/session_123");
  assert.equal(writes[2].data.status, "ended");
  assert.equal(writes[2].data.cost, 5);
  assert.equal(writes[2].data.underbilled, true);
  assert.equal(writes[2].data.meteredCost, 10);
});

test("finalize with a fully drained wallet ends the session without a ledger write", async () => {
  const now = 1_800_000;
  const startedAt = now - 61_000;
  const { deps, writes } = createDeps(0, now, {
    "users/user_123/consultations/session_123": {
      personaId: "guru-vidyanath",
      status: "active",
      startedAtMs: startedAt,
      pricePerMin: 5,
      maxBillableMinutes: 5,
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
    cost: 0,
  });

  // No credit/ledger writes for a zero charge — only the session close.
  assert.equal(writes.length, 1);
  assert.equal(writes[0].type, "update");
  assert.equal(writes[0].path, "users/user_123/consultations/session_123");
  assert.equal(writes[0].data.status, "ended");
  assert.equal(writes[0].data.cost, 0);
  assert.equal(writes[0].data.underbilled, true);
  assert.equal(writes[0].data.meteredCost, 10);
});

test("finalize with sufficient balance bills the full metered cost unchanged", async () => {
  const now = 1_800_000;
  const startedAt = now - 61_000;
  const { deps, writes } = createDeps(25, now, {
    "users/user_123/consultations/session_123": {
      personaId: "guru-vidyanath",
      status: "active",
      startedAtMs: startedAt,
      pricePerMin: 5,
      maxBillableMinutes: 5,
    },
  });

  const result = await finalizeConsultSession(deps, {
    uid: "user_123",
    sessionId: "session_123",
  });

  assert.deepEqual(result, {
    success: true,
    durationSeconds: 61,
    minutes: 2,
    cost: 10,
  });
  assert.equal(writes.length, 3);
  assert.deepEqual(writes[0].data, {
    credits: { op: "increment", value: -10 },
  });
  assert.equal(writes[2].data.cost, 10);
  assert.equal(writes[2].data.underbilled, undefined);
  assert.equal(writes[2].data.meteredCost, undefined);
});
