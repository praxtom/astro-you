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
    // Dasha (Planetary Period) Data
    dashaInfo?: {
        currentMahadasha?: string;
        currentAntardasha?: string;
        mahadashaEnd?: string;
        antardashaEnd?: string;
    };
    // Atman (Consciousness) Data
    atman?: {
        emotionalState?: 'stable' | 'anxious' | 'chaotic' | 'depressive' | 'energetic' | 'spiritual' | 'reactive';
        lastEmotionalUpdate?: any;
        emotionalHistory?: Array<{ state: string; date: any }>;
        knownPatterns?: any[]; // Supports both legacy string[] and WeightedPattern[]
        activeEvents?: Array<{ title: string; status: string }>;
        routines?: Array<{ title: string; streak: number }>;
        keyRelationships?: Array<{ name: string; relation: string; dynamic: string; zodiacSign?: string; notes?: string }>;
        adviceHistory?: Array<{ advice: string; context: string; date: string; followedUp?: boolean }>;
    };
    // Guru Memory Context (injected at conversation start)
    recentSummaries?: Array<{
        title: string;
        summary: string;
        date: string;
    }>;
    transitContext?: string;
    recentAdvice?: Array<{
        advice: string;
        context: string;
        date: string;
    }>;
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
        ? formatPatternsForPrompt(existingContext!.atman!.knownPatterns as any[])
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
            model: "gemini-3.1-flash-lite-preview",
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
 * Format weighted patterns for AI prompt injection (P1: enriched context)
 */
