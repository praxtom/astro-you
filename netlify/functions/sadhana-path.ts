import { Config, Context } from "@netlify/functions";
import { generateSadhanaPath, UserContext } from "./shared/gemini";

export default async (req: Request, context: Context) => {
    if (req.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
    }

    try {
        const { birthData, atmanData } = await req.json();

        const userContext: UserContext = {
            name: birthData?.name || 'Jataka',
            birthData,
            atman: atmanData
        };

        const path = await generateSadhanaPath(userContext);

        return new Response(JSON.stringify({ path }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    } catch (error: any) {
        console.error("Sadhana path error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
};

export const config: Config = {
    path: "/api/sadhana-path"
};
