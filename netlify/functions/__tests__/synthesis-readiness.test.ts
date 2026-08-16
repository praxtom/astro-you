import test from "node:test";
import assert from "node:assert/strict";
import {
  parseCompletedBirthProfile,
  type CompletedBirthProfile,
} from "../../../src/lib/profile-readiness.js";
import { getDefaultSynthesisRails } from "../../../src/lib/synthesis-layout.js";

const COMPLETE_PROFILE: CompletedBirthProfile = {
  name: "Test Seeker",
  gender: "Other",
  dob: "1990-01-15",
  tob: "12:00",
  pob: "New Delhi, India",
  birthTimeUnknown: true,
};

test("parseCompletedBirthProfile rejects partial onboarding drafts", () => {
  assert.equal(
    parseCompletedBirthProfile(
      JSON.stringify({ name: "Test Seeker", gender: "Other" }),
      "true",
    ),
    null,
  );
  assert.equal(
    parseCompletedBirthProfile(JSON.stringify(COMPLETE_PROFILE), null),
    null,
  );
});

test("parseCompletedBirthProfile accepts only marker-backed complete profiles", () => {
  assert.deepEqual(
    parseCompletedBirthProfile(JSON.stringify(COMPLETE_PROFILE), "true"),
    COMPLETE_PROFILE,
  );
  assert.equal(parseCompletedBirthProfile("not-json", "true"), null);
});

test("getDefaultSynthesisRails closes drawers on mobile", () => {
  assert.deepEqual(getDefaultSynthesisRails(false, true), {
    conversations: false,
    blueprint: false,
  });
  assert.deepEqual(getDefaultSynthesisRails(false, false), {
    conversations: false,
    blueprint: false,
  });
});

test("getDefaultSynthesisRails opens desktop rails according to auth state", () => {
  assert.deepEqual(getDefaultSynthesisRails(true, true), {
    conversations: true,
    blueprint: true,
  });
  assert.deepEqual(getDefaultSynthesisRails(true, false), {
    conversations: false,
    blueprint: true,
  });
});
