import { Config, Context } from "@netlify/functions";
import { generateGrowthReport, UserContext } from "./shared/gemini";

export default async (req: Request, context: Context) => {
    if (req.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
    }

    try {
        const { birthData, atmanData } = await req.json();

        if (!atmanData) {
            return new Response(JSON.stringify({ error: "No consciousness data available for report" }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
            });
        }

        const userContext: UserContext = {
            name: birthData?.name || 'Seeker',
            birthData: birthData ? {
                dob: birthData.dob,
                tob: birthData.tob,
                pob: birthData.pob,
            } : undefined,
            atman: atmanData,
        };

        const report = await generateGrowthReport(userContext);

        return new Response(JSON.stringify({ report }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    } catch (error: any) {
        console.error("Growth report error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
};

export const config: Config = {
    path: "/api/growth-report"
};
