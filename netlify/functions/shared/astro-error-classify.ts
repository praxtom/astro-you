/**
 * Upstream chart failures worth telling the user apart.
 *
 * `dst_ambiguous` is the one that matters internationally: a local birth time
 * that either never existed (the spring-forward gap) or happened twice (the
 * fall-back hour) makes the upstream ephemeris reject the request with a 422.
 * Retrying can never succeed, so the generic "please try again" message is a
 * dead end. India has never observed DST, so this class of failure is
 * unreachable for Indian births — which is why it went unnoticed.
 *
 * Verified against the live API: Denver 2020-03-08 02:30 and 2020-11-01 01:30
 * both return 422 with error_code CHART_CALCULATION_ERROR.
 */
export type UpstreamChartErrorKind =
  "dst_ambiguous" | "location_unresolved" | "unknown";

export function classifyUpstreamChartError(
  status: number,
  body: string,
): UpstreamChartErrorKind {
  if (status !== 422) return "unknown";

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return "unknown";
  }

  const detail = (parsed as { detail?: unknown } | null)?.detail;

  // Pydantic validation errors arrive as an array of issues.
  if (Array.isArray(detail)) {
    const joined = detail
      .map((issue) => String((issue as { msg?: unknown })?.msg ?? ""))
      .join(" ");
    return /location is required/i.test(joined)
      ? "location_unresolved"
      : "unknown";
  }

  const code = (detail as { error?: { error_code?: unknown } } | null)?.error
    ?.error_code;
  return code === "CHART_CALCULATION_ERROR" ? "dst_ambiguous" : "unknown";
}
