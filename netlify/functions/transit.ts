import { Config, Context } from "@netlify/functions";
import { BirthData, getTransitChart, getTransitReport } from "./shared/astro-api";
import { generateTransitSummary, UserContext } from "./shared/gemini";
import { getCachedOrFetch } from "./shared/cache";

export default async (req: Request, _context: Context) => {
    if (req.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
    }

    try {
        const { birthData, transitDate } = await req.json();

        if (!birthData || !birthData.dob || !birthData.tob) {
            return new Response(
                JSON.stringify({ error: "Missing birth data" }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        // Fetch both transit positions and the interpretive report
        const today = new Date().toISOString().split('T')[0];
        console.log(`[Transit] Fetching chart and report for ${transitDate || 'today'}...`);
        const [chartData, reportData] = await Promise.all([
            getTransitChart(birthData, transitDate).then(d => { console.log('[Transit] Chart data received'); return d; }),
            getCachedOrFetch(
                "transit_reports",
                `${birthData.dob}_${transitDate || today}`,
                () => getTransitReport(birthData, transitDate),
                12 // 12-hour TTL for transit reports
            ).then(d => { console.log(`[Transit] Report data received (${(d as any)?.length || 0} events)`); return d; })
        ]);

        // Generate Gemini summary if we have report data
        let aiSummary = "";
        if (reportData && reportData.length > 0) {
            try {
                const userContext: UserContext = {
                    name: birthData.name || "Jataka",
                    birthData: {
                        dob: birthData.dob,
                        tob: birthData.tob,
                        pob: birthData.pob || ""
                    }
                };
                aiSummary = await generateTransitSummary(userContext, reportData);
                console.log('[Transit] AI summary generated');
            } catch (err) {
                console.error('[Transit] AI summary generation failed:', err);
            }
        }

        return new Response(
            JSON.stringify({
                success: true,
                data: {
                    positions: chartData,
                    predictions: reportData,
                    aiSummary,
                    date: transitDate || new Date().toISOString().split('T')[0]
                },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
        );
    } catch (error: any) {
        console.error("Transit function error:", error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
};

export const config: Config = { path: "/.netlify/functions/transit" };
