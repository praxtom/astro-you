import { Handler } from "@netlify/functions";
import { getDailyHoroscope, getDashaPeriods } from "./shared/astro-api";

export const handler: Handler = async (event) => {
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    try {
        const { birthData, date } = JSON.parse(event.body || "{}");

        if (!birthData || !birthData.dob || !birthData.tob) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: "Missing birth data" }),
            };
        }

        console.log(`[Horoscope] Fetching daily forecast for ${date || 'today'}...`);

        // Fetch daily horoscope and dashas in parallel
        const [horoscopeData, dashaData] = await Promise.all([
            getDailyHoroscope(birthData, date),
            getDashaPeriods(birthData)
        ]);

        // Find current dasha
        const currentDasha = dashaData?.find(d => d.isCurrent);
        const currentBhukti = currentDasha?.subPeriods?.find(s => s.isCurrent);

        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                horoscope: horoscopeData,
                dasha: {
                    mahadasha: currentDasha?.planet,
                    bhukti: currentBhukti?.planet,
                    ends: currentBhukti?.endDate || currentDasha?.endDate
                }
            }),
        };
    } catch (error: any) {
        console.error("[Horoscope] Function error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message }),
        };
    }
};
