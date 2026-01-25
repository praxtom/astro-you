import { Handler } from "@netlify/functions";
import { BirthData, getTransitChart, getTransitReport } from "./shared/astro-api";
import { generateTransitSummary, UserContext } from "./shared/gemini";

export const handler: Handler = async (event) => {
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    try {
        const { birthData, transitDate } = JSON.parse(event.body || "{}");

        if (!birthData || !birthData.dob || !birthData.tob) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: "Missing birth data" }),
            };
        }

        // Fetch both transit positions and the interpretive report
        console.log(`[Transit] Fetching chart and report for ${transitDate || 'today'}...`);
        const [chartData, reportData] = await Promise.all([
            getTransitChart(birthData, transitDate).then(d => { console.log('[Transit] Chart data received'); return d; }),
            getTransitReport(birthData, transitDate).then(d => { console.log(`[Transit] Report data received (${d?.length || 0} events)`); return d; })
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

        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                success: true,
                data: {
                    positions: chartData,
                    predictions: reportData,
                    aiSummary,
                    date: transitDate || new Date().toISOString().split('T')[0]
                },
            }),
        };
    } catch (error: any) {
        console.error("Transit function error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message }),
        };
    }
};
