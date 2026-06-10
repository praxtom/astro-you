import { Config, Context } from "@netlify/functions";
import { getCompatibilityDetails, getKundliMatching } from "./shared/astro-api";
import { generateCompatibilityNarrative } from "./shared/gemini";
import {
  verifyToken,
  enforceIpRateLimit,
  AuthError,
} from "./shared/require-auth";

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const { maleData, femaleData, useVedicMatching, idToken } =
      await req.json();

    // Auth + rate limit: matching calls the paid astrology API + Gemini.
    try {
      await verifyToken(idToken);
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
      return new Response(
        JSON.stringify({ error: "Failed to fetch compatibility data" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    // Generate AI narrative interpretation of the compatibility scores
    let aiNarrative = "";
    try {
      aiNarrative = await generateCompatibilityNarrative(
        matchData,
        maleData.name || "Person 1",
        femaleData.name || "Person 2",
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
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  } catch (error: any) {
    console.error("[Compatibility] Error:", error);
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
