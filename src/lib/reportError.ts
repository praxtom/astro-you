/**
 * Client-side error reporting shim.
 *
 * Sentry-ready but with NO hard dependency: if a Sentry SDK has been installed
 * and initialized (exposing `window.Sentry`) it forwards there; otherwise it
 * logs a structured error to the console. To enable real reporting, install
 * `@sentry/react`, call `Sentry.init({ dsn: import.meta.env.VITE_SENTRY_DSN })`
 * in main.tsx, and this function will start forwarding automatically.
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
