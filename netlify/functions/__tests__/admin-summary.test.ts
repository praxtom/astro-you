import test from "node:test";
import assert from "node:assert/strict";
import { buildAdminSummary } from "../shared/admin-summary.js";

const updatedAt = new Date("2026-05-29T10:00:00.000Z");

test("buildAdminSummary creates sanitized product metrics", () => {
  const summary = buildAdminSummary([
    {
      id: "user_1",
      email: "a@example.com",
      profile: {
        name: "Asha",
        subscription: { tier: "premium", priceInr: 499 },
      },
      credits: 12,
      updatedAt,
      birthData: { dob: "1990-01-01" },
    },
    {
      id: "user_2",
      email: "b@example.com",
      subscription: { tier: "pro", priceInr: 999 },
      credits: 30,
      usage: { creditsUsed: 7 },
      updatedAt: "2026-05-29T09:00:00.000Z",
    },
    {
      id: "user_3",
      email: "c@example.com",
      profile: { name: "Chandra" },
      credits: 2,
      updatedAt: "2026-05-28T09:00:00.000Z",
    },
  ]);

  assert.equal(summary.totalUsers, 3);
  assert.equal(summary.premiumUsers, 1);
  assert.equal(summary.proUsers, 1);
  assert.equal(summary.payingUsers, 2);
  assert.equal(summary.paidConversionRate, 66.7);
  assert.equal(summary.estimatedMrr, 1498);
  assert.equal(summary.totalCreditsOutstanding, 44);
  assert.equal(summary.totalCreditsUsed, 7);
  assert.deepEqual(Object.keys(summary.recentUsers[0]).sort(), [
    "credits",
    "email",
    "id",
    "name",
    "tier",
    "updatedAt",
  ]);
  assert.equal("birthData" in summary.recentUsers[0], false);
});

test("buildAdminSummary safely handles empty data", () => {
  const summary = buildAdminSummary([]);

  assert.equal(summary.totalUsers, 0);
  assert.equal(summary.paidConversionRate, 0);
  assert.equal(summary.estimatedMrr, 0);
  assert.deepEqual(summary.recentUsers, []);
});
