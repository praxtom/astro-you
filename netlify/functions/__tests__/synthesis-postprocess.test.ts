import test from "node:test";
import assert from "node:assert/strict";
import {
  finishSynthesisTurn,
  runSynthesisPostprocess,
  shouldSummarizeTurn,
  type SynthesisPostprocessDeps,
  type SynthesisPostprocessJob,
} from "../shared/synthesis-postprocess.js";
import {
  deleteInteractions,
  interactionLogDocId,
  normalizeInteractionIds,
  readAllInteractionIds,
  readChatInteractionIds,
  recordInteractionId,
  UNASSIGNED_LOG_ID,
  type RetentionDb,
} from "../shared/interaction-retention.js";
import {
  dispatchBackgroundJob,
  INTERNAL_AUTH_HEADER,
  isAuthorizedInternalRequest,
  resolveInternalOrigin,
  resolveInternalSecret,
} from "../shared/internal-dispatch.js";

// ---------------------------------------------------------------------------
// done-before-postprocessing ordering
// ---------------------------------------------------------------------------

test("finishSynthesisTurn flushes done and closes before post-processing (waitUntil)", async () => {
  const order: string[] = [];
  let pending: Promise<unknown> | undefined;
  await finishSynthesisTurn({
    sendDone: () => order.push("done"),
    close: () => order.push("close"),
    afterResponse: async () => {
      order.push("after:start");
      await new Promise((r) => setTimeout(r, 5));
      order.push("after:end");
    },
    waitUntil: (p) => {
      pending = p;
    },
  });
  // The caller is released with the stream already closed.
  assert.deepEqual(order.slice(0, 2), ["done", "close"]);
  await pending;
  assert.deepEqual(order, ["done", "close", "after:start", "after:end"]);
});

test("finishSynthesisTurn without waitUntil still sends done first, closes last", async () => {
  const order: string[] = [];
  await finishSynthesisTurn({
    sendDone: () => order.push("done"),
    close: () => order.push("close"),
    afterResponse: async () => {
      order.push("after");
    },
  });
  assert.deepEqual(order, ["done", "after", "close"]);
});

test("finishSynthesisTurn swallows post-processing failures", async () => {
  const order: string[] = [];
  await finishSynthesisTurn({
    sendDone: () => order.push("done"),
    close: () => order.push("close"),
    afterResponse: async () => {
      throw new Error("boom");
    },
  });
  assert.deepEqual(order, ["done", "close"]);
});

// ---------------------------------------------------------------------------
// summary cadence + post-processing orchestration
// ---------------------------------------------------------------------------

test("summaries run on the 2nd user turn and then every 4th", () => {
  // messageCount = visible messages before this turn (both roles).
  assert.equal(shouldSummarizeTurn(0), false); // turn 1
  assert.equal(shouldSummarizeTurn(2), true); // turn 2
  assert.equal(shouldSummarizeTurn(4), false);
  assert.equal(shouldSummarizeTurn(6), false);
  assert.equal(shouldSummarizeTurn(8), false);
  assert.equal(shouldSummarizeTurn(10), true); // turn 6
  assert.equal(shouldSummarizeTurn(18), true); // turn 10
  assert.equal(shouldSummarizeTurn(undefined), false);
  assert.equal(shouldSummarizeTurn("nope"), false);
});

function job(
  overrides: Partial<SynthesisPostprocessJob> = {},
): SynthesisPostprocessJob {
  return {
    uid: "u1",
    chatId: "chatA",
    interactionId: "int_1",
    userMessage: "Will I change jobs?",
    assistantMessage: "Saturn suggests patience…",
    analysisMessages: [{ role: "user", content: "Will I change jobs?" }],
    summaryMessages: [
      { role: "user", content: "Will I change jobs?" },
      { role: "assistant", content: "Saturn suggests patience…" },
    ],
    context: { name: "Asha" },
    ...overrides,
  };
}

function fakeDeps(overrides: Partial<SynthesisPostprocessDeps> = {}) {
  const calls: Record<string, any[]> = {};
  const record = (name: string, value: any) => {
    (calls[name] ||= []).push(value);
  };
  const deps: SynthesisPostprocessDeps = {
    isMemoryPaused: async () => false,
    analyze: async (m) => {
      record("analyze", m);
      return { emotionalState: "stable", newEvents: [], newPatterns: ["p"] };
    },
    extractAdvice: async () => {
      record("advice", true);
      return { advice: "Journal nightly", context: "career" };
    },
    persistInsights: async (input) => {
      record("persist", input);
      return { persisted: true, changed: true };
    },
    readChatSummary: async () => "Earlier note",
    summarize: async (m, name, previous) => {
      record("summarize", { m, name, previous });
      return "New diary note";
    },
    writeChatSummary: async (uid, chatId, summary) => {
      record("writeSummary", { uid, chatId, summary });
    },
    ...overrides,
  };
  return { deps, calls };
}

