import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Server-to-server dispatch into our own Netlify background functions.
 *
 * Background functions (`*-background.ts`) answer 202 immediately and run for
 * up to 15 minutes, so slow, best-effort work (memory analysis, summaries,
 * Gemini interaction purges) never sits on a user-facing response path.
 * They are publicly routable, so every call carries a shared internal secret.
 *
 * Configuration contract: the secret (INTERNAL_FUNCTION_SECRET, or the value
 * derived from OTP_HASH_SECRET) MUST be identical in every function — the
 * dispatcher and the background function each resolve it from the same
 * site-wide env vars, which Netlify injects into all functions of a deploy.
 * Netlify answers 202 for a background function BEFORE its code runs, so a
 * mismatch is invisible to the dispatcher; the background function logs it
 * (once per instance) instead. When no usable secret is configured at all,
 * dispatch is skipped and callers run the work inline (logged once).
 */

export const INTERNAL_AUTH_HEADER = "x-astroyou-internal";

type Env = Record<string, string | undefined>;

const MIN_SECRET_CHARS = 32;

/**
 * INTERNAL_FUNCTION_SECRET when configured; otherwise derived from
 * OTP_HASH_SECRET (already required for launch) so the feature works without
 * a new env var. Undefined when neither is strong enough — callers then fall
 * back to doing the work inline.
 */
export function resolveInternalSecret(
  env: Env = process.env,
): string | undefined {
  const explicit = env.INTERNAL_FUNCTION_SECRET?.trim();
  if (explicit && explicit.length >= MIN_SECRET_CHARS) return explicit;
  const base = env.OTP_HASH_SECRET?.trim();
  if (base && base.length >= MIN_SECRET_CHARS) {
    return createHmac("sha256", base)
      .update("astroyou:internal-functions:v1")
      .digest("hex");
  }
  return undefined;
}

const loggedOnce = new Set<string>();

function logOnce(key: string, log: () => void): void {
  if (loggedOnce.has(key)) return;
  loggedOnce.add(key);
  log();
}

/** Test hook: forget which one-time config warnings were already logged. */
export function resetInternalDispatchWarnings(): void {
  loggedOnce.clear();
}

/** Config sanity summary (no secret material). */
export function internalDispatchConfig(env: Env = process.env): {
  configured: boolean;
  source: "explicit" | "derived" | "none";
} {
  const explicit = env.INTERNAL_FUNCTION_SECRET?.trim();
  if (explicit && explicit.length >= MIN_SECRET_CHARS) {
    return { configured: true, source: "explicit" };
  }
  return resolveInternalSecret(env)
    ? { configured: true, source: "derived" }
    : { configured: false, source: "none" };
}

export function isAuthorizedInternalRequest(
  req: Request,
  env: Env = process.env,
): boolean {
  const secret = resolveInternalSecret(env);
  const provided = req.headers.get(INTERNAL_AUTH_HEADER) || "";
  if (!secret) {
    logOnce("receiver_unconfigured", () =>
      console.error(
        "[InternalDispatch] Background function has no internal secret (INTERNAL_FUNCTION_SECRET / OTP_HASH_SECRET unset or < 32 chars); rejecting internal jobs.",
      ),
    );
    return false;
  }
  if (!provided) return false;
  const a = Buffer.from(secret);
  const b = Buffer.from(provided);
  const ok = a.length === b.length && timingSafeEqual(a, b);
  if (!ok) {
    // The dispatcher already got a 202 and cannot see this — surface it here.
    logOnce("receiver_mismatch", () => {
      console.error(
        "[InternalDispatch] Internal secret mismatch: the dispatching function and this background function resolved different secrets. INTERNAL_FUNCTION_SECRET / OTP_HASH_SECRET must be identical across all functions.",
      );
      // Real runtime only (callers passing their own env are tests/tools).
      if (env === process.env) reportInternalAuthMismatch();
    });
  }
  return ok;
}

/**
 * Fire-and-forget ops alert, loaded lazily so this module never pulls in
 * Firebase Admin at import time. Never throws.
 */
function reportInternalAuthMismatch(): void {
  void import("./ops-alerts.js")
    .then(({ reportOpsEvent }) =>
      reportOpsEvent(
        "internal_auth_mismatch",
        { source: "internal-dispatch" },
        { severity: "critical", dedupeKey: "internal-dispatch" },
      ),
    )
    .catch(() => undefined);
}

/**
 * Where our own functions live. Never derived from the request's Host header
 * (a spoofed host would receive the secret and user data); only from Netlify's
 * runtime variables, or the request origin for local development.
 */
export function resolveInternalOrigin(
  env: Env = process.env,
  requestUrl?: string,
): string | undefined {
  for (const key of ["INTERNAL_FUNCTIONS_ORIGIN", "DEPLOY_URL", "URL"]) {
    const value = env[key]?.trim();
    if (value && /^https?:\/\//.test(value)) return value.replace(/\/+$/, "");
  }
  if (requestUrl) {
    try {
      const url = new URL(requestUrl);
      if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
        return url.origin;
      }
    } catch {
      // ignore malformed URL
    }
  }
  return undefined;
}

export interface DispatchOptions {
  env?: Env;
  requestUrl?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

/**
 * POST a job to a background function. Resolves true when it was accepted
 * (2xx); false on any failure so the caller can run the work inline instead.
 * Never throws.
 */
export async function dispatchBackgroundJob(
  functionName: string,
  payload: unknown,
  options: DispatchOptions = {},
): Promise<boolean> {
  const env = options.env ?? process.env;
  const secret = resolveInternalSecret(env);
  if (!secret) {
    logOnce("dispatcher_unconfigured", () =>
      console.warn(
        "[InternalDispatch] INTERNAL_FUNCTION_SECRET and OTP_HASH_SECRET are unset (or < 32 chars); background jobs will run inline.",
      ),
    );
    return false;
  }
  const origin = resolveInternalOrigin(env, options.requestUrl);
  if (!origin || !functionName.endsWith("-background")) return false;
  const fetchImpl = options.fetchImpl ?? fetch;
  try {
    const res = await fetchImpl(
      `${origin}/.netlify/functions/${functionName}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [INTERNAL_AUTH_HEADER]: secret,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(options.timeoutMs ?? 4_000),
      },
    );
    return res.status >= 200 && res.status < 300;
  } catch (err) {
    console.warn(
      `[InternalDispatch] ${functionName} dispatch failed:`,
      err instanceof Error ? err.name : "error",
    );
    return false;
  }
}
