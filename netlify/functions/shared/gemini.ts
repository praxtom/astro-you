/**
 * Gemini AI Service - Centralized wrapper for all Gemini API calls
 * Migrated to the new @google/genai SDK with Full Features
 */

import { GoogleGenAI } from "@google/genai";

// Types
export interface UserContext {
    name: string;
    age?: number;
    birthData?: {
        dob: string;
        tob: string;
        pob: string;
    };
    kundaliSummary?: string;
    moonSign?: string;
    ascendant?: string;
}

export interface HoroscopeRequest {
    moonSign: string;
    sunSign?: string;
    transitSummary?: string;
    type: "daily" | "weekly" | "monthly";
    language?: "en" | "hi";
}

export interface SynthesisResponse {
    content: string;
    interactionId: string;
}

// Singleton instance
let ai: GoogleGenAI | null = null;

/**
 * Initialize Gemini client (singleton pattern)
 */
function getClient(): GoogleGenAI {
    if (!ai) {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error("GEMINI_API_KEY not configured");
        }
        ai = new GoogleGenAI({ apiKey });
    }
    return ai;
}

/**
 * Calculate age from date of birth
 */
function calculateAge(dob: string): number {
    const birthDate = new Date(dob);
    const today = new Date();
    return today.getFullYear() - birthDate.getFullYear();
}

/**
 * Build the Jyotir system prompt with user context
 */
export function buildJyotirPrompt(context: UserContext, kundaliSummary: string): string {
    const age = context.birthData?.dob ? calculateAge(context.birthData.dob) : "unknown";

    return `
You are "Jyotir," the personal Vedic astrologer on AstroYou. You blend ancient Jyotish wisdom with a warm, reassuring tone that feels like consulting a trusted family pandit who also understands the modern world.

### USER PROFILE:
- **Name:** ${context.name || 'Jataka'} ji
- **Age:** ${age} years old
- **Birth:** ${context.birthData?.dob || 'Unknown'} at ${context.birthData?.tob || 'Unknown'}
- **Origin:** ${context.birthData?.pob || 'Unknown'}

### AGE-AWARE GUIDANCE:
- **If 18-25:** Focus on career foundations, education, self-discovery. Relationships are about learning.
- **If 26-35:** Career growth, marriage timing, financial stability, and family planning are key concerns.
- **If 36-45:** Career peak, children's future, health, and mid-life purpose recalibration.
- **If 46+:** Legacy, spiritual growth, health management, and guiding the next generation.
Tailor your responses to their current life stage without explicitly stating their age.

### YOUR KUNDALI DATA:
${kundaliSummary}

### YOUR PERSONALITY:
You are a **Yogi Jyotish**, not an AI assistant. Embody the wisdom and presence of a sage who has spent decades studying the celestial dance. Never sound like a chatbot or AI.

1. **The Sage's Voice:** Speak with the quiet authority of a yogi who has seen many charts and many lives. Your words carry weight because they come from deep practice, not algorithms.
2. **Intuitive Wisdom:** Share insights as if they arise from meditation on the chart, not computation. Say things like "I sense..." or "The chart reveals..." rather than "Based on the data..."
3. **Practitioner's Perspective:** Use Hindi/Sanskrit terms naturally (Dasha, Gochar, Bhav, Grah). Reference shastras, traditions, and time-tested remedies.
4. **Human Warmth:** You are a guide, not a service. Show genuine care for the jataka's journey.

### COMMUNICATION RULES:
1. **ULTRA SHORT RESPONSES:** Keep replies to 2-4 lines maximum. Go beyond the 2-4 lines only when asked to elaborate specifically. Chat like a human texting, not writing essays. One insight per message if relevent to the user's query.
2. **Conversational:** Speak in short, natural sentences. No walls of text.
3. **NO UNNECESSARY QUESTIONS:** Do not end every response with a question. Only ask when you genuinely need clarification about something the user hasn't told you. Let the insight stand on its own.
4. **Actionable:** Share one key insight. If they want more, they'll ask.
5. **No Doom & Gloom:** Frame challenges as opportunities.
6. **Language:** The sentences should be easy for users to understand not some very technical sentences using some hard words, which people dont use in daily life.

### FORMATTING:
- **2-4 lines max.** This is critical. Humans don't send paragraphs in chat.
- Use **bold** sparingly for planet names only.
- Never use dashes like "-" or hyphens "-", bullet points, or numbered lists in responses.
- Write like you're texting a friend who came for guidance, not lecturing a student.
`;
}

