import { Config, Context } from "@netlify/functions";
import { synthesizeStream, analyzeUserConsciousness, generateChatTitle, generateConversationSummary, extractActionableAdvice, UserContext } from "./shared/gemini";
import { getDashaPeriods, getTransitReport, getYogaAnalysis, getPanchang } from "./shared/astro-api";

export default async (req: Request, context: Context) => {
    if (req.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
    }

    let body: any;
    try {
        body = await req.json();
    } catch {
        return new Response(JSON.stringify({ error: "Invalid request body" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
        });
    }

    const { messages, birthData, kundaliData, previousInteractionId, atmanData, recentSummaries, chatMessages, messageCount, yogaData, panchangData, personaPrompt, personaName } = body;

    // Build kundali summary for AI context
    const kundaliSummary = kundaliData?.planetary_positions?.map((p: any) =>
        `${p.name} in ${p.sign} (${p.house}th House)${p.is_retrograde ? ' [Retrograde]' : ''}`
    ).join(', ') || 'Planetary data currently veiled.';

    // Fetch Dasha + Transit + Yoga + Panchang data for first message (with 5s timeout)
    let dashaInfo: UserContext['dashaInfo'] = undefined;
    let transitContext: string | undefined = undefined;
    let yogasResult: any = null;
    let panchangResult: any = null;
    const withTimeout = <T,>(promise: Promise<T>, ms: number, fallback: T): Promise<T> =>
        Promise.race([
            promise,
            new Promise<T>(resolve => { const t = setTimeout(() => resolve(fallback), ms); if (typeof t === 'object' && 'unref' in t) (t as any).unref(); }),
        ]);

    if (!previousInteractionId && birthData?.dob && birthData?.tob) {
        try {
            const [dashas, transitEvents, yogasRes, panchangRes] = await Promise.all([
                withTimeout(getDashaPeriods(birthData), 5000, []),
                withTimeout(getTransitReport(birthData), 5000, []),
                withTimeout(getYogaAnalysis(birthData), 5000, null),
                withTimeout(getPanchang(), 5000, null),
            ]);

            yogasResult = yogasRes;
            panchangResult = panchangRes;

            if (dashas && dashas.length > 0) {
                const currentMaha = dashas.find((d: any) => d.isCurrent);
                const currentAntar = currentMaha?.subPeriods?.find((s: any) => s.isCurrent);
                dashaInfo = {
                    currentMahadasha: currentMaha?.planet || currentMaha?.planetName,
                    currentAntardasha: currentAntar?.planet || currentAntar?.planetName,
                    mahadashaEnd: currentMaha?.endDate,
                    antardashaEnd: currentAntar?.endDate,
                };
            }

            if (transitEvents && transitEvents.length > 0) {
                transitContext = transitEvents.slice(0, 6).map((e: any) =>
                    `${e.transit_planet || e.planet || 'Planet'} ${e.aspect_type || e.aspect || 'aspecting'} natal ${e.natal_planet || e.natal_body || e.target || 'point'}: ${e.interpretation || e.description || e.text || 'Active transit'}`
                ).join('\n');
            }
        } catch (err) {
            console.warn("[Synthesis] Dasha/Transit fetch failed (non-critical):", err);
        }
    }

    // Build user context
    const userContext: UserContext = {
        name: birthData?.name || 'Jataka',
        birthData: birthData ? { dob: birthData.dob, tob: birthData.tob, pob: birthData.pob } : undefined,
        dashaInfo,
        atman: atmanData,
        recentSummaries: recentSummaries || undefined,
        transitContext: transitContext || undefined,
        recentAdvice: atmanData?.adviceHistory?.slice(-5) || undefined,
        yogaData: yogaData || yogasResult?.yogas?.slice(0, 5) || [],
        panchangData: panchangData || panchangResult || undefined,
    };

    const encoder = new TextEncoder();
    const isFirstMessage = !previousInteractionId;
    const lastUserMessage = messages[messages.length - 1].content;

    const readable = new ReadableStream({
        async start(controller) {
            const send = (data: any) => {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
            };

            try {
                let fullContent = "";
                let interactionId = "";
                let suggestedRoutine: any = undefined;

                // Stream AI response
                const personaOverride = personaPrompt
                    ? `\n\nPERSONA OVERRIDE:\nYour name is ${personaName || 'Astrologer'}. ${personaPrompt}`
                    : undefined;

                for await (const event of synthesizeStream(
                    messages.map((m: any) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
                    userContext,
                    kundaliSummary,
                    previousInteractionId,
                    personaOverride
                )) {
                    if (event.type === 'delta') {
                        send({ type: 'delta', text: event.text });
                    } else if (event.type === 'complete') {
                        fullContent = event.content;
                        interactionId = event.interactionId;
                        suggestedRoutine = event.suggestedRoutine;
                    }
                }

                // Post-processing in parallel (each failure-safe)
                const shouldGenerateSummary = (messageCount || 0) >= 2 && chatMessages?.length > 0;
                const safe = <T,>(p: Promise<T>): Promise<T | null> => p.catch((err) => {
                    console.warn("[Synthesis] Parallel task failed:", err?.message || err);
                    return null;
                });

                const [analysisResult, generatedTitle, conversationSummary, extractedAdvice] = await Promise.all([
                    safe(messages.length > 0 ? analyzeUserConsciousness(messages.slice(-5), userContext) : Promise.resolve(null)),
                    safe(isFirstMessage ? generateChatTitle(lastUserMessage, fullContent) : Promise.resolve(null)),
                    safe(shouldGenerateSummary
                        ? generateConversationSummary(
                            [...(chatMessages || []), { role: 'user', content: lastUserMessage }, { role: 'assistant', content: fullContent }],
                            userContext.name)
                        : Promise.resolve(null)),
                    safe(extractActionableAdvice(fullContent, lastUserMessage)),
                ]);

                // Chart request detection
                const lowerMsg = lastUserMessage.toLowerCase();
                const isRequestingChart = ["chart", "kundali", "horoscope", "show", "visualize", "blueprint", "map"]
                    .some(k => lowerMsg.includes(k));

                // Send final metadata event
                send({
                    type: 'done',
                    content: fullContent,
                    interactionId,
                    suggestAction: isRequestingChart ? 'show_chart' : null,
                    atmanUpdate: analysisResult,
                    generatedTitle: generatedTitle || null,
                    conversationSummary: conversationSummary || null,
                    extractedAdvice: extractedAdvice || null,
                    suggestedRoutine: suggestedRoutine || null,
                });

                controller.close();
            } catch (error: any) {
                console.error("Synthesis streaming error:", error);
                send({ type: 'error', error: error.message || 'Synthesis failed' });
                controller.close();
            }
        }
    });

    return new Response(readable, {
        status: 200,
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    });
};

export const config: Config = {
    path: "/api/synthesis"
};
