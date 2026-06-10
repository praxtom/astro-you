import test from "node:test";
import assert from "node:assert/strict";
import { verifyLiveServices } from "../shared/live-services.js";

test("verifyLiveServices reports ready when all live checks pass", async () => {
  const report = await verifyLiveServices({
    async verifyFirestore() {},
    async verifyAuth() {},
    async verifyStorage() {},
  });

  assert.equal(report.overallStatus, "ready");
  assert.equal(report.checks.every((check) => check.status === "pass"), true);
});

test("verifyLiveServices reports blocked without leaking long provider errors", async () => {
  const report = await verifyLiveServices({
    async verifyFirestore() {
      throw new Error("16 UNAUTHENTICATED: " + "x".repeat(500));
    },
    async verifyAuth() {},
    async verifyStorage() {
      throw new Error("invalid_grant: Invalid JWT Signature.");
    },
  });

  assert.equal(report.overallStatus, "blocked");
  assert.equal(report.checks.filter((check) => check.status === "fail").length, 2);
  assert.ok((report.checks[0].message || "").length <= 240);
  assert.match(report.checks[2].message || "", /Invalid JWT Signature/);
});

test("verifyLiveServices turns invalid service account errors into actionable guidance", async () => {
  const report = await verifyLiveServices({
    async verifyFirestore() {
      throw new Error("16 UNAUTHENTICATED: Request had invalid authentication credentials.");
    },
    async verifyAuth() {
      throw new Error("invalid_grant: Invalid JWT Signature.");
    },
    async verifyStorage() {},
  });

  assert.equal(report.overallStatus, "blocked");
  assert.match(report.checks[0].message || "", /Firebase Admin authentication failed/);
  assert.match(report.checks[1].message || "", /Replace FIREBASE_SERVICE_ACCOUNT/);
});