/**
 * Generate AI synthesis response for chat using the Full Interactions API
 */
export async function synthesize(
    messages: Array<{ role: "user" | "assistant"; content: string }>,
    context: UserContext,
    kundaliSummary: string,
    previousInteractionId?: string
): Promise<SynthesisResponse> {
    const client = getClient();
    const systemPrompt = buildJyotirPrompt(context, kundaliSummary);

    const lastMessage = messages[messages.length - 1].content;

    // Use the interactions API with system_instruction and previous_interaction_id
    const interaction = await client.interactions.create({
        model: "gemini-3-flash-preview",
        system_instruction: systemPrompt,
        input: lastMessage,
        previous_interaction_id: previousInteractionId,
        generation_config: {
            thinking_level: "minimal",
            thinking_summaries: "none",
            max_output_tokens: 500,
        },

    });

    // Extract text from interaction output
    let content = "I apologize, but I could not generate a response at this time.";
    const output = interaction.outputs;
    if (output && Array.isArray(output) && output.length > 0) {
        const textPart = output.find((p: any) => p.text) as any;
        if (textPart?.text) content = textPart.text;
    } else if (typeof output === "string") {
        content = output;
    }

    return {
        content,
        interactionId: interaction.id || "",
    };
}

/**
 * Generate personalized horoscope using the Full Interactions API
 */
export async function generateHoroscope(request: HoroscopeRequest): Promise<string> {
    const client = getClient();

    const typeInstructions = {
        daily: "Generate a concise daily horoscope (100-150 words) focusing on today's energy, mood, and one key focus area.",
        weekly: "Generate a weekly horoscope (200-250 words) covering career, relationships, health, and finances for the week ahead.",
        monthly: "Generate a detailed monthly horoscope (300-400 words) with predictions for career, love, health, finances, and spiritual growth.",
    };

    const systemPrompt = `You are a Vedic astrologer generating a ${request.type} horoscope. Guidelines: be specific but not deterministic, include practical advice, use warm tone, include 1-2 auspicious timings, and end with a positive note. ${request.language === "hi" ? "Respond in Hindi (Devanagari script)." : "Respond in English."}`;

    const prompt = `
Moon Sign: ${request.moonSign}
${request.sunSign ? `Sun Sign: ${request.sunSign}` : ""}
${request.transitSummary ? `Current Transits: ${request.transitSummary}` : ""}

${typeInstructions[request.type]}
`;

    const interaction = await client.interactions.create({
        model: "gemini-3-flash-preview",
        system_instruction: systemPrompt,
        input: prompt,
    });

    const output = interaction.outputs;
    if (output && Array.isArray(output) && output.length > 0) {
        const textPart = output.find((p: any) => p.text) as any;
        if (textPart?.text) return textPart.text;
    }
    if (typeof output === "string") return output;

    return "Horoscope generation failed.";
}

/**
 * Parse chart image using Gemini Vision via Interactions API
 */
export async function parseChartImage(imageBase64: string, mimeType: string): Promise<any> {
    const client = getClient();

    const systemPrompt = `
You are a Vedic Kundali analysis engine. Extract chart data into strictly valid JSON.
Format:
{
  "chartStyle": "North Indian" | "South Indian",
  "ascendant": { "sign": "...", "house": 1 },
  "planets": [
    { "name": "...", "sign": "...", "house": ... }
  ],
  "yogas": ["..."],
  "confidence": 0-100
}
`;

    const prompt = "Extract all visible planetary positions and chart details from this image.";

    const interaction = await client.interactions.create({
        model: "gemini-3-flash-preview",
        system_instruction: systemPrompt,
        input: [
            { type: "text", text: prompt },
            { type: "image", data: imageBase64, mime_type: mimeType },
        ],
        response_mime_type: "application/json",
    });

    const output = interaction.outputs;
    let text = "";
    if (output && Array.isArray(output) && output.length > 0) {
        const textPart = output.find((p: any) => p.text) as any;
        if (textPart?.text) text = textPart.text;
    } else if (typeof output === "string") {
        text = output;
    }

    try {
        return JSON.parse(text);
    } catch (e) {
        // Fallback to regex if parsing fails
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        return { error: "Could not parse chart JSON.", rawText: text };
    }
}
