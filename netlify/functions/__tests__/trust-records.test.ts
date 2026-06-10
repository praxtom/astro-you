import test from "node:test";
import assert from "node:assert/strict";
import {
  TrustRecordError,
  buildConsultReviewRecord,
  buildTrustModerationDecision,
  buildTrustSummary,
  buildPredictionFeedbackRecord,
  buildTestimonialSubmissionRecord,
} from "../shared/trust.js";

const createdAt = new Date("2026-05-29T10:00:00.000Z");

test("buildConsultReviewRecord creates a moderated real review", () => {
  const record = buildConsultReviewRecord(
    {
      personaId: "meera-devi",
      sessionId: "session_123",
      rating: 5,
      reviewText: "  Clear and useful guidance.  ",
      sharePublic: true,
    },
    { uid: "user_1", email: "Asha@example.com" },
    createdAt,
  );

  assert.equal(record.kind, "consult_review");
  assert.equal(record.personaId, "meera-devi");
  assert.equal(record.rating, 5);
  assert.equal(record.reviewText, "Clear and useful guidance.");
  assert.equal(record.publicStatus, "pending_review");
  assert.equal(record.sharePublic, true);
});

test("buildConsultReviewRecord rejects invalid ratings", () => {
  assert.throws(
    () =>
      buildConsultReviewRecord(
        { personaId: "meera-devi", sessionId: "session_123", rating: 6 },
        { uid: "user_1" },
        createdAt,
      ),
    (error: unknown) =>
      error instanceof TrustRecordError &&
      error.status === 400 &&
      /rating/i.test(error.message),
  );
});

test("buildPredictionFeedbackRecord captures accuracy feedback", () => {
  const record = buildPredictionFeedbackRecord(
    {
      source: "daily_forecast",
      period: "daily",
      forecastDate: "2026-05-29",
      signal: "partly",
      notes: "Career section was accurate, health was generic.",
    },
    { uid: "user_1", email: "asha@example.com" },
    createdAt,
  );

  assert.equal(record.kind, "prediction_feedback");
  assert.equal(record.signal, "partly");
  assert.equal(record.period, "daily");
  assert.equal(record.publicStatus, "aggregate_only");
});

test("buildTestimonialSubmissionRecord stores testimonial only for moderation", () => {
  const record = buildTestimonialSubmissionRecord(
    {
      story: "AstroYou helped me ask better questions before a career move.",
      publicName: " Asha K. ",
      allowPublicUse: true,
    },
    { uid: "user_1", email: "asha@example.com" },
    createdAt,
  );

  assert.equal(record.kind, "testimonial");
  assert.equal(record.publicName, "Asha K.");
  assert.equal(record.publicStatus, "pending_review");
  assert.equal(record.allowPublicUse, true);
});

test("buildTrustSummary exposes only approved public proof and aggregate feedback", () => {
  const summary = buildTrustSummary({
    moderationRecords: [
      {
        kind: "testimonial",
        publicStatus: "approved",
        publicName: "Asha K.",
        story: "AstroYou helped me ask better questions before a career move.",
        createdAt,
      },
      {
        kind: "consult_review",
        publicStatus: "approved",
        personaId: "meera-devi",
        rating: 5,
        reviewText: "Clear, grounded, and useful.",
        createdAt,
      },
      {
        kind: "testimonial",
        publicStatus: "pending_review",
        publicName: "Hidden",
        story: "This should not be public yet.",
      },
    ],
    predictionFeedbackRecords: [
      { signal: "accurate" },
      { signal: "accurate" },
      { signal: "partly" },
      { signal: "missed" },
    ],
  });

  assert.equal(summary.totals.approvedTestimonials, 1);
  assert.equal(summary.totals.approvedReviews, 1);
  assert.equal(summary.totals.pendingPublicSubmissions, 1);
  assert.equal(summary.predictionFeedback.total, 4);
  assert.equal(summary.predictionFeedback.accurate, 2);
  assert.equal(summary.predictionFeedback.partly, 1);
  assert.equal(summary.predictionFeedback.missed, 1);
  assert.equal(summary.predictionFeedback.helpfulRate, 75);
  assert.equal(summary.testimonials[0].publicName, "Asha K.");
  assert.equal(summary.reviews[0].rating, 5);
});

test("buildTrustSummary shows newest approved proof first", () => {
  const summary = buildTrustSummary({
    moderationRecords: [
      {
        kind: "testimonial",
        publicStatus: "approved",
        publicName: "Older",
        story: "Older approved story with enough detail to display.",
        createdAt: new Date("2026-05-01T10:00:00.000Z"),
      },
      {
        kind: "testimonial",
        publicStatus: "approved",
        publicName: "Newer",
        story: "Newer approved story with enough detail to display.",
        createdAt: new Date("2026-05-29T10:00:00.000Z"),
      },
      {
        kind: "consult_review",
        publicStatus: "approved",
        personaId: "meera-devi",
        rating: 4,
        reviewText: "Older review.",
        createdAt: new Date("2026-05-02T10:00:00.000Z"),
      },
      {
        kind: "consult_review",
        publicStatus: "approved",
        personaId: "arjun-sharma",
        rating: 5,
        reviewText: "Newer review.",
        createdAt: new Date("2026-05-30T10:00:00.000Z"),
      },
    ],
    predictionFeedbackRecords: [],
  });

  assert.equal(summary.testimonials[0].publicName, "Newer");
  assert.equal(summary.reviews[0].personaId, "arjun-sharma");
});

test("buildTrustSummary aggregates approved reviews per persona", () => {
  const summary = buildTrustSummary({
    moderationRecords: [
      {
        kind: "consult_review",
        publicStatus: "approved",
        personaId: "meera-devi",
        rating: 5,
        reviewText: "Very clear.",
        createdAt: new Date("2026-05-01T10:00:00.000Z"),
      },
      {
        kind: "consult_review",
        publicStatus: "approved",
        personaId: "meera-devi",
        rating: 4,
        reviewText: "Useful.",
        createdAt: new Date("2026-05-02T10:00:00.000Z"),
      },
      {
        kind: "consult_review",
        publicStatus: "pending_review",
        personaId: "meera-devi",
        rating: 1,
      },
      {
        kind: "consult_review",
        publicStatus: "approved",
        personaId: "arjun-sharma",
        rating: 3,
      },
    ],
    predictionFeedbackRecords: [],
  });

  assert.deepEqual(summary.personaReviewStats, [
    { personaId: "meera-devi", averageRating: 4.5, reviewCount: 2 },
    { personaId: "arjun-sharma", averageRating: 3, reviewCount: 1 },
  ]);
});

test("buildTrustModerationDecision creates an approved moderation patch", () => {
  const decision = buildTrustModerationDecision(
    {
      action: "approve",
      moderationId: "mod_123",
      note: "Checked source session.",
    },
    { uid: "admin_1", email: "admin@example.com" },
    createdAt,
  );

  assert.equal(decision.moderationId, "mod_123");
  assert.equal(decision.publicStatus, "approved");
  assert.equal(decision.patch.publicStatus, "approved");
  assert.equal(decision.patch.reviewedBy.email, "admin@example.com");
  assert.equal(decision.patch.moderationNote, "Checked source session.");
});

test("buildTrustModerationDecision rejects unsupported decisions", () => {
  assert.throws(
    () =>
      buildTrustModerationDecision(
        { action: "publish", moderationId: "mod_123" },
        { uid: "admin_1", email: "admin@example.com" },
        createdAt,
      ),
    /approve or reject/,
  );
});
