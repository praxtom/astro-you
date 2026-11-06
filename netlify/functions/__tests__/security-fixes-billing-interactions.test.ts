import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  decideReportIdRequest,
  REPORT_ID_PATTERN,
} from "../shared/report-access.js";
import { createReportStoragePath } from "../shared/report-storage.js";
import {
  birthInputError,
  chargeKeyCoord,
  isValidDateString,
} from "../shared/charge-input.js";
import {
  consultInteractionLogId,
  messagesWithoutChain,
  ownedInteractionIds,
  resolvePreviousInteractionId,
} from "../shared/interaction-ownership.js";
import {
  PARTIAL_REPLY_NOTE,
  partialReplyOnTimeout,
} from "../shared/synthesis-timeout.js";
import { describeError } from "../shared/error-summary.js";
import {
  dispatchBackgroundJob,
  INTERNAL_AUTH_HEADER,
  internalDispatchConfig,
  isAuthorizedInternalRequest,
  resetInternalDispatchWarnings,
} from "../shared/internal-dispatch.js";

// Compiled tests run from node_modules/.tmp/...; read sources from the repo.
const FN_DIR = path.resolve("netlify/functions");
const src = (file: string) => readFileSync(path.join(FN_DIR, file), "utf8");

// ---------------------------------------------------------------------------
// H1 — pdf-report re-download is free only for a completed, owned report
// ---------------------------------------------------------------------------

const UID = "user_1";
const ownPath = createReportStoragePath({
  uid: UID,
  reportId: "rep1",
  filename: "natal.pdf",
});

test("H1: completed report with own storagePath is a free re-download", () => {
  const d = decideReportIdRequest(UID, {
    status: "completed",
    storagePath: ownPath,
  });
  assert.deepEqual(d, { kind: "redownload", storagePath: ownPath });
});

test("H1: failed / generating / pathless reports are never free re-downloads", () => {
  for (const report of [
    { status: "failed", failureReason: "insufficient_credits" },
    { status: "generating" },
    { status: "completed" }, // no storagePath
    { status: "failed", storagePath: ownPath },
  ]) {
    assert.equal(decideReportIdRequest(UID, report).kind, "not_available");
  }
  assert.equal(decideReportIdRequest(UID, undefined).kind, "not_found");
});

test("H1: a stored path outside the caller's prefix is refused", () => {
  const other = createReportStoragePath({
    uid: "someone_else",
    reportId: "rep1",
    filename: "natal.pdf",
  });
  assert.equal(
    decideReportIdRequest(UID, { status: "completed", storagePath: other })
      .kind,
    "not_available",
  );
  assert.equal(
    decideReportIdRequest(UID, {
      status: "completed",
      storagePath: `users/${UID}/reports/../../x`,
    }).kind,
    "not_available",
  );
  assert.equal(
    decideReportIdRequest(UID, {
      status: "completed",
      storagePath: ownPath,
      uid: "someone_else",
    }).kind,
    "not_available",
  );
});

test("H1: pdf-report wires the decision (no Boolean(existingReport) shortcut)", () => {
  const code = src("pdf-report.ts");
  assert.ok(!/isRedownload\s*=\s*Boolean\(existingReport\)/.test(code));
  assert.ok(code.includes("decideReportIdRequest(uid, existingReport)"));
  assert.ok(code.includes('"report_not_available"'));
  assert.equal(REPORT_ID_PATTERN.test("abc_DEF-1"), true);
  assert.equal(REPORT_ID_PATTERN.test("a/b"), false);
});

// ---------------------------------------------------------------------------
// M1 — validate before charging; coords + gender in the charge key
// ---------------------------------------------------------------------------

const GOOD = {
  dob: "1990-05-15",
  tob: "14:30",
  pob: "Delhi",
  lat: 28.6,
  lng: 77.2,
};

test("M1: birthInputError accepts good input and optional coords", () => {
  assert.equal(birthInputError(GOOD), null);
  assert.equal(birthInputError({ dob: "1990-05-15", tob: "14:30:00" }), null);
  assert.equal(birthInputError({ ...GOOD, lat: "28.6", lng: "-77.2" }), null);
});

test("M1: birthInputError rejects out-of-range coords and bad formats", () => {
  assert.match(birthInputError({ ...GOOD, lat: 91 })!, /latitude/);
  assert.match(birthInputError({ ...GOOD, lat: "abc" })!, /latitude/);
  assert.match(birthInputError({ ...GOOD, lng: -180.5 })!, /longitude/);
  assert.match(birthInputError({ ...GOOD, lng: Number.NaN })!, /longitude/);
  assert.match(birthInputError({ ...GOOD, dob: "1990-02-30" })!, /date/);
  assert.match(birthInputError({ ...GOOD, dob: "15/05/1990" })!, /date/);
  assert.match(birthInputError({ ...GOOD, tob: "25:00" })!, /time/);
  assert.match(birthInputError(null)!, /date/);
  assert.equal(isValidDateString("2026-11-07"), true);
  assert.equal(isValidDateString("2026-13-01"), false);
});

