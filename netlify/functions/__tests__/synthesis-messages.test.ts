import test from "node:test";
import assert from "node:assert/strict";
import {
  hasVisibleStreamingContent,
  mergeSynthesisMessages,
} from "../../../src/lib/synthesis-messages.js";

const welcomeMessage = {
  id: "welcome",
  role: "assistant" as const,
  content: "Welcome.",
  timestamp: new Date("2026-06-12T09:00:00.000Z"),
};

test("keeps pending user message visible until Firestore confirms it", () => {
  const pendingUserMessage = {
    id: "pending_123",
    clientId: "client_123",
    pending: true,
    role: "user" as const,
    content: "hi",
    timestamp: new Date("2026-06-12T09:01:00.000Z"),
  };

  const merged = mergeSynthesisMessages(welcomeMessage, [], [
    pendingUserMessage,
  ]);

  assert.deepEqual(
    merged.map((message) => message.content),
    ["Welcome.", "hi"],
  );
});

test("replaces matching pending message after Firestore confirms it", () => {
  const pendingUserMessage = {
    id: "pending_123",
    clientId: "client_123",
    pending: true,
    role: "user" as const,
    content: "hi",
    timestamp: new Date("2026-06-12T09:01:00.000Z"),
  };
  const persistedUserMessage = {
    id: "firestore_123",
    clientId: "client_123",
    role: "user" as const,
    content: "hi",
    timestamp: new Date("2026-06-12T09:01:01.000Z"),
  };

  const merged = mergeSynthesisMessages(welcomeMessage, [
    persistedUserMessage,
  ], [pendingUserMessage]);

  assert.deepEqual(
    merged.map((message) => message.id),
    ["welcome", "firestore_123"],
  );
});

test("keeps pending assistant reply visible until Firestore confirms it", () => {
  const pendingAssistantMessage = {
    id: "pending_assistant_123",
    clientId: "assistant_123",
    pending: true,
    role: "assistant" as const,
    content: "Final streamed answer",
    timestamp: new Date("2026-06-12T09:02:00.000Z"),
  };

  const merged = mergeSynthesisMessages(welcomeMessage, [], [
    pendingAssistantMessage,
  ]);

  assert.deepEqual(
    merged.map((message) => message.content),
    ["Welcome.", "Final streamed answer"],
  );
});

test("treats whitespace-only streaming content as invisible", () => {
  assert.equal(hasVisibleStreamingContent(null), false);
  assert.equal(hasVisibleStreamingContent("\n\n"), false);
  assert.equal(hasVisibleStreamingContent("Final answer"), true);
});
