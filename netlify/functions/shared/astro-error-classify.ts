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
  "dst_ambiguous" | "location_unresolved" | "quota_exhausted" | "unknown";

/**
 * Upstream quota exhaustion, as returned when the astrology-API allowance for
 * the billing period runs out:
 *
 *   HTTP 429
 *   {"success":false,"error":{"error_code":"RATE_LIMIT_EXCEEDED",
 *    "message":"Quota exceeded for this billing period", ...}}
 *
 * This is *our* billing problem, not the user's — retrying immediately cannot
 * help, and it must not be reported as a generic 500 "please try again", which
 * hides an outage that needs an operator. Only a 429 counts: the same
 * error_code on a 422 is a different (per-request) rejection.
 */
const QUOTA_MARKER = /RATE_LIMIT_EXCEEDED|quota exceeded/i;

export function classifyUpstreamChartError(
  status: number,
  body: string,
): UpstreamChartErrorKind {
  if (status === 429) {
    return QUOTA_MARKER.test(body) ? "quota_exhausted" : "unknown";
  }
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

/**
 * Classify from a thrown Error's message.
 *
 * Every astro-api wrapper now throws the structured `AstroChartError`, so
 * callers should read `kind` off the error first. This message-parsing
 * fallback is kept for class-identity safety: `instanceof`/`name` checks can
 * fail when the class is duplicated across bundles (a function bundling its
 * own copy of shared/astro-api.ts), and errors that cross a serialization
 * boundary arrive as plain Errors. The message stays formatted as
 * `<Label> error: <status> - <body>` (see shared/astro-api.ts), so the status
 * and body can always be recovered from that string.
 */
export function classifyUpstreamErrorMessage(
  message: unknown,
): UpstreamChartErrorKind {
  if (typeof message !== "string") return "unknown";
  const match = /error:\s*(\d{3})\s*-\s*([\s\S]*)$/.exec(message);
  if (!match) return "unknown";
  return classifyUpstreamChartError(Number(match[1]), match[2]);
}
