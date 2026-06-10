import { Config, Context } from "@netlify/functions";
import { synthesizeStream, analyzeUserConsciousness, generateChatTitle, generateConversationSummary, extractActionableAdvice } from "./shared/gemini";
import { auth, db } from "./shared/firebase-admin";
import { buildUserContext } from "./shared/user-context";
import { checkRateLimit, getRequestIdentifier } from "./shared/rate-limit";
import { persistAtmanInsights } from "./shared/atman-brain";

export default async (req: Request, _context: Context) => {
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

    const { messages, birthData, kundaliData, previousInteractionId, atmanData, recentSummaries, chatMessages, messageCount, yogaData, panchangData, personaPrompt, personaName, idToken } = body;

    let uid: string | undefined = undefined;
    if (idToken) {
        try {
            uid = (await auth.verifyIdToken(idToken)).uid;
        } catch {
            return new Response(JSON.stringify({ error: "Invalid auth token" }), {
                status: 401,
                headers: { "Content-Type": "application/json" },
            });
        }
    }

    const rateLimit = await checkRateLimit({
        scope: "ai_synthesis",
        key: uid || getRequestIdentifier(req),
        limit: uid ? 80 : 12,
        windowMs: 60 * 60 * 1000,
    });
    if (!rateLimit.allowed) {
        return new Response(JSON.stringify({
            error: "Too many AI requests. Please try again later.",
            resetAt: rateLimit.resetAt.toISOString(),
        }), {
            status: 429,
            headers: { "Content-Type": "application/json" },
        });
    }

    const { userContext, kundaliSummary } = await buildUserContext({
        uid,
        birthData,
        kundaliData,
        previousInteractionId,
        atmanData,
        recentSummaries: recentSummaries || undefined,
        yogaData,
        panchangData,
    });

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
                const brainResult = uid
                    ? await safe(persistAtmanInsights(
                        { db },
                        {
                            uid,
                            analysisResult,
                            extractedAdvice,
                            source: {
                                surface: "synthesis",
                                interactionId,
                                userMessage: lastUserMessage,
                                assistantMessage: fullContent,
                            },
                        },
                    ))
                    : null;

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
                    brainUpdated: Boolean(brainResult?.persisted),
                    generatedTitle: generatedTitle || null,
                    conversationSummary: conversationSummary || null,
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
