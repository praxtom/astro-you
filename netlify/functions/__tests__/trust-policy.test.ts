import test from "node:test";
import assert from "node:assert/strict";
import {
  TRUST_NOT_CLAIMED_YET,
  TRUST_PRINCIPLES,
  TRUST_PROCESS_ROWS,
  TRUST_SIGNALS,
} from "../../../src/lib/trust-policy.js";

test("trust policy explicitly blocks fake social proof", () => {
  const copy = [...TRUST_PRINCIPLES, ...TRUST_NOT_CLAIMED_YET].join(" ");

  assert.match(copy, /AI astrologers are labelled/i);
  assert.match(copy, /No fake review counts/i);
  assert.match(copy, /No fake consultation counts/i);
  assert.match(copy, /No fake verified badges/i);
  assert.match(copy, /No fake degrees/i);
  assert.match(copy, /No guaranteed prediction accuracy/i);
});

test("trust process rows explain source and publication rules", () => {
  assert.equal(TRUST_SIGNALS.length, 4);
  assert.equal(TRUST_PROCESS_ROWS.length >= 4, true);

  for (const row of TRUST_PROCESS_ROWS) {
    assert.equal(Boolean(row.signal), true);
    assert.equal(Boolean(row.source), true);
    assert.equal(Boolean(row.publicRule), true);
  }
});
