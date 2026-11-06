import test from "node:test";
import assert from "node:assert/strict";
import {
  applyBrainInsights,
  forgetChat,
  isValidChatId,
  persistAtmanInsights,
} from "../shared/atman-brain.js";
import {
  forgetChatInAtman,
  removeDerivedText,
  stripUndefined,
} from "../../../src/lib/memory-ops.js";
import { normalizeAtmanData } from "../../../src/lib/atman-schema.js";
import type { AtmanData } from "../../../src/types/user.js";

const T1 = new Date("2026-11-01T10:00:00.000Z");
const T2 = new Date("2026-11-02T10:00:00.000Z");

function turn(
  existing: Partial<AtmanData> | undefined,
  chatId: string,
  now: Date,
  extra: {
    pattern: string;
    event: string;
    thread: string;
    emotion: string;
    advice: string;
  },
) {
  return applyBrainInsights({
    existingAtman: existing,
    analysisResult: {
      emotionalState: extra.emotion,
      newPatterns: [extra.pattern],
      newEvents: [{ title: extra.event, category: "career", confidence: 0.9 }],
      karmicThreads: [extra.thread],
      detectedContradictions: [],
    },
    extractedAdvice: { advice: extra.advice, context: "work" },
    source: {
      surface: "synthesis",
      userMessage: `message in ${chatId}`,
      assistantMessage: "reply",
    },
    now,
    sourceChatId: chatId,
  }).atman;
}

function twoChatAtman() {
  const a = turn(undefined, "chatA", T1, {
    pattern: "Avoids hard conversations at work",
    event: "Job interview",
    thread: "Career fear mirrors father",
    emotion: "anxious",
    advice: "Breathe before the call",
  });
  return turn(a, "chatB", T2, {
    pattern: "Seeks reassurance from partner",
    event: "Moving house",
    thread: "Home echoes childhood",
    emotion: "energetic",
    advice: "Write the move plan",
  });
}

test("applyBrainInsights tags derived entries with sourceChatId", () => {
  const atman = twoChatAtman();
  assert.ok(atman.memoryLedger?.every((e) => e.sourceChatId));
  assert.equal(atman.knownPatterns[0].evidence?.[0].sourceChatId, "chatA");
  assert.equal(atman.lifeEvents?.[1].evidence?.[0].sourceChatId, "chatB");
  assert.deepEqual(
    atman.savedAdvice?.map((a) => a.sourceChatId),
    ["chatA", "chatB"],
  );
  assert.deepEqual(
    atman.emotionalHistory?.map((e) => e.sourceChatId),
    ["chatA", "chatB"],
  );
  assert.deepEqual(
    atman.derivedTextSources?.map((s) => [s.text, s.sourceChatId]),
    [
      ["Career fear mirrors father", "chatA"],
      ["Home echoes childhood", "chatB"],
    ],
  );
});

test("normalizeAtmanData keeps sourceChatId tags", () => {
  const normalized = normalizeAtmanData(
    JSON.parse(JSON.stringify(twoChatAtman())),
  )!;
  assert.equal(normalized.memoryLedger?.[0].sourceChatId, "chatA");
  assert.equal(normalized.savedAdvice?.[1].sourceChatId, "chatB");
  assert.equal(normalized.emotionalHistory?.[0].sourceChatId, "chatA");
  assert.equal(normalized.knownPatterns[1].evidence?.[0].sourceChatId, "chatB");
});

test("forgetChatInAtman removes only the forgotten chat's memories", () => {
  const { atman, changed, removed } = forgetChatInAtman(
    twoChatAtman(),
    "chatB",
  );
  assert.equal(changed, true);
  assert.deepEqual(
    atman.knownPatterns.map((p) => p.pattern),
    ["Avoids hard conversations at work"],
  );
  assert.deepEqual(
    atman.lifeEvents?.map((e) => e.title),
    ["Job interview"],
  );
  assert.deepEqual(
    atman.activeEvents.map((e) => e.title),
    ["Job interview"],
  );
  assert.deepEqual(
    atman.savedAdvice?.map((a) => a.advice),
    ["Breathe before the call"],
  );
  assert.deepEqual(atman.karmicThreads, ["Career fear mirrors father"]);
  assert.ok(atman.memoryLedger?.every((e) => e.sourceChatId === "chatA"));
  // Current mood came from chatB, so it falls back to chatA's.
  assert.equal(removed.emotionalStateReset, true);
  assert.equal(atman.emotionalState, "anxious");
  assert.equal(atman.memory?.knownPatterns.length, 1);
});

test("forgetChatInAtman drops mood entirely when only that chat set it", () => {
  const single = turn(undefined, "chatA", T1, {
    pattern: "Overthinks decisions",
    event: "Promotion review",
    thread: "Worth tied to work",
    emotion: "anxious",
    advice: "Pause before deciding",
  });
  const { atman } = forgetChatInAtman(single, "chatA");
  assert.equal(atman.emotionalState, undefined);
  assert.equal(atman.transient, undefined);
  assert.deepEqual(atman.emotionalHistory, []);
  assert.deepEqual(atman.knownPatterns, []);
});

