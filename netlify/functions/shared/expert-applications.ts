export class ExpertApplicationError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
    this.name = "ExpertApplicationError";
  }
}

export interface ExpertApplicationPayload {
  fullName?: unknown;
  email?: unknown;
  phone?: unknown;
  city?: unknown;
  languages?: unknown;
  specialties?: unknown;
  experienceYears?: unknown;
  bio?: unknown;
  sampleApproach?: unknown;
}

export type ExpertApplicationReviewStatus =
  | "under_review"
  | "approved"
  | "rejected"
  | "waitlisted";

export interface ExpertApplicationReviewer {
  uid: string;
  email: string;
}

export interface ExpertApplicationReviewInput {
  applicationId?: unknown;
  status?: unknown;
  note?: unknown;
}

export interface ExpertApplicationReviewPatch {
  status: ExpertApplicationReviewStatus;
  reviewStage: "intake" | "review" | "listing_setup" | "closed";
  reviewNote: string;
  reviewedBy: ExpertApplicationReviewer;
  updatedAt: unknown;
  approvedAt?: unknown;
  rejectedAt?: unknown;
}

const REVIEW_STATUSES: ExpertApplicationReviewStatus[] = [
  "under_review",
  "approved",
  "rejected",
  "waitlisted",
];

export function buildExpertApplicationRecord(
  payload: ExpertApplicationPayload,
  createdAt: unknown,
) {
  const fullName = cleanString(payload.fullName, 80);
  if (fullName.length < 2) {
    throw new ExpertApplicationError("Full name is required");
  }

  const email = cleanString(payload.email, 120).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ExpertApplicationError("Valid email is required");
  }

  const languages = uniqueStrings(payload.languages, 8, 40);
  if (languages.length === 0) {
    throw new ExpertApplicationError("At least one language is required");
  }

  const specialties = uniqueStrings(payload.specialties, 8, 48);
  if (specialties.length === 0) {
    throw new ExpertApplicationError("At least one specialty is required");
  }

  const experienceYears = Number(payload.experienceYears);
  if (!Number.isFinite(experienceYears) || experienceYears < 0 || experienceYears > 80) {
    throw new ExpertApplicationError("Valid experience is required");
  }

  return {
    fullName,
    email,
    phone: cleanString(payload.phone, 40),
    city: cleanString(payload.city, 80),
    languages,
    specialties,
    experienceYears: Math.floor(experienceYears),
    bio: cleanString(payload.bio, 800),
    sampleApproach: cleanString(payload.sampleApproach, 1200),
    status: "submitted" as const,
    reviewStage: "intake" as const,
    createdAt,
    updatedAt: createdAt,
  };
}

export function buildExpertApplicationReviewDecision(
  input: ExpertApplicationReviewInput,
  reviewer: ExpertApplicationReviewer,
  updatedAt: unknown,
) {
  const applicationId = cleanString(input.applicationId, 160);
  if (!applicationId) {
    throw new ExpertApplicationError("Application id is required");
  }

  const status = cleanString(input.status, 40) as ExpertApplicationReviewStatus;
  if (!REVIEW_STATUSES.includes(status)) {
    throw new ExpertApplicationError("Valid review status is required");
  }

  const patch: ExpertApplicationReviewPatch = {
    status,
    reviewStage: getReviewStage(status),
    reviewNote: cleanString(input.note, 1000),
    reviewedBy: {
      uid: cleanString(reviewer.uid, 128),
      email: cleanString(reviewer.email, 160).toLowerCase(),
    },
    updatedAt,
  };

  if (status === "approved") patch.approvedAt = updatedAt;
  if (status === "rejected") patch.rejectedAt = updatedAt;

  return {
    applicationId,
    patch,
  };
}

function getReviewStage(status: ExpertApplicationReviewStatus) {
  if (status === "under_review") return "review" as const;
  if (status === "approved") return "listing_setup" as const;
  return "closed" as const;
}

function cleanString(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, maxLength) : "";
}

function uniqueStrings(value: unknown, maxItems: number, maxLength: number) {
  if (!Array.isArray(value)) return [];
  const normalized = value
    .map((item) => cleanString(item, maxLength))
    .filter(Boolean);
  return Array.from(new Set(normalized)).slice(0, maxItems);
}
