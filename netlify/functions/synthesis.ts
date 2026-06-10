import { Config, Context } from "@netlify/functions";
import crypto from "crypto";
import {
  synthesizeStream,
  analyzeUserConsciousness,
  generateChatTitle,
  generateConversationSummary,
  extractActionableAdvice,
} from "./shared/gemini";
import { auth, db, FieldValue } from "./shared/firebase-admin";
import { buildUserContext } from "./shared/user-context";
import { checkRateLimit, getRequestIdentifier } from "./shared/rate-limit";
import { persistAtmanInsights } from "./shared/atman-brain";
import { applyCreditChange, CreditError } from "./shared/credits";

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

  const {
    messages,
    birthData,
    kundaliData,
    previousInteractionId,
    atmanData,
    recentSummaries,
    chatMessages,
    messageCount,
    yogaData,
    panchangData,
    personaPrompt,
    personaName,
    idToken,
  } = body;

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

  // Authenticated users: hourly cap keyed on uid (and additionally credit-gated
  // below). Guests: a stricter server-side trial cap keyed on the (non-spoofable)
  // client IP — independent of the client-side localStorage timer, which is
  // trivially reset. Both scopes fail CLOSED on a rate-limit store outage.
  const ipKey = getRequestIdentifier(req);
  const limitChecks = uid
    ? [{ scope: "synthesis", key: uid, limit: 80, windowMs: 60 * 60 * 1000 }]
    : [
        {
          scope: "synthesis_guest",
          key: ipKey,
          limit: 6,
          windowMs: 60 * 60 * 1000,
        },
        {
          scope: "synthesis_guest_day",
          key: ipKey,
          limit: 15,
          windowMs: 24 * 60 * 60 * 1000,
        },
      ];
  for (const check of limitChecks) {
    const rateLimit = await checkRateLimit(check);
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({
          error: uid
            ? "Too many AI requests. Please try again later."
            : "Free trial limit reached. Please sign in to continue.",
          resetAt: rateLimit.resetAt.toISOString(),
        }),
        { status: 429, headers: { "Content-Type": "application/json" } },
      );
    }
  }

  // Validate messages input before doing any (paid) work.
  if (
    !Array.isArray(messages) ||
    messages.length === 0 ||
    typeof messages[messages.length - 1]?.content !== "string"
  ) {
    return new Response(
      JSON.stringify({ error: "messages must be a non-empty array" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  // Reserve 1 credit BEFORE the (expensive) Gemini call so a user cannot get
  // free generations by dropping the connection or blocking a client-side
  // deduction. Refunded inside the stream if generation produces nothing.
  // A unique ledgerId makes the charge idempotent per request.
  const creditTxnId = crypto.randomUUID();
  let creditCharged = false;
  if (uid) {
    try {
      await applyCreditChange(
        { db, FieldValue },
        {
          uid,
          amount: -1,
          type: "synthesis",
          source: "synthesis_chat",
          ledgerId: `synthesis_${creditTxnId}`,
          metadata: { surface: "synthesis" },
        },
      );
      creditCharged = true;
    } catch (err) {
      if (err instanceof CreditError) {
        return new Response(
          JSON.stringify({
            error: "You're out of credits. Please top up to continue.",
          }),
          { status: 402, headers: { "Content-Type": "application/json" } },
        );
      }
      console.error("[Synthesis] Credit reservation failed:", err);
      return new Response(
        JSON.stringify({
          error: "Could not start synthesis. Please try again.",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }
  }

  const refundCredit = async () => {
    if (!uid || !creditCharged) return;
    try {
      await applyCreditChange(
        { db, FieldValue },
        {
          uid,
          amount: 1,
          type: "refund",
          source: "synthesis_refund",
          ledgerId: `synthesis_refund_${creditTxnId}`,
          metadata: { reason: "generation_failed" },
        },
      );
    } catch (err) {
      console.error("[Synthesis] Credit refund failed:", err);
    }
  };

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
          ? `\n\nPERSONA OVERRIDE:\nYour name is ${personaName || "Astrologer"}. ${personaPrompt}`
          : undefined;

        for await (const event of synthesizeStream(
          messages.map((m: any) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
          userContext,
          kundaliSummary,
          previousInteractionId,
          personaOverride,
        )) {
          if (event.type === "delta") {
            send({ type: "delta", text: event.text });
          } else if (event.type === "complete") {
            fullContent = event.content;
            interactionId = event.interactionId;
            suggestedRoutine = event.suggestedRoutine;
          }
        }

        // If the model produced nothing, the user got no value — refund.
        if (!fullContent.trim()) {
          await refundCredit();
          send({
            type: "error",
            error: "No response generated. Your credit was not charged.",
          });
          controller.close();
          return;
        }

        // Post-processing in parallel (each failure-safe)
        const shouldGenerateSummary =
          (messageCount || 0) >= 2 && chatMessages?.length > 0;
        const safe = <T>(p: Promise<T>): Promise<T | null> =>
          p.catch((err) => {
            console.warn(
              "[Synthesis] Parallel task failed:",
              err?.message || err,
            );
            return null;
          });

        const [
          analysisResult,
          generatedTitle,
          conversationSummary,
          extractedAdvice,
        ] = await Promise.all([
          safe(
            messages.length > 0
              ? analyzeUserConsciousness(messages.slice(-5), userContext)
              : Promise.resolve(null),
          ),
          safe(
            isFirstMessage
              ? generateChatTitle(lastUserMessage, fullContent)
              : Promise.resolve(null),
          ),
          safe(
            shouldGenerateSummary
              ? generateConversationSummary(
                  [
                    ...(chatMessages || []),
                    { role: "user", content: lastUserMessage },
                    { role: "assistant", content: fullContent },
                  ],
                  userContext.name,
                )
              : Promise.resolve(null),
          ),
          safe(extractActionableAdvice(fullContent, lastUserMessage)),
        ]);
        const brainResult = uid
          ? await safe(
              persistAtmanInsights(
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
              ),
            )
          : null;

        // Chart request detection
        const lowerMsg = lastUserMessage.toLowerCase();
        const isRequestingChart = [
          "chart",
          "kundali",
          "horoscope",
          "show",
          "visualize",
          "blueprint",
          "map",
        ].some((k) => lowerMsg.includes(k));

        // Send final metadata event
        send({
          type: "done",
          content: fullContent,
          interactionId,
          suggestAction: isRequestingChart ? "show_chart" : null,
          brainUpdated: Boolean(brainResult?.persisted),
          generatedTitle: generatedTitle || null,
          conversationSummary: conversationSummary || null,
          suggestedRoutine: suggestedRoutine || null,
        });

        controller.close();
      } catch (error: any) {
        console.error("Synthesis streaming error:", error);
        // Generation failed — refund the reserved credit.
        await refundCredit();
        send({
          type: "error",
          error: "Synthesis failed. Your credit was not charged.",
        });
        controller.close();
      }
    },
  });

  return new Response(readable, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
};

export const config: Config = {
  path: "/api/synthesis",
};
