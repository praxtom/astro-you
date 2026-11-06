import { sanitizePromptText } from "./sanitize.js";

/**
 * SSE helpers for /api/synthesis.
 *
 * The client parser only acts on lines starting with "data: ", so SSE comment
 * lines (starting with ":") are ignored by it while still pushing bytes through
 * the CDN/gateway. Without early bytes the edge returned a 504 "Inactivity
 * Timeout" page when the model was slow to emit its first token.
 */
export const SSE_OPEN_COMMENT = ": open\n\n";
export const SSE_KEEPALIVE_COMMENT = ": keepalive\n\n";

/** Interval between keepalive comments while the stream is open. */
export const SYNTHESIS_KEEPALIVE_MS = 8_000;
/** Max wait for the model's first token before giving up cleanly. */
export const SYNTHESIS_FIRST_TOKEN_TIMEOUT_MS = 25_000;
/** Hard cap on the whole generation (first token through completion). */
export const SYNTHESIS_TOTAL_TIMEOUT_MS = 45_000;

export const SYNTHESIS_TIMEOUT_MESSAGE =
  "Synthesis is taking longer than usual right now. Your credit was not charged — please try again in a moment.";

export const TIMED_OUT = Symbol("timed_out");

/**
 * Races a promise against a timeout. Resolves to TIMED_OUT if `ms` elapses
 * first. The timer is always cleared so it never holds the event loop open.
 */
export async function raceWithTimeout<T>(
  promise: Promise<T>,
  ms: number,
): Promise<T | typeof TIMED_OUT> {
  if (ms <= 0) {
    // Swallow a late rejection so it doesn't surface as unhandled.
    promise.catch(() => undefined);
    return TIMED_OUT;
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<typeof TIMED_OUT>((resolve) => {
    timer = setTimeout(() => resolve(TIMED_OUT), ms);
  });
  try {
    const result = await Promise.race([promise, timeout]);
    if (result === TIMED_OUT) promise.catch(() => undefined);
    return result;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export const COMPATIBILITY_CONTEXT_MAX_CHARS = 2000;

/**
 * Sanitizes the optional compatibility reading summary the client attaches to
 * a synthesis request. Returns undefined when absent/empty.
 */
export function sanitizeCompatibilityContext(
  value: unknown,
): string | undefined {
  // sanitizePromptText appends "…" when truncating, so leave room for it.
  const cleaned = sanitizePromptText(
    value,
    COMPATIBILITY_CONTEXT_MAX_CHARS - 1,
  );
  return cleaned ? cleaned : undefined;
}
