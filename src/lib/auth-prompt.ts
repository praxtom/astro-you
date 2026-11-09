/**
 * One app-wide way to ask a guest to sign in.
 *
 * Any page inside AppFrame can call `requestSignIn()`; AppFrame listens for the
 * event, opens the shared AuthModal and, after a successful sign-in, sends the
 * user to `returnTo` (or leaves them where they are). The target survives the
 * full-page Google redirect fallback through sessionStorage.
 *
 * Returns false when nothing handled the request (e.g. a standalone page with
 * no AppFrame), so callers can fall back to their own path.
 */
export const AUTH_PROMPT_EVENT = "astroyou:auth-prompt";
const RETURN_TO_KEY = "astroyou_auth_return_to";
/** A stored target older than this is stale (abandoned redirect). */
const RETURN_TO_TTL_MS = 10 * 60 * 1000;

export interface SignInRequest {
  /** In-app path (with query) to land on after sign-in. Defaults to staying put. */
  returnTo?: string;
  title?: string;
  message?: string;
  /**
   * Runs after a successful sign-in in this page session (popup or email
   * code). Not called after the full-page redirect fallback — use returnTo
   * for anything that must survive a reload.
   */
  onSuccess?: () => void;
}

export function requestSignIn(request: SignInRequest = {}): boolean {
  const event = new CustomEvent<SignInRequest>(AUTH_PROMPT_EVENT, {
    detail: request,
    cancelable: true,
  });
  // The listener calls preventDefault() to say "handled".
  return !window.dispatchEvent(event);
}

/** Only same-origin app paths are accepted — never an absolute URL. */
export function isSafeReturnPath(path: unknown): path is string {
  return (
    typeof path === "string" && path.startsWith("/") && !path.startsWith("//")
  );
}

export function storeReturnTo(path: string): void {
  try {
    sessionStorage.setItem(
      RETURN_TO_KEY,
      JSON.stringify({ path, at: Date.now() }),
    );
  } catch {
    /* storage blocked: the in-memory copy still covers the popup flow */
  }
}

export function clearReturnTo(): void {
  try {
    sessionStorage.removeItem(RETURN_TO_KEY);
  } catch {
    /* ignore */
  }
}

/** Reads and clears the stored target. */
export function takeReturnTo(): string | null {
  let raw: string | null;
  try {
    raw = sessionStorage.getItem(RETURN_TO_KEY);
  } catch {
    return null;
  }
  clearReturnTo();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { path?: unknown; at?: unknown };
    if (
      typeof parsed.at !== "number" ||
      Date.now() - parsed.at > RETURN_TO_TTL_MS
    ) {
      return null;
    }
    return isSafeReturnPath(parsed.path) ? parsed.path : null;
  } catch {
    return null;
  }
}
