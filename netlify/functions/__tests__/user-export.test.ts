import test from "node:test";
import assert from "node:assert/strict";
import {
  buildUserDocExport,
  EXPORT_EXCLUDED_USER_FIELDS,
} from "../shared/user-export.js";

test("data export includes every user-doc field except documented internals", () => {
  const exported = buildUserDocExport({
    email: "me@example.com",
    memoryPaused: true,
    memoryNoticeDismissed: true,
    profile: {
      name: "Asha",
      zodiacMode: "vedic",
      timezone: "Asia/Kolkata",
      notificationPrefs: { emailDigest: false },
    },
    credits: 12,
    fcmToken: "device-token",
    activeConsultSessionId: "sess_1",
    _internalMarker: 1,
  });

  assert.equal(exported.memoryPaused, true);
  assert.equal(exported.memoryNoticeDismissed, true);
  assert.equal(exported.email, "me@example.com");
  assert.equal(exported.credits, 12);
  assert.deepEqual((exported.profile as any).notificationPrefs, {
    emailDigest: false,
  });
  assert.equal((exported.profile as any).timezone, "Asia/Kolkata");
  for (const key of [...EXPORT_EXCLUDED_USER_FIELDS, "_internalMarker"]) {
    assert.equal(key in exported, false, key);
  }
});

test("data export keeps a stable shape for an empty user doc", () => {
  assert.deepEqual(buildUserDocExport(undefined), {
    profile: {},
    atman: {},
    kundaliData: {},
  });
});
