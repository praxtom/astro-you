import { Config, Context } from "@netlify/functions";
import crypto from "crypto";
import {
  synthesizeStream,
  generateChatTitle,
  boundSummaryWindow,
} from "./shared/gemini";
import { auth, db, FieldValue } from "./shared/firebase-admin";
import { buildUserContext } from "./shared/user-context";
import { checkRateLimit, getRequestIdentifier } from "./shared/rate-limit";
import { dispatchBackgroundJob } from "./shared/internal-dispatch";
import {
  recordInteractionId,
  type RetentionDb,
} from "./shared/interaction-retention";
import {
  finishSynthesisTurn,
  runSynthesisPostprocess,
  shouldSummarizeTurn,
  SYNTHESIS_POSTPROCESS_FUNCTION,
  type SynthesisPostprocessJob,
} from "./shared/synthesis-postprocess";
import { createSynthesisPostprocessDeps } from "./shared/synthesis-postprocess-deps";
import { isWithinSynthesisInputLimits } from "./shared/synthesis-limits";
import { applyCreditChange, CreditError } from "./shared/credits";
import { getConsultPersona } from "./shared/consult-session";
import { isPaidSubscriptionActive } from "./shared/subscription-plans";
import { CRISIS_SAFETY_REPLY, detectCrisisRisk } from "./shared/safety";
import {
  raceWithTimeout,
  sanitizeCompatibilityContext,
  SSE_KEEPALIVE_COMMENT,
  SSE_OPEN_COMMENT,
  SYNTHESIS_FIRST_TOKEN_TIMEOUT_MS,
  SYNTHESIS_KEEPALIVE_MS,
  SYNTHESIS_TIMEOUT_MESSAGE,
  SYNTHESIS_TOTAL_TIMEOUT_MS,
  TIMED_OUT,
} from "./shared/synthesis-stream";

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
};

/** How long "done" may wait for the (concurrently started) chat title. */
const TITLE_GRACE_MS = 1_500;

class SynthesisTimeoutError extends Error {
  constructor() {
    super("synthesis_timeout");
    this.name = "SynthesisTimeoutError";
  }
}

/**
 * Persist the assistant reply server-side so a user who closes the tab before
 * the client's own write still keeps the answer. The doc id is the
 * client-supplied assistantMessageId, so this is idempotent with the client's
 * setDoc — no duplicate message. Never throws.
 */
