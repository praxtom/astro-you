import { Config, Context } from "@netlify/functions";
import { getDailyHoroscopeText, BirthData } from "./shared/astro-api";

const json = (body: any, status = 200) =>
    new Response(JSON.stringify(body), {
        status,
        headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
        },
    });

export default async (req: Request, _context: Context) => {
    if (req.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
    }

    try {
        const payload = await req.json();

        // Extract birth data — the frontend may send birthData directly,
        // or wrap it in a subject envelope from the old raw-proxy format.
        const birthData: BirthData = payload.birthData || payload;

        if (!birthData?.dob || !birthData?.tob) {
            return json({ error: "Missing birth data (dob + tob required)" }, 400);
        }

        console.log("[DailyPrediction] Fetching via shared astro-api layer");

        const result = await getDailyHoroscopeText(birthData, payload.date);

        return json(result);
    } catch (error: any) {
        console.error("[DailyPrediction] Error:", error);
        return json({ error: error.message }, 500);
    }
};

export const config: Config = { path: "/.netlify/functions/daily-prediction" };
