import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPushTokenRecord,
  createPushTokenDocId,
  validatePushTokenInput,
} from "../shared/push-tokens.js";

const NOW = new Date("2026-05-29T05:00:00.000Z");

test("buildPushTokenRecord stores a normalized active token record", () => {
  const record = buildPushTokenRecord({
    token: "a".repeat(160),
    platform: "  Mac OS Chrome  ",
    userAgent: "Mozilla/5.0 ".repeat(80),
    now: NOW,
  });

  assert.equal(record.token, "a".repeat(160));
  assert.equal(record.platform, "Mac OS Chrome");
  assert.equal(record.active, true);
  assert.equal(record.createdAt, NOW);
  assert.equal(record.updatedAt, NOW);
  assert.ok(record.userAgent);
  assert.equal(record.userAgent.length, 300);
});

test("validatePushTokenInput rejects unusable tokens", () => {
  assert.throws(
    () => validatePushTokenInput({ token: "short" }),
    /Invalid push token/,
  );
});

test("createPushTokenDocId is deterministic and hides the raw token", () => {
  const token = "b".repeat(160);
  const first = createPushTokenDocId(token);
  const second = createPushTokenDocId(token);

  assert.equal(first, second);
  assert.match(first, /^token_[a-f0-9]{32}$/);
  assert.equal(first.includes(token), false);
});
