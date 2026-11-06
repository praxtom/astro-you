/**
 * Map a failed /api/kundali chart calculation to a user-actionable response.
 *
 * Pure (no Firebase import) so it can be unit-tested; kundali.ts uses it in
 * its catch block. A birth time in a DST gap, a chart the upstream could not
 * calculate, or a place it could not resolve will never succeed on retry, so
 * they get a 422 with specific copy instead of a generic 500 "try again".
 */
import {
  chartErrorUserMessage,
  classifyUpstreamErrorMessage,
  type UpstreamChartErrorKind,
} from "./astro-error-classify.js";

export interface ChartErrorResponse {
  status: number;
  body: { error: string; code: string };
}

/** The classified kind of a thrown chart error (structured first, then message). */
export function chartErrorKind(error: any): UpstreamChartErrorKind {
  return error?.name === "AstroChartError" && typeof error.kind === "string"
    ? (error.kind as UpstreamChartErrorKind)
    : classifyUpstreamErrorMessage(error?.message);
}

/**
 * The response for a non-retryable chart failure, or null when the caller
 * should fall through to its own handling (quota → 503, unknown → 500).
 */
export function chartErrorResponse(error: any): ChartErrorResponse | null {
  const kind = chartErrorKind(error);
  if (
    kind !== "dst_ambiguous" &&
    kind !== "chart_calculation_failed" &&
    kind !== "location_unresolved"
  ) {
    return null;
  }
  const message = chartErrorUserMessage(kind);
  if (!message) return null;
  return { status: 422, body: { error: message, code: kind } };
}

/** Copy for chart types that cannot be cast without an exact birth time. */
export const TIME_UNKNOWN_MESSAGE =
  "This chart needs an exact birth time. Add your birth time in your profile to unlock it.";
