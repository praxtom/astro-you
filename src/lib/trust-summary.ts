export interface PublicTrustSummary {
  totals?: {
    approvedTestimonials?: number;
    approvedReviews?: number;
    pendingPublicSubmissions?: number;
    publicProofItems?: number;
  };
  personaReviewStats?: PersonaReviewStat[];
  reviews?: PersonaTrustReview[];
  predictionFeedback?: {
    accurate?: number;
    partly?: number;
    missed?: number;
    total?: number;
    helpfulRate?: number | null;
  };
}

export interface PersonaReviewStat {
  personaId?: string;
  averageRating?: number;
  reviewCount?: number;
}

export interface PersonaTrustReview {
  personaId?: string;
  rating?: number;
}

export interface TrustProofMetric {
  label: string;
  value: string;
}

export interface PersonaTrustDisplay {
  hasApprovedReviews: boolean;
  ratingLabel: string;
  reviewLabel: string;
}

export function getTrustProofMetrics(summary: PublicTrustSummary | null): TrustProofMetric[] {
  return [
    {
      label: "Approved stories",
      value: formatTrustCount(summary?.totals?.approvedTestimonials),
    },
    {
      label: "Approved reviews",
      value: formatTrustCount(summary?.totals?.approvedReviews),
    },
    {
      label: "Helpful feedback",
      value:
        typeof summary?.predictionFeedback?.helpfulRate === "number"
          ? `${summary.predictionFeedback.helpfulRate}%`
          : "Collecting",
    },
  ];
}

export function getPersonaTrustDisplay(
  summary: PublicTrustSummary | null,
  personaId: string,
): PersonaTrustDisplay {
  const stat = getPersonaReviewStat(summary, personaId);

  if (!stat || stat.reviewCount < 1) {
    return {
      hasApprovedReviews: false,
      ratingLabel: "Collecting",
      reviewLabel: "No approved reviews yet",
    };
  }

  return {
    hasApprovedReviews: true,
    ratingLabel: stat.averageRating.toFixed(1),
    reviewLabel: `${stat.reviewCount} approved ${stat.reviewCount === 1 ? "review" : "reviews"}`,
  };
}

function formatTrustCount(value?: number) {
  return typeof value === "number" && value > 0 ? String(value) : "Collecting";
}

function getPersonaReviewStat(
  summary: PublicTrustSummary | null,
  personaId: string,
): { averageRating: number; reviewCount: number } | null {
  const targetId = personaId.trim();
  if (!targetId) return null;

  const direct = summary?.personaReviewStats?.find((item) => item.personaId === targetId);
  if (
    direct &&
    typeof direct.averageRating === "number" &&
    typeof direct.reviewCount === "number" &&
    direct.averageRating >= 1 &&
    direct.averageRating <= 5 &&
    direct.reviewCount > 0
  ) {
    return {
      averageRating: direct.averageRating,
      reviewCount: direct.reviewCount,
    };
  }

  const reviews = summary?.reviews?.filter(
    (item) =>
      item.personaId === targetId &&
      typeof item.rating === "number" &&
      item.rating >= 1 &&
      item.rating <= 5,
  );

  if (!reviews?.length) return null;

  const averageRating =
    reviews.reduce((total, item) => total + Number(item.rating), 0) / reviews.length;
  return {
    averageRating: Math.round(averageRating * 10) / 10,
    reviewCount: reviews.length,
  };
}
