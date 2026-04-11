import { Config, Context } from "@netlify/functions";
import {
  getDailyHoroscopeText,
  getWeeklySignHoroscope,
  getMonthlySignHoroscope,
  getYearlySignHoroscope,
} from "./shared/astro-api";
import { getCachedOrFetch } from "./shared/cache";

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST")
    return new Response("Method Not Allowed", { status: 405 });

  try {
    const { sign, period = "daily", date } = await req.json();
    if (!sign)
      return new Response(JSON.stringify({ error: "Missing sign" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });

    const cacheKey = `${sign}_${period}_${date || new Date().toISOString().split("T")[0]}`;

    const data = await getCachedOrFetch(
      `horoscope_signs`,
      cacheKey,
      async () => {
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
                dob: "2000-01-01",
                tob: "12:00",
                pob: "Delhi",
                name: sign,
              } as any,
              date,
            );
        }
      },
      period === "daily" ? 20 : period === "weekly" ? 120 : 720,
    );

    return new Response(JSON.stringify({ data }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const config: Config = { path: "/api/sign-horoscope" };
