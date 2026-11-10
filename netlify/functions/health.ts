import { Config, Context } from "@netlify/functions";
import { assessJobFreshness } from "./shared/ops-alerts";

/**
 * Public liveness/readiness probe for uptime monitors (e.g. Netlify/UptimeRobot).
 *
 * Reports whether the critical server credentials are configured, WITHOUT
 * touching upstream services or leaking any secret values — just booleans, so a
 * misconfigured deploy is visible without a paid probe or a signed-in user.
 *
 * `jobsFresh` is false when any scheduled job that records `jobRuns/{job}` has
 * not succeeded within 2× its schedule (null when it could not be checked).
 * The Firestore read is cached per instance for a minute so a public probe
 * cannot be used to run up read costs.
 *
 * 200 when everything is fine; 503 when a required credential is missing or a
 * job is stale.
 */

const JOBS_CACHE_MS = 60_000;
let jobsCache: { at: number; fresh: boolean | null; stale: string[] } | null =
  null;

async function checkJobsFresh(): Promise<{
  fresh: boolean | null;
  stale: string[];
}> {
  if (jobsCache && Date.now() - jobsCache.at < JOBS_CACHE_MS) {
    return { fresh: jobsCache.fresh, stale: jobsCache.stale };
  }
  let result: { fresh: boolean | null; stale: string[] };
  try {
    // Lazy: a missing/invalid service account must not crash the probe.
    const { db } = await import("./shared/firebase-admin");
    const snap = await db.collection("jobRuns").limit(50).get();
    const stale = assessJobFreshness(
      snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
    )
      .filter((job) => job.stale)
      .map((job) => job.job);
    result = { fresh: stale.length === 0, stale };
  } catch {
    result = { fresh: null, stale: [] };
  }
  jobsCache = { at: Date.now(), ...result };
  return result;
}

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
    // Email OTP sign-in and the digest both need Resend plus a verified sender.
    email: Boolean(
      process.env.RESEND_API_KEY?.trim() &&
      process.env.DIGEST_FROM_EMAIL?.trim(),
    ),
  };

  // Load the in-house astrology engine. Every chart and chat function imports
  // it, so a load failure here means they are all down even though the env
  // looks complete (this is exactly how a packaging bug once went unnoticed).
  try {
    await import("./shared/astro-engine");
    required.astroEngine = true;
  } catch (err) {
    console.error("[Health] astro engine failed to load:", err);
    required.astroEngine = false;
  }

  const jobs = required.firebaseAdmin
    ? await checkJobsFresh()
    : { fresh: null, stale: [] as string[] };
  const ok = Object.values(required).every(Boolean) && jobs.fresh !== false;

  return new Response(
    JSON.stringify({
      status: ok ? "ok" : "degraded",
      checks: { ...required, jobsFresh: jobs.fresh },
      staleJobs: jobs.stale,
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
