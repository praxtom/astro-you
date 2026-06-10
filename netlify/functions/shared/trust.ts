export type TrustTimestamp = unknown;
export type PredictionFeedbackSignal = "accurate" | "partly" | "missed";
export type ForecastPeriod = "daily" | "weekly" | "monthly" | "yearly";

export class TrustRecordError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "TrustRecordError";
    this.status = status;
  }
}

interface Actor {
  uid: string;
  email?: string | null;
}

interface ConsultReviewPayload {
  personaId?: unknown;
  sessionId?: unknown;
  rating?: unknown;
  reviewText?: unknown;
  sharePublic?: unknown;
}

interface PredictionFeedbackPayload {
  source?: unknown;
  period?: unknown;
  forecastDate?: unknown;
  signal?: unknown;
  notes?: unknown;
}

interface TestimonialPayload {
  story?: unknown;
  publicName?: unknown;
  allowPublicUse?: unknown;
}

interface TrustModerationPayload {
  action?: unknown;
  moderationId?: unknown;
  note?: unknown;
}

interface TrustSummaryInput {
  moderationRecords: unknown[];
  predictionFeedbackRecords: unknown[];
}

function cleanString(value: unknown, max = 800): string {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ").slice(0, max);
}

function requireString(value: unknown, label: string, max = 160): string {
  const cleaned = cleanString(value, max);
  if (!cleaned) throw new TrustRecordError(`${label} is required`);
  return cleaned;
}

function normalizeRating(value: unknown): number {
  const rating = Number(value);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new TrustRecordError("A rating from 1 to 5 is required");
  }
  return rating;
}

function normalizePeriod(value: unknown): ForecastPeriod {
  if (
    value === "daily" ||
    value === "weekly" ||
    value === "monthly" ||
    value === "yearly"
  ) {
    return value;
  }
  throw new TrustRecordError("Forecast period is required");
}

function normalizeSignal(value: unknown): PredictionFeedbackSignal {
  if (value === "accurate" || value === "partly" || value === "missed") {
    return value;
  }
  throw new TrustRecordError("Prediction feedback signal is required");
}

function ensureActor(actor: Actor) {
  if (!actor.uid) throw new TrustRecordError("Authenticated user is required", 401);
}

export function buildConsultReviewRecord(
  payload: ConsultReviewPayload,
  actor: Actor,
  createdAt: TrustTimestamp,
) {
  ensureActor(actor);
  const sharePublic = payload.sharePublic === true;
  return {
    kind: "consult_review" as const,
    uid: actor.uid,
    email: actor.email || null,
    personaId: requireString(payload.personaId, "Persona", 80),
    sessionId: requireString(payload.sessionId, "Consultation session", 120),
    rating: normalizeRating(payload.rating),
    reviewText: cleanString(payload.reviewText, 1000),
    sharePublic,
    publicStatus: sharePublic ? "pending_review" : "private" as const,
    createdAt,
  };
}

export function buildPredictionFeedbackRecord(
  payload: PredictionFeedbackPayload,
  actor: Actor,
  createdAt: TrustTimestamp,
) {
  ensureActor(actor);
  return {
    kind: "prediction_feedback" as const,
    uid: actor.uid,
    email: actor.email || null,
    source: requireString(payload.source, "Feedback source", 80),
    period: normalizePeriod(payload.period),
    forecastDate: requireString(payload.forecastDate, "Forecast date", 40),
    signal: normalizeSignal(payload.signal),
    notes: cleanString(payload.notes, 1000),
    publicStatus: "aggregate_only" as const,
    createdAt,
  };
}

export function buildTestimonialSubmissionRecord(
  payload: TestimonialPayload,
  actor: Actor,
  createdAt: TrustTimestamp,
) {
  ensureActor(actor);
  const story = requireString(payload.story, "Testimonial story", 1200);
  if (story.length < 20) {
    throw new TrustRecordError("Testimonial story is too short");
  }
  const allowPublicUse = payload.allowPublicUse === true;
  return {
    kind: "testimonial" as const,
    uid: actor.uid,
    email: actor.email || null,
    story,
    publicName: cleanString(payload.publicName, 80) || "AstroYou user",
    allowPublicUse,
    publicStatus: allowPublicUse ? "pending_review" : "private" as const,
    createdAt,
  };
}

