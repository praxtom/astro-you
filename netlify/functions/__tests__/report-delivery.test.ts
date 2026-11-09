import test from "node:test";
import assert from "node:assert/strict";
import {
  formatYearlyForecastSections,
  MIN_REPORT_PROSE_CHARS,
} from "../shared/reports.js";
import { createTextPdf, toPdfSafeText } from "../shared/simple-pdf.js";
import {
  decideReportRetry,
  reapStuckReport,
  STUCK_REPORT_MS,
} from "../shared/report-access.js";
import { createFakeFirestore } from "./helpers/fake-firestore.js";

const YEARLY_SAMPLE = {
  subject: "Emma",
  sign: "Taurus",
  timeframe: "yearly",
  yearly_theme:
    "You seek stability and find purpose in creating something tangible and lasting. This year brings opportunities for building lasting foundations.",
  overall_rating: 4,
  time_window: { start: "2025-01-01", end: "2025-12-31", days: 365 },
  quarterly_breakdown: [
    { quarter: "Q1", focus: "Foundation Building", rating: 4 },
    { quarter: "Q2", focus: "Growth & Expansion", rating: 3 },
  ],
  life_areas: [
    {
      area: "career",
      title: "💼 Career",
      prediction:
        "Professional advancement through steady effort and strategic planning. Major opportunities in Q4.",
      rating: 5,
      keywords: ["advancement", "strategy"],
    },
  ],
  planetary_influences: [
    {
      planet: "Jupiter",
      aspect_type: "trine",
      natal_planet: "Sun",
      description:
        "Jupiter trine natal Sun throughout the year brings expansion and good fortune in career matters.",
      strength: 4,
    },
  ],
};

function blockText(
  blocks: ReturnType<typeof formatYearlyForecastSections>["blocks"],
) {
  return blocks
    .map((b) =>
      typeof b === "string"
        ? b
        : "heading" in b
          ? `# ${b.heading}`
          : `## ${b.subheading}`,
    )
    .join("\n");
}

