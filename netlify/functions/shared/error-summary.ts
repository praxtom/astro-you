/**
 * Log-safe error summary: kind / status / code only.
 *
 * Upstream wrapper errors embed the full response body (`... error: 422 - {…}`)
 * and request payloads can carry birth date/time/place. Those must never reach
 * function logs, so error logs use this instead of the raw error object.
 */
export interface ErrorSummary {
  kind: string;
  status?: number;
  code?: string;
}

export function describeError(err: unknown): ErrorSummary {
  if (!err || typeof err !== "object") {
    return { kind: typeof err };
  }
  const e = err as {
    name?: unknown;
    status?: unknown;
    statusCode?: unknown;
    code?: unknown;
    message?: unknown;
  };
  const summary: ErrorSummary = {
    kind: typeof e.name === "string" && e.name ? e.name : "Error",
  };
  const rawStatus =
    typeof e.status === "number"
      ? e.status
      : typeof e.statusCode === "number"
        ? e.statusCode
        : undefined;
  if (rawStatus !== undefined) {
    summary.status = rawStatus;
  } else if (typeof e.message === "string") {
    // Wrapper errors read "<Label> error: <status> - <body>"; keep the status.
    const m = /\b([1-5]\d{2})\b/.exec(e.message.split(" - ")[0] ?? "");
    if (m) summary.status = Number(m[1]);
  }
  if (typeof e.code === "string" || typeof e.code === "number") {
    summary.code = String(e.code).slice(0, 64);
  }
  return summary;
}
