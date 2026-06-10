import test from "node:test";
import assert from "node:assert/strict";
import {
  getPersonaTrustDisplay,
  getTrustProofMetrics,
} from "../../../src/lib/trust-summary.js";

test("getTrustProofMetrics formats public trust summary for decision pages", () => {
  const metrics = getTrustProofMetrics({
    totals: {
      approvedTestimonials: 3,
      approvedReviews: 8,
      pendingPublicSubmissions: 2,
      publicProofItems: 11,
    },
    predictionFeedback: {
      accurate: 5,
      partly: 3,
      missed: 2,
      total: 10,
      helpfulRate: 80,
    },
  });

  assert.deepEqual(metrics, [
    { label: "Approved stories", value: "3" },
    { label: "Approved reviews", value: "8" },
    { label: "Helpful feedback", value: "80%" },
  ]);
});

test("getTrustProofMetrics avoids fake-looking zero proof claims while collecting", () => {
  const metrics = getTrustProofMetrics(null);

  assert.deepEqual(metrics, [
    { label: "Approved stories", value: "Collecting" },
    { label: "Approved reviews", value: "Collecting" },
    { label: "Helpful feedback", value: "Collecting" },
  ]);
});

test("getPersonaTrustDisplay formats approved persona review proof", () => {
  const display = getPersonaTrustDisplay(
    {
      personaReviewStats: [
        { personaId: "meera-devi", averageRating: 4.5, reviewCount: 2 },
      ],
    },
    "meera-devi",
  );

  assert.deepEqual(display, {
    hasApprovedReviews: true,
    ratingLabel: "4.5",
    reviewLabel: "2 approved reviews",
  });
});

test("getPersonaTrustDisplay avoids invented proof when no reviews are approved", () => {
  const display = getPersonaTrustDisplay(null, "meera-devi");

  assert.deepEqual(display, {
    hasApprovedReviews: false,
    ratingLabel: "Collecting",
    reviewLabel: "No approved reviews yet",
  });
});