async function persistAssistantReply(input: {
  uid?: string;
  chatId: unknown;
  assistantMessageId: unknown;
  content: string;
  interactionId?: string;
  generatedTitle?: string | null;
}): Promise<void> {
  const { uid, chatId, assistantMessageId, content, interactionId } = input;
  if (
    !uid ||
    typeof chatId !== "string" ||
    !chatId ||
    typeof assistantMessageId !== "string" ||
    !assistantMessageId
  ) {
    return;
  }
  try {
    const chatRef = db
      .collection("users")
      .doc(uid)
      .collection("chats")
      .doc(chatId);
    await chatRef
      .collection("messages")
      .doc(assistantMessageId)
      .set(
        {
          role: "assistant",
          content,
          clientId: assistantMessageId,
          interactionId: interactionId || null,
          timestamp: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    await chatRef.set(
      {
        ...(interactionId ? { lastInteractionId: interactionId } : {}),
        lastInteractionAt: FieldValue.serverTimestamp(),
        ...(input.generatedTitle ? { title: input.generatedTitle } : {}),
      },
      { merge: true },
    );
  } catch (persistErr: any) {
    // Never fail the response over persistence — the client also writes.
    console.error(
      "[Synthesis] Server-side reply persist failed:",
      persistErr?.name || "error",
    );
  }
}

/**
 * Fixed safety reply, streamed in the same SSE format the client parses.
 * No model call, no credit charge, no memory writes.
 */
function crisisSafetyResponse(): Response {
  const encoder = new TextEncoder();
  const frame = (data: unknown) =>
    encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
  const readable = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(SSE_OPEN_COMMENT));
      controller.enqueue(frame({ type: "delta", text: CRISIS_SAFETY_REPLY }));
      controller.enqueue(
        frame({
          type: "done",
          content: CRISIS_SAFETY_REPLY,
          interactionId: null,
          suggestAction: null,
          brainUpdated: false,
          generatedTitle: null,
          conversationSummary: null,
          suggestedRoutine: null,
          safety: "crisis",
        }),
      );
      controller.close();
    },
  });
  return new Response(readable, { status: 200, headers: SSE_HEADERS });
}

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
    personaId,
    idToken,
    chatId,
    assistantMessageId,
    compatibilityContext: rawCompatibilityContext,
    localDate,
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

  // Bound the prompt payload: an unbounded transcript (or a single huge
  // message) is a cheap way to run up our Gemini bill on one credit, and can
  // blow the model's context window. Applies to the history we replay too.
  if (!isWithinSynthesisInputLimits(messages)) {
    return new Response(JSON.stringify({ error: "Message too long" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (
    chatMessages !== undefined &&
    !isWithinSynthesisInputLimits(chatMessages)
  ) {
    return new Response(JSON.stringify({ error: "Message too long" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Crisis safety screen — deterministic, BEFORE rate limits, credit
  // reservation or any model call, for guests and signed-in users alike. A
  // person in crisis must never hit a paywall or a trial cap, and the model
  // must never improvise around self-harm.
  if (detectCrisisRisk(messages[messages.length - 1].content)) {
    if (uid) {
      await persistAssistantReply({
        uid,
        chatId,
        assistantMessageId,
        content: CRISIS_SAFETY_REPLY,
      });
    }
    return crisisSafetyResponse();
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
            ? "Too many requests. Please try again later."
            : "Free trial limit reached. Please sign in to continue.",
          resetAt: rateLimit.resetAt.toISOString(),
        }),
        { status: 429, headers: { "Content-Type": "application/json" } },
      );
    }
  }

  // Reserve 1 credit BEFORE the (expensive) Gemini call so a user cannot get
  // free generations by dropping the connection or blocking a client-side
  // deduction. Refunded inside the stream if generation produces nothing.
  // A unique ledgerId makes the charge idempotent per request.
  const creditTxnId = crypto.randomUUID();
  let creditCharged = false;
  // Premium/Pro plans advertise unlimited Synthesis chat — honor that promise
  // server-side and skip the per-message charge for active paid subscribers
  // (within the standard grace window). The rate limits above still apply.
  let unmeteredChat = false;
  // "Pause memory" (users/{uid}.memoryPaused): no consciousness analysis,
  // Atman persistence, memory-ledger writes or chat summary for this turn.
  let memoryPaused = false;
  if (uid) {
    try {
      const userSnap = await db.collection("users").doc(uid).get();
      const userDoc = userSnap.data();
      unmeteredChat = isPaidSubscriptionActive(userDoc?.subscription);
      memoryPaused = userDoc?.memoryPaused === true;
    } catch (subError) {
      // Fall back to metered billing if the subscription lookup fails, and
      // fail closed on memory: if we can't confirm memory is on, don't write.
      console.error("[Synthesis] Subscription lookup failed:", subError);
      memoryPaused = true;
    }
  }
  if (uid && !unmeteredChat) {
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

  // Build context inside the refund path: a Firestore blip here would otherwise
  // throw a 500 AFTER the credit was reserved, leaving the user charged for
  // nothing.
  let userContext, kundaliSummary;
  try {
    ({ userContext, kundaliSummary } = await buildUserContext({
      uid,
      birthData,
      kundaliData,
      previousInteractionId,
      atmanData,
      recentSummaries: recentSummaries || undefined,
      yogaData,
      panchangData,
      localDate,
    }));
    const compatibilityContext = sanitizeCompatibilityContext(
      rawCompatibilityContext,
    );
    if (compatibilityContext && userContext) {
      userContext.compatibilityContext = compatibilityContext;
    }
  } catch (err) {
    await refundCredit();
    console.error("[Synthesis] Context build failed:", err);
    return new Response(
      JSON.stringify({ error: "Could not start synthesis. Please try again." }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const encoder = new TextEncoder();
  const isFirstMessage = !previousInteractionId;
  const lastUserMessage = messages[messages.length - 1].content;

  // Cancel the upstream Gemini stream if the client disconnects mid-response,
  // so we don't keep consuming a stream nobody is reading.
  const abortController = new AbortController();

  // Keepalive timer lives outside start() so cancel() can clear it.
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let streamClosed = false;

  const readable = new ReadableStream({
    async start(controller) {
      const enqueueRaw = (chunk: string) => {
        if (streamClosed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          streamClosed = true;
        }
      };
      const send = (data: any) => {
        enqueueRaw(`data: ${JSON.stringify(data)}\n\n`);
      };
      const close = () => {
        if (heartbeat) clearInterval(heartbeat);
        heartbeat = undefined;
        if (streamClosed) return;
        streamClosed = true;
        try {
          controller.close();
        } catch {
          // already closed/cancelled
        }
      };

      // Push bytes immediately and keep pushing SSE comments (ignored by the
      // client parser) so the CDN never sees an idle connection while the
      // model is thinking or post-processing runs — that idle gap produced a
      // 504 "Inactivity Timeout" page in production.
      enqueueRaw(SSE_OPEN_COMMENT);
      heartbeat = setInterval(
        () => enqueueRaw(SSE_KEEPALIVE_COMMENT),
        SYNTHESIS_KEEPALIVE_MS,
      );

      try {
        let fullContent = "";
        let interactionId = "";
        let suggestedRoutine: any = undefined;

        // Stream AI response. The persona is resolved from a server-side
        // registry by id — we never accept a raw persona prompt from the
        // client (that would let a caller inject system instructions /
        // jailbreak the guidance policy).
        const persona = personaId
          ? getConsultPersona(String(personaId))
          : undefined;
        const personaOverride = persona
          ? `\n\nPERSONA OVERRIDE:\nYour name is ${persona.name}. ${persona.promptModifier}`
          : undefined;

        const iterator = synthesizeStream(
          messages.map((m: any) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
          userContext,
          kundaliSummary,
          previousInteractionId,
          personaOverride,
          abortController.signal,
        );
        // Title runs CONCURRENTLY with the reply (from the user's message
        // alone) so it is normally ready by the time the stream ends instead
        // of adding a sequential model call before "done". Signed-in only —
        // guests have no chat doc to title.
        const titlePromise: Promise<string | null> | null =
          isFirstMessage && uid && typeof chatId === "string" && chatId
            ? generateChatTitle(lastUserMessage).catch(() => null)
            : null;
        const startedAt = Date.now();
        let gotFirstToken = false;

        while (true) {
          const deadline =
            startedAt +
            (gotFirstToken
              ? SYNTHESIS_TOTAL_TIMEOUT_MS
              : Math.min(
                  SYNTHESIS_FIRST_TOKEN_TIMEOUT_MS,
                  SYNTHESIS_TOTAL_TIMEOUT_MS,
                ));
          const next = await raceWithTimeout(
            iterator.next(),
            deadline - Date.now(),
          );
          if (next === TIMED_OUT) {
            abortController.abort();
            void iterator.return(undefined).catch(() => undefined);
            throw new SynthesisTimeoutError();
          }
          if (next.done) break;
          const event = next.value;
          if (event.type === "delta") {
            gotFirstToken = true;
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
          close();
          return;
        }

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

        // A title that is ready within a short grace window rides on "done";
        // a slower one is still persisted server-side after the response.
        let generatedTitle: string | null = null;
        if (titlePromise) {
          const raced = await raceWithTimeout(titlePromise, TITLE_GRACE_MS);
          generatedTitle = raced === TIMED_OUT ? null : raced;
        }

        // Memory post-processing (analysis, advice, Atman, summary) is only
        // for signed-in users who haven't paused memory. It runs OFF the
        // response path — never before "done".
        const validChatId =
          typeof chatId === "string" && chatId ? chatId : undefined;
        const priorTurns = (
          Array.isArray(chatMessages) ? chatMessages : messages.slice(0, -1)
        )
          .filter(
            (m: any) =>
              m &&
              (m.role === "user" || m.role === "assistant") &&
              typeof m.content === "string",
          )
          .map((m: any) => ({ role: m.role as string, content: m.content }));
        const postprocessJob: SynthesisPostprocessJob | null =
          uid && !memoryPaused
            ? {
                uid,
                chatId: validChatId,
                interactionId: interactionId || undefined,
                userMessage: lastUserMessage,
                assistantMessage: fullContent,
                // Last few prior turns + this exchange (the reply included —
                // follow-up requests only carry the latest user message).
                analysisMessages: boundSummaryWindow([
                  ...priorTurns.slice(-3),
                  { role: "user", content: lastUserMessage },
                  { role: "assistant", content: fullContent },
                ]),
                summaryMessages:
                  validChatId && shouldSummarizeTurn(messageCount)
                    ? boundSummaryWindow([
                        ...priorTurns,
                        { role: "user", content: lastUserMessage },
                        { role: "assistant", content: fullContent },
                      ])
                    : undefined,
                context: { name: userContext.name, atman: userContext.atman },
              }
            : null;

        const afterResponse = async () => {
          const finalTitle =
            generatedTitle ?? (titlePromise ? await titlePromise : null);
          await Promise.all([
            persistAssistantReply({
              uid,
              chatId,
              assistantMessageId,
              content: fullContent,
              interactionId,
              generatedTitle: finalTitle,
            }),
            uid && interactionId
              ? recordInteractionId(
                  {
                    db: db as unknown as RetentionDb,
                    arrayUnion: (...ids: string[]) =>
                      FieldValue.arrayUnion(...ids),
                    now: () => FieldValue.serverTimestamp(),
                  },
                  uid,
                  chatId,
                  interactionId,
                )
              : null,
          ]);
          if (!postprocessJob) return;
          const dispatched = await dispatchBackgroundJob(
            SYNTHESIS_POSTPROCESS_FUNCTION,
            postprocessJob,
            { requestUrl: req.url },
          );
          if (!dispatched) {
            // No background function reachable (e.g. secret unset) — run it
            // here, still after "done"; every side call has its own timeout.
            await runSynthesisPostprocess(
              postprocessJob,
              createSynthesisPostprocessDeps(),
            );
          }
        };

        await finishSynthesisTurn({
          sendDone: () =>
            send({
              type: "done",
              content: fullContent,
              interactionId,
              suggestAction: isRequestingChart ? "show_chart" : null,
              // Memory now updates asynchronously after the reply.
              brainUpdated: false,
              generatedTitle: generatedTitle || null,
              // Summaries are written server-side to the chat doc.
              conversationSummary: null,
              suggestedRoutine: suggestedRoutine || null,
            }),
          close,
          afterResponse,
          waitUntil:
            typeof (context as any)?.waitUntil === "function"
              ? (p) => (context as any).waitUntil(p)
              : undefined,
        });
      } catch (error: any) {
        const timedOut = error instanceof SynthesisTimeoutError;
        // Log the error type only — AI SDK messages can echo prompt or
        // response fragments containing the user's personal data.
        console.error(
          timedOut
            ? "[Synthesis] Generation timed out"
            : "[Synthesis] Streaming error:",
          error?.name || "error",
          error?.status ?? "",
        );
        // Generation failed — refund the reserved credit.
        await refundCredit();
        send({
          type: "error",
          error: timedOut
            ? SYNTHESIS_TIMEOUT_MESSAGE
            : "Synthesis failed. Your credit was not charged.",
        });
        close();
      }
    },
    cancel() {
      // Client disconnected — stop consuming the upstream Gemini stream.
      streamClosed = true;
      if (heartbeat) clearInterval(heartbeat);
      heartbeat = undefined;
      abortController.abort();
    },
  });

  return new Response(readable, {
    status: 200,
    headers: SSE_HEADERS,
  });
};

export const config: Config = {
  path: "/api/synthesis",
};
