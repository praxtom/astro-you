import test from "node:test";
import assert from "node:assert/strict";
import {
  FunnelAnalyticsError,
  buildFunnelEventRecord,
} from "../shared/funnel-analytics.js";

test("buildFunnelEventRecord stores a safe acquisition event", () => {
  const record = buildFunnelEventRecord(
    {
      eventName: "seo_tool_complete",
      params: {
        tool: "free_kundali",
        email: "user@example.com",
        amount: 499,
        nested: { unsafe: true },
      },
      path: "/free-kundali?utm_source=google",
      referrer: "https://google.com/search?q=kundali",
      anonymousId: "anon_123456789",
      sessionId: "session_123456789",
      acquisition: {
        source: "google",
        medium: "seo_tool",
        campaign: "free_tool_funnel",
      },
    },
    { uid: "user_123" },
    "server-timestamp",
  );

  assert.equal(record.eventName, "seo_tool_complete");
  assert.equal(record.uid, "user_123");
  assert.equal(record.path, "/free-kundali");
  assert.equal(record.referrerHost, "google.com");
  assert.equal(record.params.tool, "free_kundali");
  assert.equal(record.params.amount, 499);
  assert.equal(record.params.email, undefined);
  assert.equal(record.params.nested, undefined);
  assert.equal(record.acquisition.medium, "seo_tool");
  assert.equal(record.createdAt, "server-timestamp");
});

test("buildFunnelEventRecord rejects unsupported event names", () => {
  assert.throws(
    () =>
      buildFunnelEventRecord(
        {
          eventName: "random_sensitive_event",
          params: {},
        },
        {},
        "server-timestamp",
      ),
    (error: unknown) => {
      const err = error as FunnelAnalyticsError;
      return (
        error instanceof FunnelAnalyticsError &&
        err.status === 400 &&
        /event/i.test(err.message)
      );
    },
  );
});
