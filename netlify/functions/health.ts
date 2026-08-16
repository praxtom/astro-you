import { Config, Context } from "@netlify/functions";

/**
 * Public liveness/readiness probe for uptime monitors (e.g. Netlify/UptimeRobot).
 *
 * Reports whether the critical server credentials are configured, WITHOUT
 * touching upstream services or leaking any secret values — just booleans, so a
 * misconfigured deploy is visible without a paid probe or a signed-in user.
 * Always returns 200 for "up"; 503 when a required credential is missing.
 */
export default async (_req: Request, _context: Context) => {
  const required: Record<string, boolean> = {
    firebaseAdmin: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT),
    gemini: Boolean(process.env.GEMINI_API_KEY),
    // Mirror resolveAstrologyApiKey() — the app accepts either name, so the
    // probe must check both or it false-reports "degraded" while the feature works.
    astrologyApi: Boolean(
      process.env.ASTROLOGY_API_KEY || process.env.ASTROYOU_API_KEY,
    ),
    razorpay: Boolean(
      process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET,
    ),
    otpSecret: Boolean(process.env.OTP_HASH_SECRET),
  };

  const ok = Object.values(required).every(Boolean);

  return new Response(
    JSON.stringify({
      status: ok ? "ok" : "degraded",
      checks: required,
      time: new Date().toISOString(),
    }),
    {
      status: ok ? 200 : 503,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    },
  );
};

export const config: Config = { path: "/api/health" };
