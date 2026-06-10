import test from "node:test";
import assert from "node:assert/strict";
import { buildFunnelSummary } from "../shared/funnel-summary.js";

test("buildFunnelSummary aggregates acquisition and conversion events", () => {
  const summary = buildFunnelSummary([
    {
      eventName: "page_view",
      path: "/free-kundali",
      acquisition: { source: "google", medium: "seo_tool", campaign: "free_tool_funnel" },
    },
    {
      eventName: "seo_tool_complete",
      path: "/free-kundali",
      acquisition: { source: "google", medium: "seo_tool", campaign: "free_tool_funnel" },
    },
    {
      eventName: "seo_cta_click",
      path: "/free-kundali",
      acquisition: { source: "google", medium: "seo_tool", campaign: "free_tool_funnel" },
    },
    {
      eventName: "onboarding_complete",
      path: "/onboarding",
      acquisition: { source: "google", medium: "seo_tool", campaign: "free_tool_funnel" },
    },
    {
      eventName: "consult_started",
      path: "/consult/kavan/chat",
      acquisition: { source: "direct", medium: "unknown", campaign: null },
    },
    {
      eventName: "credit_topup_completed",
      path: "/pricing",
      params: { amount: 499 },
      acquisition: { source: "google", medium: "seo_tool", campaign: "free_tool_funnel" },
    },
  ]);

  assert.equal(summary.totalEvents, 6);
  assert.equal(summary.pageViews, 1);
  assert.equal(summary.seoToolCompletions, 1);
  assert.equal(summary.seoCtaClicks, 1);
  assert.equal(summary.onboardingCompletions, 1);
  assert.equal(summary.consultStarts, 1);
  assert.equal(summary.payments, 1);
  assert.equal(summary.estimatedRevenue, 499);
  assert.deepEqual(summary.topSources[0], { source: "google", count: 5 });
  assert.deepEqual(summary.topPages[0], { path: "/free-kundali", count: 3 });
});

test("buildFunnelSummary safely handles empty input", () => {
  const summary = buildFunnelSummary([]);

  assert.equal(summary.totalEvents, 0);
  assert.equal(summary.paidConversionRate, 0);
  assert.deepEqual(summary.topSources, []);
  assert.deepEqual(summary.topPages, []);
});
