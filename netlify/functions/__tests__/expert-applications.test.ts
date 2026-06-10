import test from "node:test";
import assert from "node:assert/strict";
import {
  ExpertApplicationError,
  buildExpertApplicationReviewDecision,
  buildExpertApplicationRecord,
} from "../shared/expert-applications.js";

test("buildExpertApplicationRecord creates a server-owned application", () => {
  const record = buildExpertApplicationRecord(
    {
      fullName: "  Kavita Sharma  ",
      email: "KAVITA@example.com",
      phone: "9999999999",
      city: "Jaipur",
      languages: ["Hindi", "English", "Hindi"],
      specialties: ["Vedic", "Marriage"],
      experienceYears: 8,
      bio: "Traditional jyotish practice.",
      sampleApproach: "I explain chart timing with practical steps.",
    },
    "server-timestamp",
  );

  assert.equal(record.fullName, "Kavita Sharma");
  assert.equal(record.email, "kavita@example.com");
  assert.deepEqual(record.languages, ["Hindi", "English"]);
  assert.equal(record.status, "submitted");
  assert.equal(record.reviewStage, "intake");
  assert.equal(record.createdAt, "server-timestamp");
});

test("buildExpertApplicationReviewDecision approves applications for listing setup", () => {
  const decision = buildExpertApplicationReviewDecision(
    {
      applicationId: "application_123",
      status: "approved",
      note: "Strong sample guidance and verified background.",
    },
    { uid: "admin_1", email: "admin@example.com" },
    "server-timestamp",
  );

  assert.equal(decision.applicationId, "application_123");
  assert.equal(decision.patch.status, "approved");
  assert.equal(decision.patch.reviewStage, "listing_setup");
  assert.equal(decision.patch.reviewNote, "Strong sample guidance and verified background.");
  assert.equal(decision.patch.reviewedBy.uid, "admin_1");
  assert.equal(decision.patch.approvedAt, "server-timestamp");
});

test("buildExpertApplicationReviewDecision rejects invalid review status", () => {
  assert.throws(
    () =>
      buildExpertApplicationReviewDecision(
        {
          applicationId: "application_123",
          status: "published",
        },
        { uid: "admin_1", email: "admin@example.com" },
        "server-timestamp",
      ),
    (error: unknown) => {
      const err = error as ExpertApplicationError;
      return (
        error instanceof ExpertApplicationError &&
        err.status === 400 &&
        /status/i.test(err.message)
      );
    },
  );
});

test("buildExpertApplicationRecord rejects incomplete applications", () => {
  assert.throws(
    () =>
      buildExpertApplicationRecord(
        {
          fullName: "A",
          email: "bad",
          languages: [],
          specialties: [],
          experienceYears: -1,
        },
        "server-timestamp",
      ),
    (error: unknown) => {
      const err = error as ExpertApplicationError;
      return (
        error instanceof ExpertApplicationError &&
        err.status === 400 &&
        /full name/i.test(err.message)
      );
    },
  );
});