test("M1: chargeKeyCoord rounds so near-identical coords share a key", () => {
  assert.equal(chargeKeyCoord(28.6139), "28.61");
  assert.equal(chargeKeyCoord("28.6141"), "28.61");
  assert.equal(chargeKeyCoord(undefined), "");
  assert.notEqual(chargeKeyCoord(28.6), chargeKeyCoord(-28.6));
});

function assertValidatesBeforeCharge(file: string) {
  const code = src(file);
  const validate = code.indexOf("birthInputError(");
  const charge = code.indexOf(
    "reserveFeatureCredits(",
    code.indexOf("export default"),
  );
  assert.ok(validate > 0 && charge > 0, `${file}: both calls present`);
  assert.ok(validate < charge, `${file}: validation must precede the charge`);
  assert.ok(code.includes("chargeKeyCoord("), `${file}: coords in charge key`);
  assert.ok(
    code.includes("insufficientCreditsResponse(err)"),
    `${file}: 429 for exhausted attempts`,
  );
}

test("M1: horoscope validates input (incl. date) before charging", () => {
  assertValidatesBeforeCharge("horoscope.ts");
  assert.ok(
    src("horoscope.ts").includes('badInputResponse("date must be YYYY-MM-DD")'),
  );
});

test("M1: compatibility validates both people and keys on gender", () => {
  assertValidatesBeforeCharge("compatibility.ts");
  assert.ok(/gender\s*\?\?/.test(src("compatibility.ts")));
});

// ---------------------------------------------------------------------------
// L1 — interaction ids honoured only when in the caller's server-side log
// ---------------------------------------------------------------------------

test("L1: client interaction ids are intersected with the log", () => {
  const logged = ["int_a", "int_b"];
  assert.deepEqual(
    ownedInteractionIds(["int_b", "victim_x", "int_a", "../bad"], logged),
    ["int_b", "int_a"],
  );
  assert.deepEqual(ownedInteractionIds("int_a", logged), []);
});

test("L1: previousInteractionId is ignored unless logged", () => {
  assert.equal(resolvePreviousInteractionId("int_a", ["int_a"]), "int_a");
  assert.equal(resolvePreviousInteractionId("victim_x", ["int_a"]), undefined);
  assert.equal(resolvePreviousInteractionId(undefined, ["int_a"]), undefined);
  assert.equal(resolvePreviousInteractionId({}, []), undefined);
});

test("L1: a refused chain replays the client's visible transcript", () => {
  const current = { role: "user" as const, content: "and now?" };
  const prior = [
    { role: "user", content: "hi" },
    { role: "assistant", content: "hello" },
    { role: "system", content: "ignored" },
  ];
  assert.deepEqual(messagesWithoutChain([current], prior), [
    { role: "user", content: "hi" },
    { role: "assistant", content: "hello" },
    current,
  ]);
  // Already a full transcript → untouched.
  const full = [prior[0] as any, current];
  assert.equal(messagesWithoutChain(full, prior), full);
});

test("L1: endpoints only purge / chain logged ids", () => {
  assert.ok(!src("delete-account.ts").includes('"lastInteractionId"'));
  assert.ok(src("memory-forget-chat.ts").includes("ownedInteractionIds("));
  const synth = src("synthesis.ts");
  assert.ok(synth.includes("resolvePreviousInteractionId("));
  assert.ok(
    synth.includes("previousInteractionId: clientPreviousInteractionId"),
  );
});

// ---------------------------------------------------------------------------
// L2 — chatId / assistantMessageId validated in synthesis
// ---------------------------------------------------------------------------

test("L2: synthesis rejects malformed chat/message ids with 400", () => {
  const synth = src("synthesis.ts");
  assert.ok(synth.includes("CLIENT_DOC_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/"));
  assert.ok(synth.includes("CLIENT_DOC_ID_PATTERN.test(chatId)"));
  assert.ok(synth.includes("CLIENT_DOC_ID_PATTERN.test(assistantMessageId)"));
  // Validation must happen before the first persistence (crisis path).
  assert.ok(
    synth.indexOf("CLIENT_DOC_ID_PATTERN.test(chatId)") <
      synth.indexOf("detectCrisisRisk("),
  );
});

// ---------------------------------------------------------------------------
// L3 — timeout after streamed text keeps the charge
// ---------------------------------------------------------------------------

test("L3: timeout before any text refunds; after text keeps the partial reply", () => {
  assert.equal(partialReplyOnTimeout(""), null);
  assert.equal(partialReplyOnTimeout("   "), null);
  assert.equal(
    partialReplyOnTimeout("Saturn is"),
    `Saturn is${PARTIAL_REPLY_NOTE}`,
  );
  const synth = src("synthesis.ts");
  const partialIdx = synth.indexOf("if (partialContent)");
  const refundIdx = synth.lastIndexOf("await refundCredit();");
  assert.ok(partialIdx > 0 && partialIdx < refundIdx);
});

