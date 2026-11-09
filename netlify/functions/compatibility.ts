import { Config, Context } from "@netlify/functions";
import { getCompatibilityDetails, getKundliMatching } from "./shared/astro-api";
import {
  attachPairManglik,
  normalizeMatchPayload,
  orientVedicPair,
} from "./shared/compatibility-payload.js";
import { generateCompatibilityNarrative } from "./shared/gemini";
import { buildUserContext } from "./shared/user-context";
import {
  verifyToken,
  enforceIpRateLimit,
  AuthError,
} from "./shared/require-auth";
import {
  reserveFeatureCredits,
  insufficientCreditsResponse,
  stableChargeKey,
  CreditError,
  type FeatureCharge,
} from "./shared/feature-credits";
import { requestedDateKey } from "./shared/request-date.js";
import {
  badInputResponse,
  birthInputError,
  chargeKeyCoord,
} from "./shared/charge-input.js";
import { describeError } from "./shared/error-summary.js";
import { createHash } from "node:crypto";
import { checkRateLimit, getRequestIdentifier } from "./shared/rate-limit";
import { getCachedOrFetch } from "./shared/cache";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

/**
 * The public Free Kundali Matching tool: Ashtakoot (Guna Milan) only — one
 * upstream call, no synastry, no narrative, no credits, no account. Budgeted
 * per IP and fail-closed, same as guest charts in kundali.ts: the limiter's
 * outage fallback reports `{ allowed: true, remaining: 0 }`, so denying
 * `remaining <= 0` (with the limit one above the real budget) also denies
 * during an outage. An unauthenticated paid-API path must never fail open.
 */
const FREE_MATCHES_PER_IP_PER_HOUR = 5;
/** Site-wide ceiling on upstream calls from the free tool, whatever the IPs. */
const FREE_MATCHES_PER_DAY = 500;
/** A repeated pair is served from cache and spends no budget. */
const FREE_MATCH_CACHE_HOURS = 24;

class FreeBudgetError extends Error {
  constructor(readonly status: 429 | 503) {
    super("Free match budget exhausted");
  }
}

/**
 * Rate-limit key for a client IP. IPv6 is grouped by /64 — one subscriber is
 * usually handed a whole /64, so per-address keys would let them rotate.
 */
export function freeMatchClientKey(ip: string): string {
  if (!ip.includes(":")) return ip;
  const [head, tail = ""] = ip.split("%")[0].split("::");
  const left = head ? head.split(":") : [];
  const right = ip.includes("::") && tail ? tail.split(":") : [];
  const groups = ip.includes("::")
    ? [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill("0"), ...right]
    : left;
  return `${groups
    .slice(0, 4)
    .map((g) => (parseInt(g, 16) || 0).toString(16))
    .join(":")}::/64`;
}

/** Fail-closed check: deny at `remaining <= 0` (see allowAnonRequest note). */
async function withinBudget(scope: string, key: string, budget: number, windowMs: number) {
  const result = await checkRateLimit({ scope, key, limit: budget + 1, windowMs });
  return result.allowed && result.remaining > 0;
}

/** Cache id: a hash, so birth details are not readable in document ids. */
function pairCacheId(a: Record<string, unknown>, b: Record<string, unknown>) {
  const pick = (p: Record<string, unknown>) =>
    [p.dob, p.tob, p.pob, p.lat, p.lng, p.gender].map((v) => String(v ?? "")).join("|");
  return createHash("sha256").update(`${pick(a)}#${pick(b)}`).digest("hex");
}

