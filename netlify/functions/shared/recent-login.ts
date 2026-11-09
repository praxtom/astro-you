/** A sign-in older than this cannot authorize account deletion. */
export const RECENT_LOGIN_MAX_AGE_SECONDS = 10 * 60;

/**
 * True when the token's last sign-in is recent enough for a sensitive action.
 * `auth_time` is seconds since epoch, set when the user last authenticated
 * (not when the ID token was refreshed). Allows 60s of clock skew.
 */
export function isRecentLogin(
  authTimeSeconds: unknown,
  nowMs = Date.now(),
  maxAgeSeconds = RECENT_LOGIN_MAX_AGE_SECONDS,
): boolean {
  if (
    typeof authTimeSeconds !== "number" ||
    !Number.isFinite(authTimeSeconds)
  ) {
    return false;
  }
  const ageSeconds = nowMs / 1000 - authTimeSeconds;
  return ageSeconds >= -60 && ageSeconds <= maxAgeSeconds;
}
