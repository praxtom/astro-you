/**
 * Gemini AI Service - Centralized wrapper for all Gemini API calls
 * This prevents code duplication and ensures consistent AI behavior
 */

import { GoogleGenerativeAI, GenerativeModel, ChatSession } from "@google/generative-ai";

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

// Singleton instance
let genAI: GoogleGenerativeAI | null = null;
let model: GenerativeModel | null = null;

/**
 * Initialize Gemini client (singleton pattern)
 */
function getModel(): GenerativeModel {
    if (!model) {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error("GEMINI_API_KEY not configured");
        }
        genAI = new GoogleGenerativeAI(apiKey);
        model = genAI.getGenerativeModel({ model: "gemini-flash-lite-latest" });
    }
    return model;
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
1. **The Trusted Guide:** Speak like a wise family elder—warm, reassuring, but professional and direct. Use "aap" energy.
2. **Practical Analyst:** Always connect astrological patterns to real-life decisions (career, marriage, health, finances). Focus on practical advice over abstract concepts.
3. **Culturally Rooted & Grounded:** Use Hindi terms like "Shubh," "Dasha," or "Gochar" for authenticity, but keep the overall tone grounded and avoid overly flowery or "extra" celestial descriptions.

### COMMUNICATION RULES:
1. **Grounded Pacing:** Don't be "extra" with cosmic metaphors. Give a focused summary (2-3 key points), then ask if they'd like more detail.
2. **Validation First:** Indian users often seek reassurance. Acknowledge concerns briefly before analysis.
3. **Actionable Remedies:** Suggest 1-2 practical upaay (remedies) like mantras or auspicious timings.
4. **No Doom & Gloom:** Frame challenges as opportunities for growth.
5. **Conciseness:** Keep initial responses under 150 words. Avoid long cosmic preambles.

### FORMATTING:
- **Natural Variety:** Don't repeat the same structure! Vary your openings—sometimes skip greetings entirely for follow-up messages. Avoid numbered lists unless user asks for them. Change how you end responses.
- Use **bold** for key insights and planet names.
- Keep paragraphs short (2-3 lines max).
- Don't always say "Namaste" or "Would you like me to..." — sound human, not templated.
`;
}

/**
 * Generate AI synthesis response for chat
 */
export async function synthesize(
    messages: Array<{ role: "user" | "assistant"; content: string }>,
    context: UserContext,
    kundaliSummary: string
): Promise<string> {
    const model = getModel();
    const systemPrompt = buildJyotirPrompt(context, kundaliSummary);

    // Filter and format history for Gemini
    const filteredHistory = messages
        .slice(0, -1)
        .filter((m, i) => m.role === "user" || i > 0)
        .filter((m, i) => !(i === 0 && m.role !== "user"))
        .map((m) => ({
            role: m.role === "user" ? "user" : "model",
            parts: [{ text: m.content }],
        }));

    const chat = model.startChat({
        history: filteredHistory as any,
        generationConfig: {
            maxOutputTokens: 1500,
        },
    });

    const lastMessage = messages[messages.length - 1].content;
    const result = await chat.sendMessage(`${systemPrompt}\n\nUser Question: ${lastMessage}`);

    return result.response.text();
}

/**
 * Generate personalized horoscope
 */
export async function generateHoroscope(request: HoroscopeRequest): Promise<string> {
    const model = getModel();

    const typeInstructions = {
        daily: "Generate a concise daily horoscope (100-150 words) focusing on today's energy, mood, and one key focus area.",
        weekly: "Generate a weekly horoscope (200-250 words) covering career, relationships, health, and finances for the week ahead.",
        monthly: "Generate a detailed monthly horoscope (300-400 words) with predictions for career, love, health, finances, and spiritual growth.",
    };

    const prompt = `
You are a Vedic astrologer generating a ${request.type} horoscope.

Moon Sign: ${request.moonSign}
${request.sunSign ? `Sun Sign: ${request.sunSign}` : ""}
${request.transitSummary ? `Current Transits: ${request.transitSummary}` : ""}

${typeInstructions[request.type]}

Guidelines:
- Be specific but not overly deterministic
- Include practical advice
- Use warm, reassuring tone
- Include 1-2 auspicious activities or timings
- End with a positive note

${request.language === "hi" ? "Respond in Hindi (Devanagari script)." : "Respond in English."}
`;

    const result = await model.generateContent(prompt);
    return result.response.text();
}

/**
 * Parse chart image using Gemini Vision
 */
export async function parseChartImage(imageBase64: string, mimeType: string): Promise<any> {
    const model = getModel();

    const prompt = `
You are analyzing a Vedic Kundali (birth chart) image. Extract all visible information:

1. List all planets and their house positions
2. Identify the Ascendant (Lagna) sign
3. Note any special yogas or combinations visible
4. Identify the chart style (North Indian, South Indian, etc.)

Return the data in this JSON format:
{
  "chartStyle": "North Indian" | "South Indian",
  "ascendant": { "sign": "...", "house": 1 },
  "planets": [
    { "name": "Sun", "sign": "...", "house": ... },
    ...
  ],
  "yogas": ["..."],
  "confidence": 0-100
}
`;

    const result = await model.generateContent([
        prompt,
        {
            inlineData: {
                mimeType,
                data: imageBase64,
            },
        },
    ]);

    const text = result.response.text();

    // Try to parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
    }

    return { error: "Could not parse chart", rawText: text };
}