export function buildTrustSummary(input: TrustSummaryInput) {
  const moderationRecords = input.moderationRecords
    .map(asRecord)
    .filter((record): record is Record<string, unknown> => Boolean(record));
  const feedbackRecords = input.predictionFeedbackRecords
    .map(asRecord)
    .filter((record): record is Record<string, unknown> => Boolean(record));

  const approved = moderationRecords.filter((record) => isApproved(record.publicStatus));
  const pendingPublicSubmissions = moderationRecords.filter(
    (record) => record.publicStatus === "pending_review",
  ).length;

  const approvedTestimonials = approved
    .filter((record) => record.kind === "testimonial")
    .sort(sortTrustRecordsNewestFirst)
    .map((record) => ({
      publicName: cleanString(record.publicName, 80) || "AstroYou user",
      story: cleanString(record.story, 280),
      createdAt: normalizeTrustDate(record.createdAt),
    }))
    .filter((record) => record.story.length > 0);

  const testimonials = approvedTestimonials.slice(0, 6);

  const approvedConsultReviews = approved.filter(
    (record) => record.kind === "consult_review",
  );

  const personaReviewStats = buildPersonaReviewStats(approvedConsultReviews);

  const approvedReviewSummaries = approvedConsultReviews
    .sort(sortTrustRecordsNewestFirst)
    .map((record) => ({
      personaId: cleanString(record.personaId, 80),
      rating: Number(record.rating),
      reviewText: cleanString(record.reviewText, 240),
      createdAt: normalizeTrustDate(record.createdAt),
    }))
    .filter((record) => Number.isInteger(record.rating) && record.rating >= 1 && record.rating <= 5);

  const reviews = approvedReviewSummaries.slice(0, 6);

  const predictionFeedback = feedbackRecords.reduce<{
    accurate: number;
    partly: number;
    missed: number;
  }>(
    (acc, record) => {
      if (record.signal === "accurate") acc.accurate += 1;
      if (record.signal === "partly") acc.partly += 1;
      if (record.signal === "missed") acc.missed += 1;
      return acc;
    },
    { accurate: 0, partly: 0, missed: 0 },
  );
  const feedbackTotal =
    predictionFeedback.accurate + predictionFeedback.partly + predictionFeedback.missed;

  return {
    totals: {
      approvedTestimonials: approvedTestimonials.length,
      approvedReviews: approvedReviewSummaries.length,
      pendingPublicSubmissions,
      publicProofItems: approvedTestimonials.length + approvedReviewSummaries.length,
    },
    personaReviewStats,
    predictionFeedback: {
      ...predictionFeedback,
      total: feedbackTotal,
      helpfulRate:
        feedbackTotal > 0
          ? Math.round(((predictionFeedback.accurate + predictionFeedback.partly) / feedbackTotal) * 100)
          : null,
    },
    testimonials,
    reviews,
    transparency: {
      aiAstrologersLabelled: true,
      fakeReviewsAllowed: false,
      fakeTestimonialsAllowed: false,
      predictionFeedbackAggregateOnly: true,
      humanExpertClaimsRequireVerification: true,
    },
  };
}

export function buildTrustModerationDecision(
  payload: TrustModerationPayload,
  admin: Actor,
  reviewedAt: TrustTimestamp,
) {
  ensureActor(admin);
  const moderationId = requireString(payload.moderationId, "Moderation record", 160);
  if (payload.action !== "approve" && payload.action !== "reject") {
    throw new TrustRecordError("Moderation action must be approve or reject");
  }
  const publicStatus = payload.action === "approve" ? "approved" : "rejected";
  const moderationNote = cleanString(payload.note, 500);

  return {
    moderationId,
    publicStatus,
    patch: {
      publicStatus,
      reviewedAt,
      reviewedBy: {
        uid: admin.uid,
        email: admin.email || null,
      },
      moderationNote,
    },
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function isApproved(value: unknown) {
  return value === "approved" || value === "published";
}

function normalizeTrustDate(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "toDate" in value) {
    const date = (value as { toDate?: () => Date }).toDate?.();
    if (date instanceof Date && !Number.isNaN(date.getTime())) return date.toISOString();
  }
  return null;
}

function sortTrustRecordsNewestFirst(
  left: Record<string, unknown>,
  right: Record<string, unknown>,
) {
  return trustDateMs(right.createdAt) - trustDateMs(left.createdAt);
}

function trustDateMs(value: unknown) {
  const normalized = normalizeTrustDate(value);
  if (!normalized) return 0;
  const time = new Date(normalized).getTime();
  return Number.isFinite(time) ? time : 0;
}

function buildPersonaReviewStats(records: Record<string, unknown>[]) {
  const grouped = new Map<string, { ratingTotal: number; reviewCount: number }>();

  records.forEach((record) => {
    const personaId = cleanString(record.personaId, 80);
    const rating = Number(record.rating);
    if (!personaId || !Number.isInteger(rating) || rating < 1 || rating > 5) return;

    const current = grouped.get(personaId) || { ratingTotal: 0, reviewCount: 0 };
    current.ratingTotal += rating;
    current.reviewCount += 1;
    grouped.set(personaId, current);
  });

  return Array.from(grouped.entries())
    .map(([personaId, value]) => ({
      personaId,
      averageRating: roundToOneDecimal(value.ratingTotal / value.reviewCount),
      reviewCount: value.reviewCount,
    }))
    .sort((left, right) => {
      if (right.reviewCount !== left.reviewCount) {
        return right.reviewCount - left.reviewCount;
      }
      if (right.averageRating !== left.averageRating) {
        return right.averageRating - left.averageRating;
      }
      return left.personaId.localeCompare(right.personaId);
    });
}

function roundToOneDecimal(value: number) {
  return Math.round(value * 10) / 10;
}
