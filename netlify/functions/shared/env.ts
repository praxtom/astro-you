export interface RuntimeEnv {
  [key: string]: string | undefined;
}

export function resolveAstrologyApiKey(env: RuntimeEnv = process.env) {
  return firstConfiguredEnv(env, ["ASTROLOGY_API_KEY", "ASTROYOU_API_KEY"]);
}

export function resolveGeminiApiKey(env: RuntimeEnv = process.env) {
  return firstConfiguredEnv(env, ["GEMINI_API_KEY", "ASTROYOU_API_KEY"]);
}

export function resolveResendApiKey(env: RuntimeEnv = process.env) {
  return firstConfiguredEnv(env, ["RESEND_API_KEY", "ASTROYOU_API_KEY"]);
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