test("post-processing persists insights tagged with the chat and writes the summary server-side", async () => {
  const { deps, calls } = fakeDeps();
  const result = await runSynthesisPostprocess(job(), deps);
  assert.equal(result.brainUpdated, true);
  assert.equal(result.summaryWritten, true);
  assert.equal(calls.persist[0].chatId, "chatA");
  assert.equal(calls.persist[0].interactionId, "int_1");
  assert.deepEqual(calls.writeSummary[0], {
    uid: "u1",
    chatId: "chatA",
    summary: "New diary note",
  });
  // The previous summary is folded into the new one.
  assert.equal(calls.summarize[0].previous, "Earlier note");
});

test("post-processing writes nothing when memory is paused (or the check fails)", async () => {
  for (const isMemoryPaused of [
    async () => true,
    async () => {
      throw new Error("firestore down");
    },
  ]) {
    const { deps, calls } = fakeDeps({ isMemoryPaused });
    const result = await runSynthesisPostprocess(job(), deps);
    assert.equal(result.skipped, "memory_paused");
    assert.equal(calls.analyze, undefined);
    assert.equal(calls.persist, undefined);
    assert.equal(calls.writeSummary, undefined);
  }
});

test("no summary call on turns that are not due", async () => {
  const { deps, calls } = fakeDeps();
  const result = await runSynthesisPostprocess(
    job({ summaryMessages: undefined }),
    deps,
  );
  assert.equal(result.summaryWritten, false);
  assert.equal(calls.summarize, undefined);
  assert.equal(calls.persist.length, 1);
});

test("a failing side call does not stop persistence", async () => {
  const { deps, calls } = fakeDeps({
    analyze: async () => {
      throw new Error("timeout");
    },
  });
  const result = await runSynthesisPostprocess(job(), deps);
  assert.equal(calls.persist[0].analysisResult, null);
  assert.equal(calls.persist[0].extractedAdvice.advice, "Journal nightly");
  assert.equal(result.brainUpdated, true);
});

// ---------------------------------------------------------------------------
// Gemini interaction retention
// ---------------------------------------------------------------------------

test("interaction ids are validated, deduped and capped", () => {
  assert.deepEqual(
    normalizeInteractionIds(["a1", "a1", "", "bad id", 5, "v1_Ab-c.d:e", null]),
    ["a1", "v1_Ab-c.d:e"],
  );
  assert.equal(normalizeInteractionIds(["a", "b", "c"], 2).length, 2);
  assert.deepEqual(normalizeInteractionIds("not-an-array"), []);
  assert.equal(interactionLogDocId("chat_1"), "chat_1");
  assert.equal(interactionLogDocId(undefined), UNASSIGNED_LOG_ID);
  assert.equal(interactionLogDocId("../x"), UNASSIGNED_LOG_ID);
});

test("deleteInteractions deletes each id once, treats 404 as deleted, never throws", async () => {
  const seen: string[] = [];
  const result = await deleteInteractions(
    ["a", "b", "c", "a", "nope id"],
    async (id) => {
      seen.push(id);
      if (id === "b") throw Object.assign(new Error("gone"), { status: 404 });
      if (id === "c") throw Object.assign(new Error("server"), { status: 500 });
    },
  );
  assert.deepEqual(seen.sort(), ["a", "b", "c"]);
  assert.deepEqual(result, { deleted: 2, failed: 1, skipped: 0 });
});

test("deleteInteractions stops at its time budget", async () => {
  let clock = 0;
  const result = await deleteInteractions(
    ["a", "b", "c", "d"],
    async () => {
      clock += 10;
    },
    { concurrency: 1, budgetMs: 15, now: () => clock },
  );
  assert.equal(result.deleted + result.skipped, 4);
  assert.ok(result.skipped >= 1);
});

function fakeRetentionDb() {
  const docs = new Map<string, Record<string, any>>();
  const db: RetentionDb = {
    collection: () => ({
      doc: (uid: string) => ({
        collection: () => ({
          doc: (id: string) => ({
            async get() {
              const data = docs.get(`${uid}/${id}`);
              return { exists: Boolean(data), data: () => data };
            },
            async set(data: Record<string, any>) {
              const key = `${uid}/${id}`;
              const prev = docs.get(key) || { ids: [] };
              const added = (data.ids as { add: string[] }).add;
              docs.set(key, {
                ...prev,
                ids: [...new Set([...prev.ids, ...added])],
              });
            },
            async delete() {
              docs.delete(`${uid}/${id}`);
            },
          }),
          async get() {
            return {
              docs: [...docs.entries()]
                .filter(([k]) => k.startsWith(`${uid}/`))
                .map(([k, v]) => ({ id: k.split("/")[1], data: () => v })),
            };
          },
        }),
      }),
    }),
  };
  return { db, docs };
}

