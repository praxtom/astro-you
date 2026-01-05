import { Config, Context } from "@netlify/functions";
import { getNatalChart, BirthData } from "./shared/astro-api";

export default async (req: Request, context: Context) => {
    if (req.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
    }

    try {
        const { birthData, chartType = 'D1' } = await req.json();

        // Validate required fields
        if (!birthData || !birthData.dob || !birthData.tob) {
            return new Response(JSON.stringify({ error: "Missing birth data" }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
            });
        }

        // Use shared service for API call based on type
        const { getNatalChart, getNavamsaChart } = await import("./shared/astro-api");

        let kundaliData;
        if (chartType === 'D9') {
            kundaliData = await getNavamsaChart(birthData as BirthData);
        } else {
            kundaliData = await getNatalChart(birthData as BirthData);
        }

        console.log(`KUNDALI ${chartType} DATA RECEIVED:`, JSON.stringify(kundaliData).substring(0, 500));

        return new Response(JSON.stringify(kundaliData), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    } catch (error: any) {
        console.error("Kundali API error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
};

export const config: Config = {
    path: "/api/kundali",
};
