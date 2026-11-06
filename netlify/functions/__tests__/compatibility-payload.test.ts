import test from "node:test";
import assert from "node:assert/strict";
import {
  attachPairManglik,
  normalizeMatchPayload,
  orientVedicPair,
  readMatchGender,
} from "../shared/compatibility-payload.js";

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

// ─── Guna Milan groom/bride orientation (#11) ───────────────────────────────

const male = { ...A, gender: "male" };
const female = { ...B, gender: "female" };

test("male A + female B: A is the groom", () => {
  const out = orientVedicPair(male, female);
  assert.equal(out.groom, male);
  assert.equal(out.bride, female);
  assert.equal(out.groomIs, "personA");
  assert.equal(out.orientationAssumed, false);
});

test("female A + male B: B is the groom (entry order no longer decides)", () => {
  const out = orientVedicPair(female, male);
  assert.equal(out.groom, male);
  assert.equal(out.bride, female);
  assert.equal(out.groomIs, "personB");
  assert.equal(out.orientationAssumed, false);
});

test("same gender keeps entry order and flags the assumption", () => {
  for (const [a, b] of [
    [male, { ...B, gender: "male" }],
    [female, { ...A, gender: "female" }],
  ]) {
    const out = orientVedicPair(a, b);
    assert.equal(out.groom, a);
    assert.equal(out.bride, b);
    assert.equal(out.orientationAssumed, true);
  }
});

test("missing or other gender keeps entry order and flags the assumption", () => {
  for (const [a, b] of [
    [A, B],
    [male, B],
    [A, female],
    [{ ...A, gender: "other" }, female],
  ] as const) {
    const out = orientVedicPair<object>(a, b);
    assert.equal(out.groom, a);
    assert.equal(out.groomIs, "personA");
    assert.equal(out.orientationAssumed, true);
  }
});

test("gender reading tolerates case and short forms", () => {
  assert.equal(readMatchGender({ gender: "Male" }), "male");
  assert.equal(readMatchGender({ gender: "F" }), "female");
  assert.equal(readMatchGender({ gender: "non-binary" }), "other");
  assert.equal(readMatchGender({ gender: "" }), undefined);
  assert.equal(readMatchGender({}), undefined);
  assert.equal(readMatchGender(null), undefined);
});

test("Manglik results are mapped back onto the people as entered", () => {
  const upstream = {
    total_score: 24,
    manglik_analysis: { groom_manglik: true, bride_manglik: false },
  };
  const asEntered = attachPairManglik(upstream, "personA");
  assert.equal(asEntered.personA_manglik, true);
  assert.equal(asEntered.personB_manglik, false);

  // A was the bride: A's status is the bride's.
  const swapped = attachPairManglik(upstream, "personB");
  assert.equal(swapped.personA_manglik, false);
  assert.equal(swapped.personB_manglik, true);
  assert.equal(swapped.groomIs, "personB");
  // Upstream fields are preserved untouched.
  assert.deepEqual(swapped.manglik_analysis, upstream.manglik_analysis);
});

test("top-level groom/bride Manglik fields are mapped too", () => {
  const out = attachPairManglik(
    { groom_manglik: { is_manglik: true }, bride_manglik: false },
    "personB",
  );
  assert.equal(out.personA_manglik, false);
  assert.deepEqual(out.personB_manglik, { is_manglik: true });
});
