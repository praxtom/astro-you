import test from "node:test";
import assert from "node:assert/strict";
import {
  buildDailyDigest,
  buildUnsubscribeToken,
  buildUnsubscribeUrl,
  resolveUnsubscribeSecret,
  verifyUnsubscribeToken,
} from "../shared/digest.js";

const SECRET = "test-unsubscribe-secret-with-32+-chars!!";

test("resolveUnsubscribeSecret fails closed on missing or weak secrets", () => {
  assert.equal(resolveUnsubscribeSecret({}), undefined);
  assert.equal(resolveUnsubscribeSecret({ EMAIL_UNSUB_SECRET: "" }), undefined);
  assert.equal(
    resolveUnsubscribeSecret({ EMAIL_UNSUB_SECRET: "short" }),
    undefined,
  );
  assert.equal(
    resolveUnsubscribeSecret({ EMAIL_UNSUB_SECRET: "   " }),
    undefined,
  );
  assert.equal(
    resolveUnsubscribeSecret({ EMAIL_UNSUB_SECRET: SECRET }),
    SECRET,
  );
});

test("unsubscribe token round-trips for the same uid and secret", () => {
  const token = buildUnsubscribeToken("user-123", SECRET);
  assert.match(token, /^[0-9a-f]{64}$/);
  assert.equal(verifyUnsubscribeToken("user-123", token, SECRET), true);
});

test("unsubscribe token is rejected for a different uid", () => {
  const token = buildUnsubscribeToken("user-123", SECRET);
  assert.equal(verifyUnsubscribeToken("user-456", token, SECRET), false);
});

test("unsubscribe token is rejected for a different secret", () => {
  const token = buildUnsubscribeToken("user-123", SECRET);
  assert.equal(
    verifyUnsubscribeToken("user-123", token, `${SECRET}-rotated`),
    false,
  );
});

test("unsubscribe token rejects tampered, empty, and wrong-length tokens", () => {
  const token = buildUnsubscribeToken("user-123", SECRET);
  const tampered = `${token.slice(0, -1)}${token.endsWith("0") ? "1" : "0"}`;
  assert.equal(verifyUnsubscribeToken("user-123", tampered, SECRET), false);
  assert.equal(verifyUnsubscribeToken("user-123", "", SECRET), false);
  assert.equal(
    verifyUnsubscribeToken("user-123", token.slice(0, 10), SECRET),
    false,
  );
  assert.equal(verifyUnsubscribeToken("", token, SECRET), false);
});

test("buildUnsubscribeUrl points at /api/unsubscribe with uid and token", () => {
  const url = buildUnsubscribeUrl("user 123", SECRET, "https://astroyou.app/");
  const parsed = new URL(url);
  assert.equal(parsed.origin, "https://astroyou.app");
  assert.equal(parsed.pathname, "/api/unsubscribe");
  assert.equal(parsed.searchParams.get("uid"), "user 123");
  assert.equal(
    verifyUnsubscribeToken(
      "user 123",
      parsed.searchParams.get("token") || "",
      SECRET,
    ),
    true,
  );
});

test("buildDailyDigest renders the unsubscribe link in footer and text", () => {
  const unsubscribeUrl = buildUnsubscribeUrl(
    "user-123",
    SECRET,
    "https://astroyou.app",
  );
  const digest = buildDailyDigest({ name: "Asha", unsubscribeUrl });
  // The href is HTML-escaped (& → &amp;) in the html body.
  assert.ok(digest.html.includes(unsubscribeUrl.replace(/&/g, "&amp;")));
  assert.match(digest.html, /Unsubscribe/);
  assert.ok(digest.text.includes(unsubscribeUrl));
});

test("buildDailyDigest without unsubscribe URL falls back to settings link", () => {
  const digest = buildDailyDigest({ name: "Asha" });
  assert.ok(!digest.html.includes("/api/unsubscribe"));
  assert.match(digest.html, /settings/);
  assert.match(digest.text, /settings/);
});
