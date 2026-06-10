import test from "node:test";
import assert from "node:assert/strict";
import {
  getConfiguredAdminEmails,
  resolveAstrologyApiKey,
  resolveResendApiKey,
} from "../shared/env.js";

test("resolveAstrologyApiKey prefers the dedicated astrology key", () => {
  assert.equal(
    resolveAstrologyApiKey({
      ASTROLOGY_API_KEY: "astro-dedicated",
      ASTROYOU_API_KEY: "legacy-shared",
    }),
    "astro-dedicated",
  );
});

test("resolveResendApiKey prefers the dedicated email key", () => {
  assert.equal(
    resolveResendApiKey({
      RESEND_API_KEY: "resend-dedicated",
      ASTROYOU_API_KEY: "legacy-shared",
    }),
    "resend-dedicated",
  );
});

test("getConfiguredAdminEmails has no hardcoded fallback admins", () => {
  assert.deepEqual(getConfiguredAdminEmails({}), []);
  assert.deepEqual(getConfiguredAdminEmails({ ASTROYOU_ADMIN_EMAILS: "Admin@AstroYou.app, ops@astroyou.app" }), [
    "admin@astroyou.app",
    "ops@astroyou.app",
  ]);
});
