import { Config, Context } from "@netlify/functions";
import {
  getDailyHoroscopeText,
  getWeeklySignHoroscope,
  getMonthlySignHoroscope,
  getYearlySignHoroscope,
  BirthData,
} from "./shared/astro-api.js";
import { getCachedOrFetch } from "./shared/cache.js";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

// Canonical sign names mapped to a dob safely inside each sign's date range —
// the shared getDailyHoroscopeText() derives the sign from dob, so these
// anchors make the daily text match the requested sign.
export const SIGN_ANCHOR_DOB: Record<string, string> = {
  Capricorn: "2000-01-05",
  Aquarius: "2000-02-05",
  Pisces: "2000-03-05",
  Aries: "2000-04-05",
  Taurus: "2000-05-05",
  Gemini: "2000-06-05",
  Cancer: "2000-07-05",
  Leo: "2000-08-05",
  Virgo: "2000-09-05",
  Libra: "2000-10-05",
  Scorpio: "2000-11-05",
  Sagittarius: "2000-12-05",
};

export type HoroscopePeriod = "daily" | "weekly" | "monthly" | "yearly";
const PERIODS: HoroscopePeriod[] = ["daily", "weekly", "monthly", "yearly"];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Map arbitrary input to a canonical zodiac sign name, or null if unknown. */
export function normalizeSign(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const needle = value.trim().toLowerCase();
  return (
    Object.keys(SIGN_ANCHOR_DOB).find(
      (sign) => sign.toLowerCase() === needle,
    ) ?? null
  );
}

/** Map input to a supported period ("daily" when omitted), or null if unknown. */
export function normalizePeriod(value: unknown): HoroscopePeriod | null {
  if (value === undefined || value === null) return "daily";
  if (typeof value !== "string") return null;
  const needle = value.trim().toLowerCase() as HoroscopePeriod;
  return PERIODS.includes(needle) ? needle : null;
}

function fetchSignHoroscope(
  sign: string,
  period: HoroscopePeriod,
  date?: string,
) {
  switch (period) {
    case "weekly":
      return getWeeklySignHoroscope(sign, date);
    case "monthly":
      return getMonthlySignHoroscope(sign, date);
    case "yearly":
      return getYearlySignHoroscope(sign, date);
    default:
      return getDailyHoroscopeText(
        {
          dob: SIGN_ANCHOR_DOB[sign],
          tob: "12:00",
          pob: "",
          name: sign,
        } as BirthData,
        date,
      );
  }
}

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST")
    return new Response("Method Not Allowed", { status: 405 });

  try {
    const body = await req.json();

    // Validate everything BEFORE it becomes a cache key or upstream call —
    // arbitrary sign/period/date strings would mint unbounded cache docs and
    // billable requests against the paid astrology API.
    const sign = normalizeSign(body.sign);
    if (!sign) return json({ error: "Invalid or missing sign" }, 400);

    const period = normalizePeriod(body.period);
    if (!period) return json({ error: "Invalid period" }, 400);

    if (
      body.date !== undefined &&
      (typeof body.date !== "string" || !DATE_RE.test(body.date))
    ) {
      return json({ error: "Invalid date (expected YYYY-MM-DD)" }, 400);
    }
    const date = body.date as string | undefined;

    const cacheKey = `${sign}_${period}_${date || new Date().toISOString().split("T")[0]}`;

    const data = await getCachedOrFetch(
      `horoscope_signs`,
      cacheKey,
      async () => {
        const result = await fetchSignHoroscope(sign, period, date);
        // Throw instead of returning null so an upstream failure is never
        // cached as an empty document for the full TTL.
        if (!result)
          throw new Error("Sign horoscope upstream returned no data");
        return result;
      },
      period === "daily" ? 20 : period === "weekly" ? 120 : 720,
    );

    return json({ data });
  } catch (err: any) {
    console.error("[SignHoroscope] Error:", err);
    // Generic message — never leak upstream/Firestore internals to the client.
    return json({ error: "Horoscope request failed. Please try again." }, 500);
  }
};

export const config: Config = { path: "/api/sign-horoscope" };
