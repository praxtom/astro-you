export interface RuntimeEnv {
  [key: string]: string | undefined;
}

// Each external service uses its own dedicated key. We intentionally do NOT
// share a single ASTROYOU_API_KEY fallback across Gemini / Resend, because a
// wrong-service key produces a silent 401 at call time instead of failing fast.
// ASTROYOU_API_KEY remains a legacy fallback only for the astrology API.
export function resolveAstrologyApiKey(env: RuntimeEnv = process.env) {
  return firstConfiguredEnv(env, ["ASTROLOGY_API_KEY", "ASTROYOU_API_KEY"]);
}

export function resolveGeminiApiKey(env: RuntimeEnv = process.env) {
  return firstConfiguredEnv(env, ["GEMINI_API_KEY"]);
}

export function resolveResendApiKey(env: RuntimeEnv = process.env) {
  return firstConfiguredEnv(env, ["RESEND_API_KEY"]);
}

export function getConfiguredAdminEmails(env: RuntimeEnv = process.env) {
  return (env.ASTROYOU_ADMIN_EMAILS || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function firstConfiguredEnv(env: RuntimeEnv, keys: string[]) {
  for (const key of keys) {
    const value = env[key]?.trim();
    if (value) return value;
  }
  return undefined;
}