async function freeGunaMilan(
  req: Request,
  personA: Record<string, unknown>,
  personB: Record<string, unknown>,
): Promise<Response> {
  const inputError =
    birthInputError(personA, "Person 1") ?? birthInputError(personB, "Person 2");
  if (inputError) return badInputResponse(inputError);

  const vedicPair = orientVedicPair(personA, personB);
  let vedicMatching: unknown;
  try {
    // Budgets are spent only on a cache miss, i.e. a real upstream call.
    vedicMatching = await getCachedOrFetch(
      "match_cache",
      pairCacheId(personA, personB),
      async () => {
        const ipOk = await withinBudget(
          "compatibility_free",
          freeMatchClientKey(getRequestIdentifier(req)),
          FREE_MATCHES_PER_IP_PER_HOUR,
          60 * 60 * 1000,
        );
        if (!ipOk) throw new FreeBudgetError(429);
        const siteOk = await withinBudget(
          "compatibility_free_day",
          "all",
          FREE_MATCHES_PER_DAY,
          24 * 60 * 60 * 1000,
        );
        if (!siteOk) throw new FreeBudgetError(503);
        return getKundliMatching(vedicPair.groom as any, vedicPair.bride as any);
      },
      FREE_MATCH_CACHE_HOURS,
      { serialize: true },
    );
  } catch (err) {
    if (err instanceof FreeBudgetError) {
      return json(
        err.status === 429
          ? {
              error:
                "You've run several free matches in the last hour. Please try again a little later.",
              code: "free_match_limit",
            }
          : {
              error:
                "Free matching is very busy today. Please try again tomorrow.",
              code: "free_match_busy",
            },
        err.status,
      );
    }
    throw err;
  }
  if (!vedicMatching || typeof vedicMatching !== "object") {
    return json({ error: "Failed to fetch Guna Milan data" }, 502);
  }
  return json({
    vedicMatching: attachPairManglik(
      vedicMatching as Record<string, unknown>,
      vedicPair.groomIs,
    ),
    orientationAssumed: vedicPair.orientationAssumed,
  });
}

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let charge: FeatureCharge | null = null;
  try {
    const payload = await req.json();
    const { useVedicMatching, idToken, localDate } = payload;

    // personA/personB, with the gendered keys still accepted for older clients.
    let personA;
    let personB;
    try {
      ({ personA, personB } = normalizeMatchPayload(payload));
    } catch {
      return new Response(
        JSON.stringify({
          error: "Two birth charts are required for a compatibility match",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    if (payload.mode === "guna_milan") {
      return await freeGunaMilan(req, personA, personB);
    }

    // Auth + rate limit: matching calls the paid astrology API + Gemini.
    let decoded;
    try {
      decoded = await verifyToken(idToken);
      await enforceIpRateLimit(req, "compatibility", 30, 60 * 60 * 1000);
    } catch (err) {
      const status = err instanceof AuthError ? err.status : 401;
      return new Response(
        JSON.stringify({
          error:
            err instanceof AuthError ? err.message : "Authentication required",
        }),
        { status, headers: { "Content-Type": "application/json" } },
      );
    }

    // Validate BEFORE charging: input certain to fail upstream must be a
    // free 400, not a charge → error → refund cycle.
    const inputError =
      birthInputError(personA, "Person A") ?? birthInputError(personB, "Person B");
    if (inputError) return badInputResponse(inputError);

    // Synastry is a premium surface — reserve credits before the paid API
    // calls. Refunded below if matching yields no data or an error is thrown.
    // Keyed per pair per day so re-running the same match (retry, back-nav)
    // doesn't bill again — a NEW pair is a new charge.
    try {
      charge = await reserveFeatureCredits(
        decoded.uid,
        "compatibility",
        stableChargeKey(
          // The caller's local day, so "once per day" means their day.
          requestedDateKey(localDate),
          personA.dob,
          personA.tob,
          personA.pob,
          chargeKeyCoord(personA.lat),
          chargeKeyCoord(personA.lng),
          String((personA as { gender?: unknown }).gender ?? ""),
          personB.dob,
          personB.tob,
          personB.pob,
          chargeKeyCoord(personB.lat),
          chargeKeyCoord(personB.lng),
          String((personB as { gender?: unknown }).gender ?? ""),
        ),
      );
    } catch (err) {
      if (err instanceof CreditError) return insufficientCreditsResponse(err);
      throw err;
    }

    // Determine whether to include Vedic Kundli matching
    const shouldUseVedic =
      useVedicMatching === true ||
      (personA.dob && personA.tob && personB.dob && personB.tob);

    // Ashtakoot is asymmetric (groom vs bride slot): pick slots by gender,
    // not by entry order. Same/missing gender keeps entry order and is flagged.
    const vedicPair = orientVedicPair(personA, personB);

    // Build parallel promises
    const promises: [Promise<any>, Promise<any>] = [
      getCompatibilityDetails(personA, personB),
      shouldUseVedic
        ? getKundliMatching(vedicPair.groom, vedicPair.bride).catch((err) => {
            console.warn(
              "[Compatibility] Vedic matching failed (non-critical):",
              describeError(err),
            );
            return null;
          })
        : Promise.resolve(null),
    ];

    const [matchData, vedicMatching] = await Promise.all(promises);

    if (!matchData) {
      if (charge) await charge.refund();
      return new Response(
        JSON.stringify({ error: "Failed to fetch compatibility data" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    // Generate AI narrative interpretation of the compatibility scores
    let aiNarrative = "";
    try {
      const { userContext } = await buildUserContext({
        uid: decoded.uid,
        birthData: personA,
      });
      aiNarrative = await generateCompatibilityNarrative(
        matchData,
        personA.name || "Person 1",
        personB.name || "Person 2",
        userContext,
      );
      console.log("[Compatibility] AI narrative generated");
    } catch (err) {
      console.warn(
        "[Compatibility] AI narrative failed (non-critical):",
        describeError(err),
      );
    }

    return new Response(
      JSON.stringify({
        ...matchData,
        aiNarrative,
        ...(vedicMatching && typeof vedicMatching === "object"
          ? {
              vedicMatching: attachPairManglik(
                vedicMatching,
                vedicPair.groomIs,
              ),
              orientationAssumed: vedicPair.orientationAssumed,
            }
          : {}),
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error: any) {
    console.error("[Compatibility] Error:", describeError(error));
    if (charge) await charge.refund();
    return new Response(
      JSON.stringify({
        error: "Compatibility request failed. Please try again.",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
};

export const config: Config = { path: "/api/compatibility" };
