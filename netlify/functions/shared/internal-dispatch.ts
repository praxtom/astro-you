import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Server-to-server dispatch into our own Netlify background functions.
 *
 * Background functions (`*-background.ts`) answer 202 immediately and run for
 * up to 15 minutes, so slow, best-effort work (memory analysis, summaries,
 * Gemini interaction purges) never sits on a user-facing response path.
 * They are publicly routable, so every call carries a shared internal secret.
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

export function isAuthorizedInternalRequest(
  req: Request,
  env: Env = process.env,
): boolean {
  const secret = resolveInternalSecret(env);
  const provided = req.headers.get(INTERNAL_AUTH_HEADER) || "";
  if (!secret || !provided) return false;
  const a = Buffer.from(secret);
  const b = Buffer.from(provided);
  return a.length === b.length && timingSafeEqual(a, b);
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
  const origin = resolveInternalOrigin(env, options.requestUrl);
  if (!secret || !origin || !functionName.endsWith("-background")) return false;
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