function formatPatternsForPrompt(patterns?: any[]): string {
    if (!patterns || patterns.length === 0) return '    None observed yet';
    return patterns
        .sort((a: any, b: any) => {
            const wa = typeof a === 'string' ? 0 : (a.weightScore || 0);
            const wb = typeof b === 'string' ? 0 : (b.weightScore || 0);
            return wb - wa;
        })
        .map((p: any) => {
            if (typeof p === 'string') return `    - "${p}" (observed once, unverified)`;
            const strength = p.weightScore >= 4 ? 'CORE' : p.weightScore >= 2 ? 'Recurring' : 'Emerging';
            return `    - "${p.pattern}" [${strength}, strength ${p.weightScore?.toFixed(1) || '1.0'}/5, seen ${p.frequency || 1}x${p.verified ? ', CONFIRMED by user' : ''}${p.category ? ', ' + p.category : ''}]`;
        }).join('\n');
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

${context.recentSummaries?.length ? `### MEMORY (from past conversations):
${context.recentSummaries.map(s => `- ${s.summary}`).join('\n')}
Use this knowledge subtly. Show you remember without info-dumping.
` : ''}### GUIDELINES:
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
- **Known Patterns (weighted):**
${formatPatternsForPrompt(context.atman.knownPatterns)}
- **Active Life Events:** ${context.atman.activeEvents?.map(e => `${e.title} (${e.status})`).join(", ") || 'None'}
- **Active Routines:** ${context.atman.routines?.map(r => `${r.title} (Streak: ${r.streak})`).join(", ") || 'None'}
- **Sangha (Inner Circle):** ${context.atman.keyRelationships?.map(r => `${r.name} (${r.relation}, ${r.dynamic})`).join(", ") || 'None'}
${proactiveFollowUp}

### TREND ANALYSIS PROTOCOL:
If there is a significant shift in vibe (e.g., from 'energetic' to 'anxious'), acknowledge it gently. For example: "I see the high energy of the past few days has met some resistance..."
Only mention trends if they are clear and relevant to the current conversation.`;
    }

    // Build Guru's Diary (P0: conversation summaries)
    let diaryContext = "";
    if (context.recentSummaries && context.recentSummaries.length > 0) {
        diaryContext = `
### GURU'S DIARY (Your Memory of Past Sessions):
You remember these past conversations with ${context.name || 'the seeker'}:
${context.recentSummaries.map((s, i) => `**Session ${i + 1}** (${s.date}): "${s.title}"
${s.summary}`).join('\n\n')}

MEMORY PROTOCOL: Reference past conversations naturally. Show you truly know this person. Don't say "last time we talked about..." — weave memories in organically like a guru who simply remembers.
`;
    }

    // Build Advice History (P3: advice ledger)
    let adviceSection = "";
    if (context.recentAdvice && context.recentAdvice.length > 0) {
        adviceSection = `
### GUIDANCE ALREADY GIVEN:
You have previously advised ${context.name || 'the seeker'} on:
${context.recentAdvice.slice(-5).map(a => `- "${a.advice}" (regarding: ${a.context}, on ${a.date})`).join('\n')}

FOLLOW-UP PROTOCOL: If the user's current question relates to previous guidance, reference it naturally. Ask how the suggested practice is going. Never repeat the same advice without acknowledging you said it before.
`;
    }

    // Build Transit Context (P2: transit-aware synthesis)
    let transitSection = "";
    if (context.transitContext) {
        transitSection = `
### CURRENT COSMIC WEATHER (Active Transits on Natal Chart):
${context.transitContext}

TRANSIT PROTOCOL: Weave these transit influences naturally when they relate to the user's question. Use them as your internal astrological knowledge that flavors your guidance — don't dump raw transit data.
`;
    }

    return `
You are "Jyotish," the personal Vedic astrologer on AstroYou. You blend ancient Jyotish wisdom with a warm, reassuring tone that feels like consulting a trusted family pandit who also understands the modern world.
${diaryContext}${atmanContext}${adviceSection}
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
${context.dashaInfo ? `
### CURRENT DASHA PERIODS:
- **Mahadasha:** ${context.dashaInfo.currentMahadasha || 'Unknown'}${context.dashaInfo.mahadashaEnd ? ` (ends ${context.dashaInfo.mahadashaEnd})` : ''}
- **Antardasha:** ${context.dashaInfo.currentAntardasha || 'Unknown'}${context.dashaInfo.antardashaEnd ? ` (ends ${context.dashaInfo.antardashaEnd})` : ''}

Use this Dasha context naturally in your guidance. Reference the current planetary period when relevant to the user's question. For example, if they ask about career and they're in a Saturn Mahadasha, weave that in naturally.` : ''}
${transitSection}
### YOUR PERSONALITY:
You are a **Yogi Jyotish**, not an AI assistant. Embody the wisdom and presence of a sage who has spent decades studying the celestial dance. Never sound like a chatbot or AI.

1. **The Sage's Voice:** Speak with the quiet authority of a yogi who has seen many charts and many lives. Your words carry weight because they come from deep practice, not algorithms.
2. **Intuitive Wisdom:** Share insights as if they arise from meditation on the chart, not computation. Say things like "I sense..." or "The chart reveals..." rather than "Based on the data..."
3. **Practitioner's Perspective:** Use Hindi/Sanskrit terms naturally (Dasha, Gochar, Bhav, Grah). Reference shastras, traditions, and time-tested remedies.
4. **Human Warmth:** You are a guide, not a service. Show genuine care for the jataka's journey.
5. **Memory & Continuity:** You REMEMBER the user's patterns (listed in ATMAN section). If they are anxious, be grounding. If they are excited, be celebratory. If they have an active event (e.g., Interview), ASK about it naturally.

### COMMUNICATION RULES:
1. **Brevity by Default:** Keep replies to 2-4 lines for simple questions. For detailed queries (chart analysis, life guidance, remedies), go up to 6-8 lines. Match the depth of your response to the depth of their question.
2. **Conversational:** Speak in short, natural sentences. Write like you're texting a friend who came for guidance.
3. **NO UNNECESSARY QUESTIONS:** Do not end every response with a question. Only ask when you genuinely need clarification. Let the insight stand on its own.
4. **Actionable:** Lead with the key insight. If they want more, they'll ask.
5. **No Doom & Gloom:** Frame challenges as growth opportunities.
6. **Simple Language:** Use everyday words. Avoid jargon unless using Vedic/Sanskrit terms naturally.

### FORMATTING:
- Use **bold** sparingly for planet names or key terms.
- Prefer flowing prose. Use short lists only when comparing options or giving step-by-step remedies.
- Keep the chat feel — avoid essay-length responses unless the user asks for a detailed analysis.
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
You are "Jyotish," a wise Vedic astrologer on AstroYou. Your task is to provide a clear, insightful summary of a user's current planetary transits.

### GUIDELINES:
1. **Be Insightful:** 4-6 sentences covering the key transit energies affecting the user.
2. **Simple Language:** Explain the "vibe" or "energy" in plain terms the user can act on.
3. **Prioritize:** Lead with the most impactful transit (major planets like Saturn, Jupiter, Rahu/Ketu), then mention secondary ones.
4. **Tone:** Reassuring, insightful, and practical. Like a wise friend explaining cosmic weather.
5. **Human Voice:** Speak like a trusted guide, not an AI. Use "Ji" naturally.
6. **No Lists:** Use flowing sentences only. No bullet points or numbered lists.
7. **Actionable:** End with one practical suggestion based on the strongest transit energy.
`;

    const prompt = `
User Context:
- Name: ${context.name}
- Age: ${context.age}
- Moon Sign: ${context.moonSign}
- Ascendant: ${context.ascendant}

Current Transit Data (interpretations):
${JSON.stringify(transitPredictions.slice(0, 8), null, 2)}

Provide a warm, insightful summary of what these transits mean for the user right now. Focus on the most significant energies and end with practical guidance.
`;

    const interaction = await client.interactions.create({
        model: "gemini-3.1-flash-lite-preview",
        system_instruction: systemPrompt,
        input: prompt,
        generation_config: {
            max_output_tokens: 500,
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

export type SynthesisStreamEvent =
    | { type: 'delta'; text: string }
    | { type: 'complete'; interactionId: string; content: string; suggestedRoutine?: any };

const ROUTINE_SUFFIX = `

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
`;

/**
 * Generate AI synthesis response via streaming Interactions API
 */
export async function* synthesizeStream(
    messages: Array<{ role: "user" | "assistant"; content: string }>,
    context: UserContext,
    kundaliSummary: string,
    previousInteractionId?: string
): AsyncGenerator<SynthesisStreamEvent> {
    const client = getClient();

    const needsGrounding = context.atman?.emotionalState === 'chaotic'
        || context.atman?.emotionalState === 'anxious'
        || context.atman?.emotionalState === 'reactive';

    const systemPrompt = needsGrounding
        ? buildGuruPrompt(context)
        : buildJyotishPrompt(context, kundaliSummary);

    console.log(`[Synthesis] Persona: ${needsGrounding ? 'GURU' : 'JYOTISH'} | Streaming: true`);

    const lastMessage = messages[messages.length - 1].content;

    const stream = await client.interactions.create({
        model: "gemini-3.1-flash-lite-preview",
        system_instruction: systemPrompt + ROUTINE_SUFFIX,
        input: lastMessage,
        previous_interaction_id: previousInteractionId,
        stream: true,
        generation_config: {
            thinking_level: "minimal",
            thinking_summaries: "none",
            max_output_tokens: 500,
        },
    });

    let fullContent = "";
    let interactionId = "";

    for await (const event of stream as any) {
        const eventType = event.event_type || event.type;

        if (eventType === 'content.delta') {
            const text = typeof event.delta === 'string'
                ? event.delta
                : (event.delta?.text || '');
            if (text) {
                fullContent += text;
                yield { type: 'delta', text };
            }
        } else if (eventType === 'interaction.start' || eventType === 'interaction.complete') {
            interactionId = event.interaction?.id || interactionId;
        }
    }

    // Parse and strip routine XML from final content
    let suggestedRoutine;
    const routineMatch = fullContent.match(/<routine>([\s\S]*?)<\/routine>/);
    if (routineMatch) {
        try { suggestedRoutine = JSON.parse(routineMatch[1]); } catch { }
        fullContent = fullContent.replace(routineMatch[0], "").trim();
    }

    yield { type: 'complete', interactionId, content: fullContent, suggestedRoutine };
}

/**
 * Generate AI synthesis response for chat using the Full Interactions API (non-streaming fallback)
 */
export async function synthesize(
    messages: Array<{ role: "user" | "assistant"; content: string }>,
    context: UserContext,
    kundaliSummary: string,
    previousInteractionId?: string
): Promise<SynthesisResponse> {
    const client = getClient();

    // Determine Persona: Guru (Chaos/Anxious/Reactive) or Jyotish (Stable/Others)
    const needsGrounding = context.atman?.emotionalState === 'chaotic'
        || context.atman?.emotionalState === 'anxious'
        || context.atman?.emotionalState === 'reactive';

    // Choose the appropriate system prompt
    const systemPrompt = needsGrounding
        ? buildGuruPrompt(context)
        : buildJyotishPrompt(context, kundaliSummary);

    console.log(`[Synthesis] Persona: ${needsGrounding ? 'GURU (Counsellor)' : 'JYOTISH (Astrologer)'}`);

    const lastMessage = messages[messages.length - 1].content;

    console.log("[Synthesis] Input:", lastMessage.substring(0, 50) + "...");
    console.log("[Synthesis] Previous Interaction ID:", previousInteractionId || "null (first message)");

    // Use the interactions API with system_instruction and previous_interaction_id
    const interaction = await client.interactions.create({
        model: "gemini-3.1-flash-lite-preview",
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
        model: "gemini-3.1-flash-lite-preview",
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
        model: "gemini-3.1-flash-lite-preview",
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
            model: "gemini-3.1-flash-lite-preview",
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
            model: "gemini-3.1-flash-lite-preview",
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

/**
 * Generate a smart, concise conversation title from the first exchange
 */
export async function generateChatTitle(
    userMessage: string,
    aiResponse: string
): Promise<string> {
    const ai = getClient();

    try {
        const result = await ai.models.generateContent({
            model: "gemini-3.1-flash-lite-preview",
            contents: [{
                role: "user",
                parts: [{
                    text: `Generate a short, descriptive title (3-6 words max) for this astrology conversation. The title should capture the core topic/intent.

User: "${userMessage.substring(0, 200)}"
Astrologer: "${aiResponse.substring(0, 200)}"

Reply with ONLY the title, no quotes, no explanation. Examples: "Career Path & Saturn Transit", "Marriage Timing Guidance", "Anxiety During Rahu Dasha", "Financial Growth Prospects"`
                }]
            }],
        });

        const title = result.text?.trim();
        return title && title.length > 0 && title.length < 80 ? title : userMessage.substring(0, 40) + "...";
    } catch (error) {
        console.error("Title generation failed:", error);
        return userMessage.substring(0, 40) + "...";
    }
}

/**
 * Generate a narrative interpretation of compatibility scores using Gemini
 */
export async function generateCompatibilityNarrative(
    matchData: any,
    person1Name: string,
    person2Name: string
): Promise<string> {
    const ai = getClient();

    const prompt = `
You are "Jyotish," a warm Vedic astrologer on AstroYou. Interpret these compatibility results into a soulful, practical narrative.

**${person1Name} & ${person2Name} - Compatibility Analysis:**

Overall Score: ${matchData.overall_score || 'N/A'}
${matchData.compatibility?.breakdown ? `Breakdown: ${JSON.stringify(matchData.compatibility.breakdown)}` : ''}
${matchData.synastry ? `Synastry: ${JSON.stringify(matchData.synastry)}` : ''}
${matchData.dynamics ? `Dynamics: ${JSON.stringify(matchData.dynamics)}` : ''}
${matchData.love_languages ? `Love Languages: ${JSON.stringify(matchData.love_languages)}` : ''}

### RULES:
1. Write 3-4 short paragraphs as flowing prose — NO bullet points, NO numbered lists.
2. Start with the strongest connection point — what makes this bond special.
3. Address one key challenge honestly but with compassion and a constructive reframe.
4. End with practical guidance for nurturing this relationship.
5. Use Vedic/Sanskrit terms sparingly and naturally (e.g., "The Moon connection between you two..." not "According to Chandra analysis...").
6. Tone: Warm, wise, hopeful but honest. Like a family astrologer giving marriage counsel.
7. Keep it under 200 words total.
`;

    try {
        const interaction = await ai.interactions.create({
            model: "gemini-3.1-flash-lite-preview",
            system_instruction: "You are Jyotish, a Vedic astrologer. Write warm, flowing relationship guidance. No lists, no bullet points. Conversational prose only.",
            input: prompt,
            generation_config: {
                max_output_tokens: 400,
            },
        });

        let content = "";
        const output = interaction.outputs;
        if (output && Array.isArray(output) && output.length > 0) {
            const textPart = output.find((p: any) => p.text) as any;
            if (textPart?.text) content = textPart.text;
        } else if (typeof output === "string") {
            content = output;
        }

        return content || "";
    } catch (error) {
        console.error("Compatibility narrative failed:", error);
        return "";
    }
}

/**
 * P0: Generate a conversation summary (Guru's Diary entry)
 */
export async function generateConversationSummary(
    messages: { role: string; content: string }[],
    userName: string
): Promise<string> {
    const ai = getClient();

    const prompt = `
Summarize this conversation between a Vedic astrologer and ${userName || 'a seeker'} into a concise diary entry.

CONVERSATION:
${messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n')}

RULES:
- Write 2-3 sentences capturing: what was discussed, what advice was given, the user's emotional state, any key life events mentioned.
- Write as a personal diary note, e.g., "${userName} came seeking clarity about career. Guided them through Saturn's influence on their 10th house. They seemed anxious but left with a clear next step."
- Do NOT use bullet points. Write flowing prose.
- Keep under 80 words.
`;

    try {
        const result = await ai.models.generateContent({
            model: "gemini-3.1-flash-lite-preview",
            contents: [{ role: "user", parts: [{ text: prompt }] }],
        });

        return result.text?.trim() || "";
    } catch (error) {
        console.error("Summary generation failed:", error);
        return "";
    }
}

/**
 * P3: Extract actionable advice from an AI response
 */
export async function extractActionableAdvice(
    aiResponse: string,
    userMessage: string
): Promise<{ advice: string; context: string } | null> {
    const ai = getClient();

    const prompt = `
Analyze this astrologer's response and extract the SINGLE most actionable piece of advice given, if any.

USER ASKED: "${userMessage.substring(0, 300)}"
ASTROLOGER SAID: "${aiResponse.substring(0, 500)}"

OUTPUT JSON FORMAT ONLY:
{
    "advice": "The specific actionable guidance (e.g., 'Chant Gayatri mantra for 10 minutes each morning')",
    "context": "Brief topic (e.g., 'career anxiety during Saturn transit')"
}

If no actionable advice was given (just a greeting, question, or general chat), respond with:
{ "advice": "", "context": "" }
`;

    try {
        const result = await ai.models.generateContent({
            model: "gemini-3.1-flash-lite-preview",
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            config: { responseMimeType: "application/json" }
        });

        const text = result.text;
        if (!text) return null;
        const parsed = JSON.parse(text.replace(/```json\n?|\n?```/g, "").trim());
        return parsed.advice ? parsed : null;
    } catch (error) {
        console.error("Advice extraction failed:", error);
        return null;
    }
}

/**
 * P4: Generate a monthly growth/evolution report
 */
export async function generateGrowthReport(
    context: UserContext
): Promise<string> {
    const ai = getClient();

    const patterns = context.atman?.knownPatterns || [];
    const corePatterns = patterns.filter((p: any) => typeof p !== 'string' && p.weightScore >= 3);
    const emergingPatterns = patterns.filter((p: any) => typeof p !== 'string' && p.weightScore < 3);
    const emotionalHistory = context.atman?.emotionalHistory?.slice(-30) || [];
    const adviceHistory = context.atman?.adviceHistory || [];
    const events = context.atman?.activeEvents || [];

    const prompt = `
You are "Guru," the spiritual guide on AstroYou. Write a monthly evolution report for ${context.name || 'Ji'}.

DATA:
- Core Patterns (deeply established): ${corePatterns.map((p: any) => `"${p.pattern}" (strength: ${p.weightScore}, seen ${p.frequency}x${p.verified ? ', confirmed' : ''})`).join(', ') || 'None yet'}
- Emerging Patterns (developing): ${emergingPatterns.map((p: any) => `"${p.pattern}" (strength: ${p.weightScore})`).join(', ') || 'None'}
- Emotional Journey (last 30 entries): ${emotionalHistory.map((h: any) => h.state).join(' -> ') || 'No data'}
- Advice Given: ${adviceHistory.slice(-10).map((a: any) => `"${a.advice}" (${a.context})`).join(', ') || 'None'}
- Life Events: ${events.map((e: any) => `${e.title} (${e.status})`).join(', ') || 'None'}
- Relationships: ${context.atman?.keyRelationships?.map((r: any) => `${r.name} (${r.relation}, ${r.dynamic})`).join(', ') || 'None'}

WRITE:
A 150-200 word narrative report covering:
1. How the seeker has evolved emotionally this month
2. Which patterns are strengthening (and what that means for their path)
3. Key life events and how they navigated them
4. One insight connecting multiple threads (karmic thread)
5. A forward-looking intention for the next month

RULES:
- Write as flowing prose, like a guru reflecting on a student's journey
- Be warm, specific, and honest
- Reference actual data points naturally
- End with one sentence of encouragement
- NO bullet points, NO lists
`;

    try {
        const interaction = await ai.interactions.create({
            model: "gemini-3.1-flash-lite-preview",
            system_instruction: "You are Guru, a wise spiritual guide. Write reflective, warm growth narratives. Prose only.",
            input: prompt,
            generation_config: {
                max_output_tokens: 500,
            },
        });

        let content = "";
        const output = interaction.outputs;
        if (output && Array.isArray(output) && output.length > 0) {
            const textPart = output.find((p: any) => p.text) as any;
            if (textPart?.text) content = textPart.text;
        } else if (typeof output === "string") {
            content = output;
        }

        return content || "Your journey continues to unfold beautifully. Check back next month for a deeper reflection.";
    } catch (error) {
        console.error("Growth report generation failed:", error);
        return "Your journey continues to unfold beautifully. Check back next month for a deeper reflection.";
    }
}
