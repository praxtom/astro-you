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
    // Atman (Consciousness) Data
    atman?: {
        emotionalState?: 'stable' | 'anxious' | 'chaotic' | 'depressive' | 'energetic' | 'spiritual' | 'reactive';
        lastEmotionalUpdate?: any;
        emotionalHistory?: Array<{ state: string; date: any }>;
        knownPatterns?: any[]; // Supports both legacy string[] and WeightedPattern[]
        activeEvents?: Array<{ title: string; status: string }>;
        routines?: Array<{ title: string; streak: number }>;
        keyRelationships?: Array<{ name: string; relation: string; dynamic: string; zodiacSign?: string; notes?: string }>;
    };
}

export interface HoroscopeRequest {
    moonSign: string;
    sunSign?: string;
    transitSummary?: string;
    type: "daily" | "weekly" | "monthly";
    language?: "en" | "hi";
}

export interface AnalysisResult {
    emotionalState: 'stable' | 'anxious' | 'chaotic' | 'depressive' | 'energetic' | 'spiritual' | 'reactive';
    newEvents: Array<{ title: string; category: string }>;
    newPatterns: string[];
    detectedContradictions?: string[];
    karmicThreads?: string[]; // Connections across domains
}

/**
 * Analyze chat history to extract Atman insights
 */
export async function analyzeUserConsciousness(
    lastMessages: { role: string; content: string }[],
    existingContext?: UserContext
): Promise<AnalysisResult> {
    const ai = getClient();

    const existingPatterns = (existingContext?.atman?.knownPatterns as any[])
        ? (existingContext!.atman!.knownPatterns as any[]).map(p => typeof p === 'string' ? p : p.pattern).join(", ")
        : "None yet";

    const prompt = `
    Analyze the following chat conversation between a User and an Astrologer.
    Extract the user's current emotional state, new life events, behavioral patterns, and RELATIONAL TRENDS.
    
    CRITICAL: Also check for CONTRADICTIONS against their existing known patterns.
    Existing Patterns: ${existingPatterns}
    
    RELATIONAL CONTEXT:
    ${existingContext?.atman?.keyRelationships?.map(r => `- ${r.name} (${r.relation}, dynamic: ${r.dynamic})`).join("\n") || "No relationships mapped yet."}

    OUTPUT JSON FORMAT ONLY:
    {
        "emotionalState": "stable" | "anxious" | "chaotic" | "depressive" | "energetic" | "spiritual" | "reactive",
        "newEvents": [ { "title": "Job Interview", "category": "career" } ],
        "newPatterns": [ "Anxious about money" ],
        "detectedContradictions": [ "User previously avoided confrontation but is now seeking it" ],
        "karmicThreads": [ "Pattern of feeling undervalued by male figures (Father, Boss)" ]
    }

    RULES:
    - "chaotic": User is panicking, overwhelmed, or very confused.
    - "anxious": User is worried about future, fearful, or restless.
    - "reactive": User is angry, irritated, stressed, or defensive.
    - "stable": Normal, calm conversation.
    - "spiritual": User is seeking deep meaning, philosophical or meditative.
    - "detectedContradictions": Only include if current behavior strongly opposes a known pattern.
    - "karmicThreads": Connect dots across life areas (Work, Family, Health). Is there a unified underlying struggle?
    
    NEURAL RELATIONSHIP MAPPING:
    - If the user mentions a specific person from their Sangha, analyze how that dynamic is evolving.
    - If a new interpersonal pattern emerges (e.g., "Setting boundaries with boss"), add it to newPatterns.

    CHAT HISTORY:
    ${lastMessages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join("\n")}
    `;

    try {
        const result = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            config: { responseMimeType: "application/json" }
        });

        const text = result.text;
        if (!text) return { emotionalState: 'stable', newEvents: [], newPatterns: [], detectedContradictions: [] };
        // Clean markdown code blocks if present
        const jsonStr = text.replace(/```json\n?|\n?```/g, "").trim();
        return JSON.parse(jsonStr) as AnalysisResult;
    } catch (error) {
        console.error("Analysis failed:", error);
        return { emotionalState: 'stable', newEvents: [], newPatterns: [], detectedContradictions: [] };
    }
}

export interface SynthesisResponse {
    content: string;
    interactionId: string;
    suggestedRoutine?: {
        title: string;
        type: 'morning' | 'evening' | 'habit';
        durationMinutes: number;
        frequency: 'daily' | 'weekly';
    };
}

