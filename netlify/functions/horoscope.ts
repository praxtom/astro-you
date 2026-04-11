import { Config, Context } from "@netlify/functions";
import { getDailyHoroscope, getDailyHoroscopeText, getWeeklyHoroscope, getMonthlyHoroscope, getYearlyHoroscope, getDashaPeriods, getPanchang } from "./shared/astro-api";

export default async (req: Request, _context: Context) => {
    if (req.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
    }

    try {
        const { birthData, date, period = 'daily' } = await req.json();

        if (!birthData || !birthData.dob || !birthData.tob) {
            return new Response(
                JSON.stringify({ error: "Missing birth data" }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        console.log(`[Horoscope] Fetching ${period} forecast for ${date || 'today'}...`);

        if (period === 'weekly') {
            // Weekly: fetch weekly horoscope + dashas (no narrative needed)
            const [horoscopeData, dashaData] = await Promise.all([
                getWeeklyHoroscope(birthData, date),
                getDashaPeriods(birthData)
            ]);

            const currentDasha = dashaData?.find((d: any) => d.isCurrent);
            const currentBhukti = currentDasha?.subPeriods?.find((s: any) => s.isCurrent);

            return new Response(
                JSON.stringify({
                    horoscope: horoscopeData,
                    dasha: {
                        mahadasha: currentDasha?.planet,
                        bhukti: currentBhukti?.planet,
                        ends: currentBhukti?.endDate || currentDasha?.endDate
                    }
                }),
                { status: 200, headers: { "Content-Type": "application/json" } }
            );
        }

        if (period === 'monthly') {
            const [monthlyData, dashaData] = await Promise.all([
                getMonthlyHoroscope(birthData, date),
                getDashaPeriods(birthData)
            ]);

            const currentDasha = dashaData?.find((d: any) => d.isCurrent);
            const currentBhukti = currentDasha?.subPeriods?.find((s: any) => s.isCurrent);

            return new Response(
                JSON.stringify({
                    horoscope: monthlyData,
                    dasha: {
                        mahadasha: currentDasha?.planet,
                        bhukti: currentBhukti?.planet,
                        ends: currentBhukti?.endDate || currentDasha?.endDate
                    }
                }),
                { status: 200, headers: { "Content-Type": "application/json" } }
            );
        }

        if (period === 'yearly') {
            const [yearlyData, dashaData] = await Promise.all([
                getYearlyHoroscope(birthData, date),
                getDashaPeriods(birthData)
            ]);

            const currentDasha = dashaData?.find((d: any) => d.isCurrent);
            const currentBhukti = currentDasha?.subPeriods?.find((s: any) => s.isCurrent);

            return new Response(
                JSON.stringify({
                    horoscope: yearlyData,
                    dasha: {
                        mahadasha: currentDasha?.planet,
                        bhukti: currentBhukti?.planet,
                        ends: currentBhukti?.endDate || currentDasha?.endDate
                    }
                }),
                { status: 200, headers: { "Content-Type": "application/json" } }
            );
        }

        // Default: daily horoscope (structured), narrative, dashas, and panchang in parallel
        const [horoscopeData, narrativeData, dashaData, panchangData] = await Promise.all([
            getDailyHoroscope(birthData, date),
            getDailyHoroscopeText(birthData, date),
            getDashaPeriods(birthData),
            getPanchang(date, birthData.pob, birthData.lat, birthData.lng).catch(() => null),
        ]);

        // Find current dasha
        const currentDasha = dashaData?.find((d: any) => d.isCurrent);
        const currentBhukti = currentDasha?.subPeriods?.find((s: any) => s.isCurrent);

        return new Response(
            JSON.stringify({
                horoscope: horoscopeData,
                narrative: narrativeData?.text || narrativeData,
                dasha: {
                    mahadasha: currentDasha?.planet,
                    bhukti: currentBhukti?.planet,
                    ends: currentBhukti?.endDate || currentDasha?.endDate
                },
                panchang: panchangData || null,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
        );
    } catch (error: any) {
        console.error("[Horoscope] Function error:", error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
};

export const config: Config = { path: "/.netlify/functions/horoscope" };
