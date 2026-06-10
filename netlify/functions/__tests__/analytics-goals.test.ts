import test from "node:test";
import assert from "node:assert/strict";
import { buildFunnelEventRecord } from "../shared/funnel-analytics.js";
import { buildFunnelSummary } from "../shared/funnel-summary.js";

test("analytics accepts product readiness conversion events", () => {
  const eventNames = [
    "pricing_pack_selected",
    "consult_profile_viewed",
    "consult_review_submitted",
    "trust_testimonial_submitted",
    "report_generation_failed",
  ];

  for (const eventName of eventNames) {
    const record = buildFunnelEventRecord(
      {
        eventName,
        params: { personaId: "meera-devi", reportType: "yearly", amount: 999 },
        path: "/consult/meera-devi/profile",
      },
      { uid: "user_123" },
      "server-timestamp",
    );

    assert.equal(record.eventName, eventName);
  }
});

test("funnel summary exposes readiness conversion goals", () => {
  const summary = buildFunnelSummary([
    { eventName: "pricing_pack_selected", path: "/pricing" },
    { eventName: "consult_profile_viewed", path: "/consult/meera-devi/profile" },
    { eventName: "consult_review_submitted", path: "/consult/meera-devi/chat" },
    { eventName: "trust_testimonial_submitted", path: "/trust" },
    { eventName: "report_generation_failed", path: "/reports" },
  ]) as any;

  assert.equal(summary.pricingPackSelections, 1);
  assert.equal(summary.consultProfileViews, 1);
  assert.equal(summary.consultReviews, 1);
  assert.equal(summary.testimonialsSubmitted, 1);
  assert.equal(summary.reportGenerationFailures, 1);
});
