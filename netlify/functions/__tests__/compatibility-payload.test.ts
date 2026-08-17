import test from "node:test";
import assert from "node:assert/strict";
import { normalizeMatchPayload } from "../shared/compatibility-payload.js";

const A = { dob: "1990-07-15", tob: "20:30", pob: "Austin, Texas, US" };
const B = { dob: "1992-03-02", tob: "06:10", pob: "Denver, Colorado, US" };

test("accepts the new non-gendered shape", () => {
  const out = normalizeMatchPayload({ personA: A, personB: B });
  assert.deepEqual(out.personA, A);
  assert.deepEqual(out.personB, B);
});

test("still accepts the legacy gendered shape so old clients keep working", () => {
  const out = normalizeMatchPayload({ maleData: A, femaleData: B });
  assert.deepEqual(out.personA, A);
  assert.deepEqual(out.personB, B);
});

test("prefers the new shape when both are present", () => {
  const out = normalizeMatchPayload({
    personA: A,
    personB: B,
    maleData: B,
    femaleData: A,
  });
  assert.deepEqual(out.personA, A);
  assert.deepEqual(out.personB, B);
});

test("throws when either chart is missing", () => {
  assert.throws(() => normalizeMatchPayload({ personA: A }));
  assert.throws(() => normalizeMatchPayload({ personB: B }));
  assert.throws(() => normalizeMatchPayload({}));
  assert.throws(() => normalizeMatchPayload(null));
  assert.throws(() => normalizeMatchPayload(undefined));
});

test("a mixed legacy/new pair still resolves both charts", () => {
  // A client mid-deploy could send one of each.
  const out = normalizeMatchPayload({ personA: A, femaleData: B });
  assert.deepEqual(out.personA, A);
  assert.deepEqual(out.personB, B);
});
