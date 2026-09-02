/**
 * Client-side error reporting shim.
 *
 * No hard dependency on any SDK: if one has been initialized and published on
 * `window.Sentry` it forwards there; otherwise it logs a structured error to
 * the console.
 *
 * `src/main.tsx` does the wiring — when `VITE_SENTRY_DSN` is set it lazily
 * imports `@sentry/react`, calls `Sentry.init(...)` and assigns the module to
 * `window.Sentry`, at which point this function starts forwarding on its own.
 * With no DSN configured nothing is imported and this stays console-only.
 */
type SentryLike = {
  captureException: (error: unknown, context?: Record<string, unknown>) => void;
};

function getSentry(): SentryLike | null {
  const s = (globalThis as { Sentry?: SentryLike }).Sentry;
  return s && typeof s.captureException === "function" ? s : null;
}

export function reportError(
  error: unknown,
  context?: Record<string, unknown>,
): void {
  const sentry = getSentry();
  if (sentry) {
    try {
      sentry.captureException(error, context ? { extra: context } : undefined);
      return;
    } catch {
      /* fall through to console */
    }
  }
  // Structured console fallback so at least the browser console has it.
  console.error("[reportError]", error, context ?? "");
}
