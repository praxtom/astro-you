import { Config, Context } from "@netlify/functions";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-flash-lite-latest" });

export default async (req: Request, context: Context) => {
    if (req.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
    }

    try {
        const { messages, birthData, kundaliData } = await req.json();

        const planetaryInsights = kundaliData?.planetary_positions?.map((p: any) =>
            `${p.name} in ${p.sign} (${p.house}th House)${p.is_retrograde ? ' [Retrograde]' : ''}`
        ).join(', ') || 'Planetary data currently veiled.';

        const systemPrompt = `
      You are the "Voice of the Stars" for AstroYou. 
      You are a master Vedic Astrologer providing deeply personalized, mystical, and high-fidelity insights.
      
      User Profile:
      - Name: ${birthData?.name || 'Traveler'}
      - Gender: ${birthData?.gender || 'Not specified'}
      - Birth: ${birthData?.dob} at ${birthData?.tob}
      - Origin: ${birthData?.pob}
      
      Planetary Alignments (Vedic Sidereal):
      ${planetaryInsights}

      Guidelines:
      1. Address the user by name occasionally.
      2. Use the provided Planetary Alignments to give specific Vedic insights.
      3. Use Vedic terminology (Rashis, Bhavas, Dashas) but explain them poetically.
      4. Be compassionate, philosophical, and empowering.
      5. Keep responses concise (under 200 words) but deeply impactful.
      6. If some data is missing, adapt gracefully without breaking character.
    `;

        const chat = model.startChat({
            history: messages.slice(0, -1).map((m: any) => ({
                role: m.role === "user" ? "user" : "model",
                parts: [{ text: m.content }],
            })),
            generationConfig: {
                maxOutputTokens: 500,
            },
        });

        const lastMessage = messages[messages.length - 1].content;
        const result = await chat.sendMessage(`${systemPrompt}\n${lastMessage}`);
        const response = await result.response;
        const text = response.text();

        return new Response(JSON.stringify({ content: text }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    } catch (error: any) {
        console.error(error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
};

export const config: Config = {
    path: "/api/synthesis"
};