test("yearly forecast renders readable headings and sentences, never JSON", () => {
  const { blocks, proseChars } = formatYearlyForecastSections(YEARLY_SAMPLE);
  const out = blockText(blocks);
  assert.ok(proseChars >= MIN_REPORT_PROSE_CHARS, `proseChars=${proseChars}`);
  assert.match(out, /# Your year at a glance/);
  assert.match(out, /Covers 2025-01-01 to 2025-12-31\./);
  assert.match(out, /Overall outlook: 4\/5\./);
  assert.match(out, /## Q1 - Foundation Building/);
  assert.match(out, /# Areas of life/);
  assert.match(out, /## Career/);
  assert.match(out, /Keywords: advancement, strategy\./);
  assert.match(out, /Jupiter trine natal Sun: Jupiter trine natal Sun/);
  assert.doesNotMatch(out, /[{}"]|\[|\]/);
  // Bare metadata (subject/sign/timeframe) is not dumped as content.
  assert.doesNotMatch(out, /Timeframe/);
});

test("yearly forecast accepts a {data: ...} wrapper and unknown prose sections", () => {
  const { blocks } = formatYearlyForecastSections({
    data: {
      theme:
        "A year of patient building and quiet confidence across every part of life.",
      monthly_breakdown: [
        {
          month: "January",
          theme: "Reset",
          prediction: "Clear old commitments and set a calm pace.",
        },
      ],
      spiritual_focus: {
        description:
          "Daily japa and gratitude practice anchor the year's growth and keep you steady.",
      },
    },
  });
  const out = blockText(blocks);
  assert.match(out, /## January - Reset/);
  assert.match(out, /# Spiritual focus/);
  assert.doesNotMatch(out, /[{}]/);
});

test("empty or meaningless yearly payloads yield no deliverable prose", () => {
  for (const payload of [
    null,
    {},
    { subject: "Emma", sign: "Taurus", overall_rating: 4 },
    { quarterly_breakdown: [{ quarter: "Q1", rating: 3 }] },
    '{"raw":"json"}',
  ]) {
    const { proseChars } = formatYearlyForecastSections(payload);
    assert.ok(
      proseChars < MIN_REPORT_PROSE_CHARS,
      `expected refund-worthy content for ${JSON.stringify(payload)}`,
    );
  }
});

test("createTextPdf flows long reports across pages and stays ASCII", () => {
  const paragraphs = Array.from(
    { length: 120 },
    (_, i) =>
      `Paragraph ${i + 1}: “Smart quotes” – dashes… and ₹ prices 💼 stay readable.`,
  );
  const pdf = new TextDecoder().decode(
    createTextPdf("Yearly Forecast Report", [
      { heading: "Overview" },
      ...paragraphs,
    ]),
  );
  const pageCount = Number(pdf.match(/\/Count (\d+)/)?.[1]);
  assert.ok(pageCount > 1, `expected multiple pages, got ${pageCount}`);
  assert.match(pdf, /Paragraph 120:/);
  assert.match(pdf, /Rs\. prices/);
  assert.doesNotMatch(pdf, /[^\n\x20-\x7E]/);
  assert.match(pdf, /\/BaseFont \/Helvetica-Bold/);
  // xref offsets must match the byte layout.
  const xrefAt = Number(pdf.match(/startxref\n(\d+)/)?.[1]);
  assert.equal(pdf.slice(xrefAt, xrefAt + 4), "xref");
});

test("toPdfSafeText maps typography to ASCII", () => {
  assert.equal(toPdfSafeText("“Hi” — it’s ₹99…"), '"Hi" - it\'s Rs.99...');
  assert.equal(toPdfSafeText("💼 Career"), "Career");
});

test("a retried request id is never charged twice", () => {
  const uid = "user_1";
  assert.deepEqual(
    decideReportRetry(uid, {
      status: "completed",
      storagePath: "users/user_1/reports/req_1/a.pdf",
    }),
    { kind: "redownload", storagePath: "users/user_1/reports/req_1/a.pdf" },
  );
  assert.deepEqual(decideReportRetry(uid, { status: "generating" }), {
    kind: "in_progress",
  });
  assert.deepEqual(decideReportRetry(uid, { status: "failed" }), {
    kind: "failed",
  });
});

test("the reaper refunds a report stuck in generating, exactly once", async () => {
  const now = Date.now();
  const fake = createFakeFirestore({
    "users/u1": { credits: 1 },
    "users/u1/reports/r1": {
      status: "generating",
      reportType: "yearly",
      createdAt: new Date(now - STUCK_REPORT_MS - 1000),
    },
    "users/u1/creditLedger/report_r1": { type: "report", amount: -199 },
  });
  const deps = { db: fake.db, FieldValue: fake.FieldValue, nowMs: now };

  assert.equal(await reapStuckReport(deps, "u1", "r1"), "refunded");
  assert.equal(fake.get("users/u1")?.credits, 200);
  assert.equal(fake.get("users/u1/reports/r1")?.status, "failed");
  assert.equal(fake.get("users/u1/reports/r1")?.failureReason, "timed_out");
  assert.equal(fake.get("users/u1/creditLedger/report_refund_r1")?.amount, 199);

  assert.equal(await reapStuckReport(deps, "u1", "r1"), "skipped");
  assert.equal(fake.get("users/u1")?.credits, 200);
});

test("the reaper leaves fresh reports alone and never refunds an uncharged one", async () => {
  const now = Date.now();
  const fake = createFakeFirestore({
    "users/u1": { credits: 5 },
    "users/u1/reports/fresh": {
      status: "generating",
      createdAt: new Date(now - 60_000),
    },
    "users/u1/reports/uncharged": {
      status: "generating",
      createdAt: new Date(now - STUCK_REPORT_MS - 1),
    },
    // pdf-report already refunded this one itself; the ledger id is shared.
    "users/u1/reports/refunded": {
      status: "generating",
      createdAt: new Date(now - STUCK_REPORT_MS - 1),
    },
    "users/u1/creditLedger/report_refunded": { type: "report", amount: -75 },
    "users/u1/creditLedger/report_refund_refunded": {
      type: "refund",
      amount: 75,
    },
  });
  const deps = { db: fake.db, FieldValue: fake.FieldValue, nowMs: now };

  assert.equal(await reapStuckReport(deps, "u1", "fresh"), "skipped");
  assert.equal(
    await reapStuckReport(deps, "u1", "uncharged"),
    "failed_without_charge",
  );
  assert.equal(await reapStuckReport(deps, "u1", "refunded"), "refunded");
  // Deduplicated against the existing refund entry: balance unchanged.
  assert.equal(fake.get("users/u1")?.credits, 5);
  assert.equal(fake.get("users/u1/reports/uncharged")?.status, "failed");
});
