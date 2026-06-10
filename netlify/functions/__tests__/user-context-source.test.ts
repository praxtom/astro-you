import test from "node:test";
import assert from "node:assert/strict";
import { resolveAtmanContextSource } from "../shared/user-context-source.js";
import type { AtmanData } from "../../../src/types/user.js";

test("authenticated context uses server Atman memory over client input", () => {
  const clientAtman = { emotionalState: "chaotic" } as Partial<AtmanData>;
  const serverAtman = { emotionalState: "stable" } as Partial<AtmanData>;

  assert.equal(
    resolveAtmanContextSource({
      uid: "user_123",
      clientAtman,
      serverAtman,
    }),
    serverAtman,
  );
});

test("guest context may use client Atman memory", () => {
  const clientAtman = { emotionalState: "spiritual" } as Partial<AtmanData>;
  const serverAtman = { emotionalState: "stable" } as Partial<AtmanData>;

  assert.equal(
    resolveAtmanContextSource({
      clientAtman,
      serverAtman,
    }),
    clientAtman,
  );
});
