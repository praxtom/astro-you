import { Config, Context } from "@netlify/functions";
import { getCompatibilityDetails, getKundliMatching } from "./shared/astro-api";
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

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let charge: FeatureCharge | null = null;
  try {
    const { maleData, femaleData, useVedicMatching, idToken } =
      await req.json();

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

    if (!maleData || !femaleData) {
      return new Response(
        JSON.stringify({ error: "Male and female birth data are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // Synastry is a premium surface — reserve credits before the paid API
    // calls. Refunded below if matching yields no data or an error is thrown.
    // Keyed per pair per day so re-running the same match (retry, back-nav)
    // doesn't bill again — a NEW pair is a new charge.
    try {
      charge = await reserveFeatureCredits(
        decoded.uid,
        "compatibility",
        stableChargeKey(
          new Date().toISOString().split("T")[0],
          maleData.dob,
          maleData.tob,
          maleData.pob,
          femaleData.dob,
          femaleData.tob,
          femaleData.pob,
        ),
      );
    } catch (err) {
      if (err instanceof CreditError) return insufficientCreditsResponse();
      throw err;
    }

    // Determine whether to include Vedic Kundli matching
    const shouldUseVedic =
      useVedicMatching === true ||
      (maleData.dob && maleData.tob && femaleData.dob && femaleData.tob);

    // Build parallel promises
    const promises: [Promise<any>, Promise<any>] = [
      getCompatibilityDetails(maleData, femaleData),
      shouldUseVedic
        ? getKundliMatching(maleData, femaleData).catch((err) => {
            console.warn(
              "[Compatibility] Vedic matching failed (non-critical):",
              err,
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
        birthData: maleData,
      });
      aiNarrative = await generateCompatibilityNarrative(
        matchData,
        maleData.name || "Person 1",
        femaleData.name || "Person 2",
        userContext,
      );
      console.log("[Compatibility] AI narrative generated");
    } catch (err) {
      console.warn("[Compatibility] AI narrative failed (non-critical):", err);
    }

    return new Response(
      JSON.stringify({
        ...matchData,
        aiNarrative,
        ...(vedicMatching ? { vedicMatching } : {}),
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error: any) {
    console.error("[Compatibility] Error:", error);
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