// ---------------------------------------------------------------------------
// L4 — error logs carry kind/status/code only
// ---------------------------------------------------------------------------

test("L4: describeError drops upstream bodies and birth inputs", () => {
  const err = new Error(
    'Natal error: 422 - {"subject":{"dob":"1990-05-15","city":"Delhi"}}',
  );
  const summary = describeError(err);
  assert.deepEqual(summary, { kind: "Error", status: 422 });
  assert.ok(!JSON.stringify(summary).includes("1990"));
  assert.deepEqual(
    describeError(Object.assign(new Error("x"), { status: 503, code: "E1" })),
    { kind: "Error", status: 503, code: "E1" },
  );
  assert.deepEqual(describeError("boom"), { kind: "string" });
});

test("L4: owned endpoints never log raw error objects", () => {
  for (const file of ["horoscope.ts", "compatibility.ts", "pdf-report.ts"]) {
    const code = src(file);
    const raw = code.match(
      /console\.(error|warn)\([^;]*?,\s*(err|error|genErr|e|auditError)\s*,?\s*\)/g,
    );
    assert.equal(raw, null, `${file}: ${raw?.join(" | ")}`);
  }
});

// ---------------------------------------------------------------------------
// Reliability — internal dispatch config sanity
// ---------------------------------------------------------------------------

const STRONG = "s".repeat(40);

async function captureConsole<T>(
  method: "warn" | "error",
  fn: () => Promise<T> | T,
): Promise<{ result: T; lines: string[] }> {
  const original = console[method];
  const lines: string[] = [];
  console[method] = (...args: unknown[]) => {
    lines.push(args.map(String).join(" "));
  };
  try {
    return { result: await fn(), lines };
  } finally {
    console[method] = original;
  }
}

test("dispatch: no secret → no network call, inline fallback logged once", async () => {
  resetInternalDispatchWarnings();
  let fetched = 0;
  const fetchImpl = (async () => {
    fetched++;
    return new Response(null, { status: 202 });
  }) as unknown as typeof fetch;
  const env = { URL: "https://site.example" };
  const { result, lines } = await captureConsole("warn", async () => [
    await dispatchBackgroundJob("a-background", {}, { env, fetchImpl }),
    await dispatchBackgroundJob("a-background", {}, { env, fetchImpl }),
  ]);
  assert.deepEqual(result, [false, false]);
  assert.equal(fetched, 0);
  assert.equal(lines.length, 1);
  assert.match(lines[0], /run inline/);
  assert.deepEqual(internalDispatchConfig({}), {
    configured: false,
    source: "none",
  });
  assert.deepEqual(internalDispatchConfig({ OTP_HASH_SECRET: STRONG }), {
    configured: true,
    source: "derived",
  });
});

test("dispatch: a secret mismatch is logged once by the receiver", async () => {
  resetInternalDispatchWarnings();
  const env = { INTERNAL_FUNCTION_SECRET: STRONG };
  const req = () =>
    new Request("https://x/.netlify/functions/a-background", {
      method: "POST",
      headers: { [INTERNAL_AUTH_HEADER]: "z".repeat(40) },
    });
  const { result, lines } = await captureConsole("error", () => [
    isAuthorizedInternalRequest(req(), env),
    isAuthorizedInternalRequest(req(), env),
  ]);
  assert.deepEqual(result, [false, false]);
  assert.equal(lines.length, 1);
  assert.match(lines[0], /mismatch/);
  // Never leaks the secret.
  assert.ok(!lines[0].includes(STRONG));
});

// ---------------------------------------------------------------------------
// Consult chat: same ownership check, and turns are logged for chaining
// ---------------------------------------------------------------------------

test("consult: session log id is derived only from a valid session id", () => {
  assert.equal(consultInteractionLogId("AbC123xyz"), "consult_AbC123xyz");
  assert.equal(consultInteractionLogId("../other"), null);
  assert.equal(consultInteractionLogId(""), null);
  assert.equal(consultInteractionLogId(42), null);
  // Logged turn → chain honoured; foreign id → ignored.
  const logged = ["int_consult_1"];
  assert.equal(resolvePreviousInteractionId("int_consult_1", logged), "int_consult_1");
  assert.equal(resolvePreviousInteractionId("victim_x", logged), undefined);
});

test("consult: endpoint verifies the chain id and logs each turn", () => {
  const code = src("consult-message.ts");
  assert.ok(code.includes("resolvePreviousInteractionId("));
  assert.ok(code.includes("recordInteractionId("));
  assert.ok(!code.includes("body.previousInteractionId,\n            personaOverride"));
  assert.ok(!/previousInteractionId:\s*body\.previousInteractionId/.test(code));
  assert.ok(src("transit.ts").includes("insufficientCreditsResponse(err)"));
});