// Singleton instance
let ai: GoogleGenAI | null = null;

/**
 * Initialize Gemini client (singleton pattern)
 */
function getClient(): GoogleGenAI {
    if (!ai) {
        const apiKey = process.env.GEMINI_API_KEY || process.env.ASTROYOU_API_KEY;
        if (!apiKey) {
            throw new Error("API Key not configured (GEMINI_API_KEY)");
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
 * Build the Guru (Counsellor) system prompt
 */
export function buildGuruPrompt(context: UserContext): string {
    const age = context.birthData?.dob ? calculateAge(context.birthData.dob) : "unknown";

    return `
You are "Guru," a spiritual counsellor and guide on AstroYou. 
The user is currently in a CHAOTIC or ANXIOUS state. Your goal is NOT to give astrological predictions, but to guide them back to clarity using the "Neti Neti" (Not this, not that) method and grounding techniques.

### CORE PHILOSOPHY (NETI NETI):
- You help the user detach from their overwhelming thoughts.
- You do not solve their external problems directly; you solve their internal reaction to them.
- You are calm, slow, and grounding.

### USER CONTEXT:
- **Name:** ${context.name || 'Friend'}
- **State:** ${context.atman?.emotionalState || 'Chaotic'}
- **Current Struggle:** ${context.atman?.activeEvents?.[0]?.title || 'Unknown stress'}

### GUIDELINES:
1. **Mirror & Validate:** Acknowledge their chaos without judging it. "I see the storm is loud today."
2. **Detach:** Ask questions that separate the *experiencer* from the *experience*. "Who is the one watching this anxiety?"
3. **One Step at a Time:** Do not overwhelm them with advice. Give ONE small, grounding instruction (e.g., "Take a deep breath," "Feel your feet on the floor").
4. **Tone:** Deeply calm, slow, patient. Like a grandfather or an ancient tree.
5. **No Astrology Jargon:** Do not talk about planets or dashas now. They are too stressed for that. Talk about *them*.

### FORMATTING:
- **Short & Gentle:** 1-3 sentences max.
- **Soft Voice:** Use soothing language.
- **No Lists:** Conversational only.
`;
}

/**
 * Build the Jyotish system prompt with user context
 */
export function buildJyotishPrompt(context: UserContext, kundaliSummary: string): string {
    const age = context.birthData?.dob ? calculateAge(context.birthData.dob) : "unknown";

    // Build Atman Context String
    let atmanContext = "";
    let proactiveFollowUp = "";
    let trendContext = "";

    if (context.atman) {
        // Build Trend Analysis Context
        if (context.atman.emotionalHistory && context.atman.emotionalHistory.length > 0) {
            const recentStates = context.atman.emotionalHistory.slice(-5).map(h => h.state).join(" -> ");
            trendContext = `\n- **Recent Emotional Pulse:** ${recentStates}`;
        }
        // Detect events that need proactive follow-up
        const pendingEvents = context.atman.activeEvents?.filter(e => e.status === 'pending') || [];
        if (pendingEvents.length > 0) {
            proactiveFollowUp = `
### PROACTIVE FOLLOW-UP PROTOCOL:
The user has pending life events you should naturally inquire about:
${pendingEvents.map(e => `- "${e.title}" (Status: ${e.status})`).join('\n')}

**IMPORTANT:** If this is a new conversation or the user seems idle, gently ask about one of these events. For example:
- "How did the [event] go, ${context.name || 'ji'}?"
- "I remember you mentioned [event]. Any updates?"
- "The stars were watching over your [event]. How did it unfold?"

Only ask about ONE event at a time. Be natural, not robotic.`;
        }

        atmanContext = `
### CONSCIOUSNESS STATE (ATMAN):
- **Current Vibe:** ${context.atman.emotionalState || 'Neutral'}${trendContext}
- **Known Patterns:** ${context.atman.knownPatterns?.join(", ") || 'None yet'}
- **Active Life Events:** ${context.atman.activeEvents?.map(e => `${e.title} (${e.status})`).join(", ") || 'None'}
- **Active Routines:** ${context.atman.routines?.map(r => `${r.title} (Streak: ${r.streak})`).join(", ") || 'None'}
- **Sangha (Inner Circle):** ${context.atman.keyRelationships?.map(r => `${r.name} (${r.relation}, ${r.dynamic})`).join(", ") || 'None'}
${proactiveFollowUp}

### TREND ANALYSIS PROTOCOL:
If there is a significant shift in vibe (e.g., from 'energetic' to 'anxious'), acknowledge it gently. For example: "I see the high energy of the past few days has met some resistance..."
Only mention trends if they are clear and relevant to the current conversation.`;
    }

    return `
You are "Jyotish," the personal Vedic astrologer on AstroYou. You blend ancient Jyotish wisdom with a warm, reassuring tone that feels like consulting a trusted family pandit who also understands the modern world.
${atmanContext}
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
5. **Memory & Continuity:** You REMEMBER the user's patterns (listed in ATMAN section). If they are anxious, be grounding. If they are excited, be celebratory. If they have an active event (e.g., Interview), ASK about it naturally.

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
 * Generate a concise transit summary using the Gemini Interactions API
 */
export async function generateTransitSummary(
    context: UserContext,
    transitPredictions: any[]
): Promise<string> {
    const client = getClient();

    const systemPrompt = `
You are "Jyotish," a wise Vedic astrologer on AstroYou. Your task is to provide a very concise, easy-to-understand summary of a user's current planetary transits.

### GUIDELINES:
1. **Be Concise:** Maximum 2-3 short sentences.
2. **Simple Language:** Avoid heavy jargon. Explain the "vibe" or "energy" of the current transits.
3. **Tone:** Reassuring, insightful, and practical.
4. **Human Voice:** Speak like a trusted guide, not an AI. Use "Jataka ji" or "Ji" naturally.
5. **No Lists:** Use flowing sentences only. No bullet points or numbered lists.
`;

    const prompt = `
User Context:
- Name: ${context.name}
- Age: ${context.age}
- Moon Sign: ${context.moonSign}
- Ascendant: ${context.ascendant}

Current Transit Data (interpretations):
${JSON.stringify(transitPredictions.slice(0, 5), null, 2)}

Provide a warm, 2-sentence summary of what these transits mean for the user right now. Focus on the most significant energy.
`;

    const interaction = await client.interactions.create({
        model: "gemini-3-flash-preview",
        system_instruction: systemPrompt,
        input: prompt,
        generation_config: {
            max_output_tokens: 200,
        },
    });

    let content = "The stars are in a unique alignment for you today. Observe your path with clarity.";
    const output = interaction.outputs;
    if (output && Array.isArray(output) && output.length > 0) {
        const textPart = output.find((p: any) => p.text) as any;
        if (textPart?.text) content = textPart.text;
    } else if (typeof output === "string") {
        content = output;
    }

    return content;
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

    // Determine Persona: Guru (Chaos/Anxious) or Jyotish (Stable/Others)
    const isChaotic = context.atman?.emotionalState === 'chaotic' || context.atman?.emotionalState === 'anxious';

    // Choose the appropriate system prompt
    const systemPrompt = isChaotic
        ? buildGuruPrompt(context)
        : buildJyotishPrompt(context, kundaliSummary);

    console.log(`[Synthesis] Persona: ${isChaotic ? 'GURU (Counsellor)' : 'JYOTISH (Astrologer)'}`);

    const lastMessage = messages[messages.length - 1].content;

    console.log("[Synthesis] Input:", lastMessage.substring(0, 50) + "...");
    console.log("[Synthesis] Previous Interaction ID:", previousInteractionId || "null (first message)");

    // Use the interactions API with system_instruction and previous_interaction_id
    const interaction = await client.interactions.create({
        model: "gemini-3-flash-preview",
        system_instruction: systemPrompt + `
        
### ROUTINE SUGGESTION PROTOCOL:
If (and ONLY if) you believe the user needs a structured habit to solve their current problem, you can suggest a routine.
Output it at the END of your response in this XML format:
<routine>
{
  "title": "10-min Morning Sun Salutation",
  "type": "morning",
  "durationMinutes": 10,
  "frequency": "daily"
}
</routine>
Do not suggest a routine if they already have too many active routines.
`,
        input: lastMessage,
        previous_interaction_id: previousInteractionId,
        generation_config: {
            thinking_level: "minimal",
            thinking_summaries: "none",
            max_output_tokens: 500,
        },

    });

    console.log("[Synthesis] New Interaction ID:", interaction.id);

    // Extract text from interaction output
    let content = "I apologize, but I could not generate a response at this time.";
    const output = interaction.outputs;
    if (output && Array.isArray(output) && output.length > 0) {
        const textPart = output.find((p: any) => p.text) as any;
        if (textPart?.text) content = textPart.text;
    } else if (typeof output === "string") {
        content = output;
    }

    // Parse Routine
    let suggestedRoutine;
    const routineMatch = content.match(/<routine>([\s\S]*?)<\/routine>/);
    if (routineMatch) {
        try {
            suggestedRoutine = JSON.parse(routineMatch[1]);
            content = content.replace(routineMatch[0], "").trim(); // Remove tag from visible chat
        } catch (e) {
            console.error("Failed to parse routine JSON", e);
        }
    }

    return {
        content,
        interactionId: interaction.id || "",
        suggestedRoutine
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
  "birthDetails": {
    "dob": "YYYY-MM-DD",
    "tob": "HH:MM",
    "pob": "City, Country"
  },
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
/**
 * Generate a personalized proactive guru nugget/nudge
 */
export async function generateProactiveNudge(
    context: UserContext,
    triggerType: 'morning_routine' | 'anniversary_reflection' | 'transit_alert' | 'emotional_stabilization' | 'relational_management'
): Promise<{ title: string; message: string }> {
    const ai = getClient();

    const prompt = `
    You are "Guru," the spiritual guide on AstroYou. 
    Generate a short, soulful proactive nudge for ${context.name || 'Ji'} based on the trigger: ${triggerType}.
    
    USER CONTEXT:
    - Patterns: ${context.atman?.knownPatterns?.map(p => typeof p === 'string' ? p : p.pattern).join(", ") || 'None'}
    - Sangha: ${context.atman?.keyRelationships?.map(r => `${r.name} (${r.dynamic})`).join(", ") || 'None'}
    - Emotion: ${context.atman?.emotionalState || 'Stable'}
    - Recent Events: ${context.atman?.activeEvents?.map(e => e.title).join(", ") || 'None'}

    OUTPUT JSON FORMAT ONLY:
    {
        "title": "Short poetic title (2-4 words)",
        "message": "One soulful sentence of guidance or inquiry."
    }

    RULES:
    - Tone: Deeply calm, slightly poetic, Vedic essence.
    - If morning_routine: Focus on discipline (Dharma).
    - If anniversary_reflection: Focus on how they have evolved since the event.
    - If transit_alert: Give a 1-sentence "vibe" of the current cosmic shift.
    - If emotional_stabilization: Be very grounding and soft.
    - If relational_management: Focus on a specific person from the Sangha (especially if dynamic is conflict/distant) with advice on compassion or boundaries.
    `;

    try {
        const result = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            config: { responseMimeType: "application/json" }
        });

        const text = result.text;
        if (!text) return { title: "Guru's Grace", message: "Step forward with awareness today." };
        return JSON.parse(text);
    } catch (error) {
        console.error("Nudge generation failed:", error);
        return { title: "Guru's Grace", message: "Listen to the silence within your heart." };
    }
}

/**
 * Generate a personalized Sadhana Path (3-day plan) based on current soul state
 */
export async function generateSadhanaPath(
    context: UserContext
): Promise<Array<{ day: number; practice: string; intention: string }>> {
    const ai = getClient();

    const prompt = `
    You are "Guru," the guide on AstroYou.
    Create a personalized 3-day spiritual path (Sadhana) for ${context.name || 'Ji'}.
    
    USER CONTEXT:
    - Patterns: ${context.atman?.knownPatterns?.map(p => typeof p === 'string' ? p : p.pattern).join(", ") || 'None'}
    - Recent Trends: ${context.atman?.emotionalHistory?.slice(-5).map(h => h.state).join(" -> ") || 'Stable'}
    - Emotion: ${context.atman?.emotionalState || 'Stable'}

    OUTPUT JSON FORMAT ONLY:
    [
        { "day": 1, "practice": "Breathwork (5 mins)", "intention": "Stability" },
        { "day": 2, "practice": "Mantra Meditation", "intention": "Clarity" },
        { "day": 3, "practice": "Silent Reflection", "intention": "Connection" }
    ]

    RULES:
    - Choose practices that balance their current emotional state.
    - If anxious: Grounding practices (Breathwork).
    - If energetic: Creative or moving practices (Yoga/Tapa).
    - If chaotic: Simple, very short calming focus.
    - Max 3 days.
    `;

    try {
        const result = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            config: { responseMimeType: "application/json" }
        });

        const text = result.text;
        if (!text) return [];
        // Clean markdown code blocks if present
        const jsonStr = text.replace(/```json\n?|\n?```/g, "").trim();
        return JSON.parse(jsonStr);
    } catch (error) {
        console.error("Sadhana path generation failed:", error);
        return [];
    }
}