test("patterns seen in another chat survive with that chat's evidence stripped", () => {
  const a = turn(undefined, "chatA", T1, {
    pattern: "Overthinks decisions",
    event: "Event A",
    thread: "Thread A",
    emotion: "anxious",
    advice: "Advice A",
  });
  const b = turn(a, "chatB", T2, {
    pattern: "Overthinks decisions",
    event: "Event B",
    thread: "Thread A",
    emotion: "stable",
    advice: "Advice B",
  });
  const { atman } = forgetChatInAtman(b, "chatB");
  assert.equal(atman.knownPatterns.length, 1);
  assert.equal(atman.knownPatterns[0].frequency, 1);
  assert.deepEqual(
    atman.knownPatterns[0].evidence?.map((e) => e.sourceChatId),
    ["chatA"],
  );
  // Thread A was introduced by chatA, so it stays.
  assert.deepEqual(atman.karmicThreads, ["Thread A"]);
});

test("removeDerivedText removes a thread and its source tag", () => {
  const next = removeDerivedText(
    twoChatAtman(),
    "karmicThreads",
    "home echoes  childhood",
  );
  assert.deepEqual(next.karmicThreads, ["Career fear mirrors father"]);
  assert.equal(next.derivedTextSources?.length, 1);
});

test("stripUndefined removes undefined deeply but keeps Dates", () => {
  const out = stripUndefined({
    a: undefined,
    b: [1, undefined, { c: undefined, d: T1 }],
  });
  assert.deepEqual(out, { b: [1, { d: T1 }] });
  assert.ok((out.b[1] as { d: Date }).d instanceof Date);
});

function mockDb(initial: {
  user?: Record<string, unknown>;
  chats?: Record<string, Record<string, unknown>>;
}) {
  const state = {
    user: initial.user,
    chats: { ...(initial.chats || {}) } as Record<
      string,
      Record<string, unknown> | undefined
    >,
    userUpdates: [] as Record<string, unknown>[],
    userSets: [] as Record<string, unknown>[],
  };
  const DELETE = Symbol("delete");
  const chatRef = (id: string): any => ({
    async get() {
      const data = state.chats[id];
      return { exists: Boolean(data), data: () => data };
    },
    async update(patch: Record<string, unknown>) {
      const next = { ...(state.chats[id] || {}) };
      for (const [k, v] of Object.entries(patch)) {
        if (v === DELETE) delete next[k];
        else next[k] = v;
      }
      state.chats[id] = next;
    },
    collection() {
      throw new Error("not used");
    },
  });
  const userRef: any = {
    async get() {
      return { exists: Boolean(state.user), data: () => state.user };
    },
    async update(patch: Record<string, unknown>) {
      state.userUpdates.push(patch);
      state.user = { ...state.user, ...patch };
    },
    async set(data: Record<string, unknown>) {
      state.userSets.push(data);
    },
    collection: () => ({ doc: chatRef }),
  };
  const db = { collection: () => ({ doc: () => userRef }) };
  return { db, state, deleteField: () => DELETE };
}

test("forgetChat rewrites atman and deletes the chat summary", async () => {
  const { db, state, deleteField } = mockDb({
    user: { atman: twoChatAtman() },
    chats: { chatB: { title: "Moving", summary: "Talked about moving" } },
  });
  const result = await forgetChat({ db, deleteField }, "uid1", "chatB");
  assert.equal(result.atmanChanged, true);
  assert.equal(result.summaryRemoved, true);
  assert.equal(state.chats.chatB?.summary, undefined);
  assert.equal(state.chats.chatB?.title, "Moving");
  const written = state.userUpdates[0].atman as AtmanData;
  assert.deepEqual(written.karmicThreads, ["Career fear mirrors father"]);
  // No undefined values reach Firestore.
  assert.equal(JSON.stringify(written).includes("undefined"), false);
});

test("forgetChat tolerates an already-deleted chat and rejects bad ids", async () => {
  const { db, deleteField } = mockDb({ user: { atman: twoChatAtman() } });
  const result = await forgetChat({ db, deleteField }, "uid1", "chatA");
  assert.equal(result.summaryRemoved, false);
  assert.equal(result.removed.patterns, 1);
  assert.equal(isValidChatId("../users/x"), false);
  await assert.rejects(forgetChat({ db, deleteField }, "uid1", "a/b"));
});

test("persistAtmanInsights skips writes while memory is paused", async () => {
  const { db, state } = mockDb({
    user: { memoryPaused: true, atman: twoChatAtman() },
  });
  const result = await persistAtmanInsights(
    { db: db as any },
    {
      uid: "uid1",
      analysisResult: { newPatterns: ["Something new"] },
      source: { surface: "synthesis", userMessage: "hi" },
    },
    { chatId: "chatC" },
  );
  assert.equal(result.persisted, false);
  assert.equal(result.paused, true);
  assert.equal(state.userSets.length, 0);
});

test("persistAtmanInsights tags entries with meta.chatId", async () => {
  const { db, state } = mockDb({ user: { atman: undefined } });
  state.user = {};
  const result = await persistAtmanInsights(
    { db: db as any },
    {
      uid: "uid1",
      analysisResult: { newPatterns: ["Something new"] },
      source: { surface: "synthesis", userMessage: "hi" },
    },
    { chatId: "chatC" },
  );
  assert.equal(result.persisted, true);
  assert.equal(result.ledgerEntry?.sourceChatId, "chatC");
  const atman = state.userSets[0].atman as AtmanData;
  assert.equal(atman.knownPatterns[0].evidence?.[0].sourceChatId, "chatC");
});
