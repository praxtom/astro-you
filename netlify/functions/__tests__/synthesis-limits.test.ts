import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_SYNTHESIS_MESSAGE_CHARS,
  MAX_SYNTHESIS_MESSAGES,
  isWithinSynthesisInputLimits,
} from "../shared/synthesis-limits.js";

const message = (content: string) => ({ role: "user" as const, content });

test("limit constants are the documented values", () => {
  assert.equal(MAX_SYNTHESIS_MESSAGE_CHARS, 8000);
  assert.equal(MAX_SYNTHESIS_MESSAGES, 60);
});

test("non-array input passes (shape is validated elsewhere)", () => {
  assert.equal(isWithinSynthesisInputLimits(undefined), true);
  assert.equal(isWithinSynthesisInputLimits(null), true);
  assert.equal(isWithinSynthesisInputLimits("not an array"), true);
  assert.equal(isWithinSynthesisInputLimits({ messages: [] }), true);
});

test("more than the maximum number of messages fails", () => {
  const tooMany = Array.from({ length: MAX_SYNTHESIS_MESSAGES + 1 }, () =>
    message("hi"),
  );
  assert.equal(isWithinSynthesisInputLimits(tooMany), false);
});

test("a single over-long message fails", () => {
  const huge = [message("a".repeat(MAX_SYNTHESIS_MESSAGE_CHARS + 1))];
  assert.equal(isWithinSynthesisInputLimits(huge), false);
});

test("boundary values pass", () => {
  const exactCount = Array.from({ length: MAX_SYNTHESIS_MESSAGES }, () =>
    message("a".repeat(MAX_SYNTHESIS_MESSAGE_CHARS)),
  );
  assert.equal(isWithinSynthesisInputLimits(exactCount), true);
  assert.equal(isWithinSynthesisInputLimits([]), true);
});

test("entries without string content are ignored by the length check", () => {
  assert.equal(
    isWithinSynthesisInputLimits([{ role: "user" }, null, undefined, 42]),
    true,
  );
});
