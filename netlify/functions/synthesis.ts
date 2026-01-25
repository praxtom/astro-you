import { Config, Context } from "@netlify/functions";
import { synthesize, analyzeUserConsciousness, UserContext } from "./shared/gemini";

export default async (req: Request, context: Context) => {
    if (req.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
    }

    try {
        const { messages, birthData, kundaliData, previousInteractionId, atmanData } = await req.json();

        // Build kundali summary for AI context
        const kundaliSummary = kundaliData?.planetary_positions?.map((p: any) =>
            `${p.name} in ${p.sign} (${p.house}th House)${p.is_retrograde ? ' [Retrograde]' : ''}`
        ).join(', ') || 'Planetary data currently veiled.';

        // Build user context for AI
        const userContext: UserContext = {
            name: birthData?.name || 'Jataka',
            birthData: birthData ? {
                dob: birthData.dob,
                tob: birthData.tob,
                pob: birthData.pob,
            } : undefined,
            atman: atmanData
        };

        // 1. Generate Response
        const response = await synthesize(
            messages.map((m: any) => ({
                role: m.role as 'user' | 'assistant',
                content: m.content,
            })),
            userContext,
            kundaliSummary,
            previousInteractionId
        );

        // 2. Asynchronous Consciousness Analysis (Fire and Forget)
        // Note: In a serverless function, we should ideally await this or put it in a queue.
        // For now, we await it to ensure it runs before the lambda dies.
        let analysisResult = null;
        if (messages.length > 0) {
            analysisResult = await analyzeUserConsciousness(
                messages.slice(-5), // Analyze last 5 messages
                userContext
            );
        }

        // Simple keyword detection for chart requests
        const lastMessage = messages[messages.length - 1].content.toLowerCase();
        const chartKeywords = ["chart", "kundali", "horoscope", "show", "visualize", "blueprint", "map"];
        const isRequestingChart = chartKeywords.some(keyword => lastMessage.includes(keyword));

        return new Response(JSON.stringify({
            content: response.content,
            interactionId: response.interactionId,
            suggestAction: isRequestingChart ? 'show_chart' : null,
            atmanUpdate: analysisResult // Send analysis back to client to update DB
        }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    } catch (error: any) {
        console.error("Synthesis error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
};

export const config: Config = {
    path: "/api/synthesis"
};
