import { Config, Context } from "@netlify/functions";
import { getDailyHoroscopeText, BirthData } from "./shared/astro-api.js";
import { getCachedOrFetch } from "./shared/cache.js";
import { checkRateLimit, getRequestIdentifier } from "./shared/rate-limit.js";
import { SIGN_ANCHOR_DOB, normalizeSign } from "./sign-horoscope.js";

const json = (body: any, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Fail-closed per-IP limiter. "daily_prediction" is not enrolled in the shared
 * limiter's FAIL_CLOSED_SCOPES, whose outage fallback reports
 * `{ allowed: true, remaining: 0 }` — the same shape as the final in-budget
 * request. Denying `remaining <= 0` (and sizing the limit one above the real
 * budget) therefore also denies during limiter-store outages: this public
 * endpoint fronts the paid astrology API and must never fail open.
 */
async function allowAnonRequest(
  req: Request,
  scope: string,
  budget: number,
  windowMs: number,
): Promise<boolean> {
  const result = await checkRateLimit({
    scope,
    key: getRequestIdentifier(req),
    limit: budget + 1,
    windowMs,
  });
  return result.allowed && result.remaining > 0;
}

/** Derive the zodiac sign from a YYYY-MM-DD dob, or null if malformed. */
function signFromDob(dob: unknown): string | null {
  if (typeof dob !== "string" || !DATE_RE.test(dob)) return null;
  const [, month, day] = dob.split("-").map(Number);
  if (month < 1 || month > 12) return null;
  // Capricorn-first order, matching shared/astro-api's derivation.
  const signs = Object.keys(SIGN_ANCHOR_DOB);
  const bounds = [20, 19, 21, 20, 21, 21, 23, 23, 23, 23, 22, 22];
  return day < bounds[month - 1] ? signs[month - 1] : signs[month % 12];
}

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    // Public endpoint (the dashboard serves guests) — cap it per IP so
    // anonymous traffic can't run up the paid API.
    const allowed = await allowAnonRequest(
      req,
      "daily_prediction",
      20,
      60 * 60 * 1000,
    );
    if (!allowed) {
      return json({ error: "Too many requests. Please try again later." }, 429);
    }

    const payload = await req.json();

    // The dashboard sends a precomputed `sign`; older clients sent birth
    // data. Accept either, but never forward arbitrary strings upstream.
    const sign =
      normalizeSign(payload.sign) ??
      signFromDob(payload.birthData?.dob ?? payload.dob);
    if (!sign) {
      return json({ error: "Missing or invalid sign / birth data" }, 400);
    }

    const date =
      typeof payload.date === "string" && DATE_RE.test(payload.date)
        ? payload.date
        : new Date().toISOString().split("T")[0];

    // The text is the same for everyone with the same sign on a given day.
    // Cache in the shared horoscope_signs collection (same keys as
    // sign-horoscope) so repeated hits never re-bill the upstream API.
    const data = await getCachedOrFetch(
      "horoscope_signs",
      `${sign}_daily_${date}`,
      async () => {
        const result = await getDailyHoroscopeText(
          {
            dob: SIGN_ANCHOR_DOB[sign],
            tob: "12:00",
            pob: "",
            name: sign,
          } as BirthData,
          date,
        );
        // Throw instead of returning null so an upstream failure is
        // never cached as an empty document for the full TTL.
        if (!result) {
          throw new Error("Daily horoscope upstream returned no data");
        }
        return result;
      },
    );

    return json({ success: true, data });
  } catch (error: any) {
    console.error("[DailyPrediction] Error:", error);
    // Generic message — never leak upstream internals to the client.
    return json({ error: "Daily prediction failed. Please try again." }, 500);
  }
};

export const config: Config = { path: "/api/daily-prediction" };