test("interaction ids are logged per chat and read back for purging", async () => {
  const { db } = fakeRetentionDb();
  const deps = { db, arrayUnion: (...ids: string[]) => ({ add: ids }) };
  await recordInteractionId(deps, "u1", "chatA", "int_1");
  await recordInteractionId(deps, "u1", "chatA", "int_2");
  await recordInteractionId(deps, "u1", "chatB", "int_3");
  await recordInteractionId(deps, "u1", undefined, "int_4");
  await recordInteractionId(deps, "u1", "chatA", "bad id"); // ignored
  assert.deepEqual(await readChatInteractionIds(db, "u1", "chatA"), [
    "int_1",
    "int_2",
  ]);
  assert.deepEqual((await readAllInteractionIds(db, "u1")).sort(), [
    "int_1",
    "int_2",
    "int_3",
    "int_4",
  ]);
});

// ---------------------------------------------------------------------------
// internal background dispatch
// ---------------------------------------------------------------------------

const STRONG = "x".repeat(40);

test("internal secret: explicit, derived from OTP_HASH_SECRET, or absent", () => {
  assert.equal(
    resolveInternalSecret({ INTERNAL_FUNCTION_SECRET: STRONG }),
    STRONG,
  );
  const derived = resolveInternalSecret({ OTP_HASH_SECRET: STRONG });
  assert.ok(derived && derived !== STRONG && derived.length === 64);
  assert.equal(resolveInternalSecret({ OTP_HASH_SECRET: "short" }), undefined);
  assert.equal(resolveInternalSecret({}), undefined);
});

test("background functions reject requests without the internal secret", () => {
  const env = { INTERNAL_FUNCTION_SECRET: STRONG };
  const ok = new Request("https://x/.netlify/functions/a-background", {
    method: "POST",
    headers: { [INTERNAL_AUTH_HEADER]: STRONG },
  });
  const bad = new Request("https://x/.netlify/functions/a-background", {
    method: "POST",
    headers: { [INTERNAL_AUTH_HEADER]: "y".repeat(40) },
  });
  const none = new Request("https://x/.netlify/functions/a-background", {
    method: "POST",
  });
  assert.equal(isAuthorizedInternalRequest(ok, env), true);
  assert.equal(isAuthorizedInternalRequest(bad, env), false);
  assert.equal(isAuthorizedInternalRequest(none, env), false);
  assert.equal(isAuthorizedInternalRequest(ok, {}), false);
});

test("internal origin never trusts a non-local request Host", () => {
  assert.equal(
    resolveInternalOrigin(
      { DEPLOY_URL: "https://abc--site.netlify.app/" },
      "https://evil.example/api",
    ),
    "https://abc--site.netlify.app",
  );
  assert.equal(
    resolveInternalOrigin({}, "https://evil.example/api"),
    undefined,
  );
  assert.equal(
    resolveInternalOrigin({}, "http://localhost:8888/api/synthesis"),
    "http://localhost:8888",
  );
});

test("dispatchBackgroundJob posts with the secret and reports acceptance", async () => {
  const env = { INTERNAL_FUNCTION_SECRET: STRONG, URL: "https://site.example" };
  const requests: Array<{ url: string; init: RequestInit }> = [];
  const accepted = await dispatchBackgroundJob(
    "synthesis-postprocess-background",
    { a: 1 },
    {
      env,
      fetchImpl: (async (url: string, init: RequestInit) => {
        requests.push({ url, init });
        return new Response(null, { status: 202 });
      }) as unknown as typeof fetch,
    },
  );
  assert.equal(accepted, true);
  assert.equal(
    requests[0].url,
    "https://site.example/.netlify/functions/synthesis-postprocess-background",
  );
  assert.equal(
    (requests[0].init.headers as Record<string, string>)[INTERNAL_AUTH_HEADER],
    STRONG,
  );

  // No secret → caller falls back to inline work.
  assert.equal(
    await dispatchBackgroundJob("x-background", {}, { env: {} }),
    false,
  );
  // Network failure → false, never throws.
  assert.equal(
    await dispatchBackgroundJob(
      "x-background",
      {},
      {
        env,
        fetchImpl: (async () => {
          throw new Error("down");
        }) as unknown as typeof fetch,
      },
    ),
    false,
  );
});
