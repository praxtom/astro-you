import { Config, Context } from "@netlify/functions";
import crypto from "crypto";
import {
  synthesizeStream,
  generateChatTitle,
  boundSummaryWindow,
} from "./shared/gemini";
import { auth, db, FieldValue } from "./shared/firebase-admin";
import { buildUserContext } from "./shared/user-context";
import { chartBirthData, getCachedNatalChart } from "./shared/astro-cached.js";
import { normalizePlatformLanguage } from "./shared/languages.js";
import { isUsableCachedKundali, parseChartReadingBirthData } from "../../src/lib/profile-readiness.js";
import { checkRateLimit, getRequestIdentifier } from "./shared/rate-limit";
import { dispatchBackgroundJob } from "./shared/internal-dispatch";
import {
  readChatInteractionIds,
  recordInteractionId,
  type RetentionDb,
} from "./shared/interaction-retention";
import {
  messagesWithoutChain,
  resolvePreviousInteractionId,
} from "./shared/interaction-ownership";
import { PARTIAL_REPLY_NOTE } from "./shared/synthesis-timeout";
import {
  finishSynthesisTurn,
  runSynthesisPostprocess,
  shouldSummarizeTurn,
  SYNTHESIS_POSTPROCESS_FUNCTION,
  type SynthesisPostprocessJob,
} from "./shared/synthesis-postprocess";
import { createSynthesisPostprocessDeps } from "./shared/synthesis-postprocess-deps";
import {
  isWithinSynthesisInputLimits,
  resolveSubscriberDailyCap,
  subscriberFairUseMessage,
} from "./shared/synthesis-limits";
import { applyCreditChange, CreditError } from "./shared/credits";
import { isPaidSubscriptionActive } from "./shared/subscription-plans";
import { CRISIS_SAFETY_REPLY } from "./shared/safety";
import {
  raceWithTimeout,
  sanitizeCompatibilityContext,
  SYNTHESIS_TIMEOUT_MESSAGE,
  TIMED_OUT,
} from "./shared/synthesis-stream";
import {
  ChatStreamTimeoutError,
  consumeChatStream,
  createChatSseStream,
  crisisSafetyResponse,
  isCrisisTurn,
  partialChatReply,
  SSE_HEADERS,
} from "./shared/chat-stream";

/** How long "done" may wait for the (concurrently started) chat title. */
const TITLE_GRACE_MS = 1_500;

/** Same shape as atman-brain's isValidChatId — also used for message ids. */
const CLIENT_DOC_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

/**
 * Persist the assistant reply server-side so a user who closes the tab before
 * the client's own write still keeps the answer. The doc id is the
 * client-supplied assistantMessageId, so this is idempotent with the client's
 * setDoc — no duplicate message. Never throws.
 *
 * Runs in a transaction that first checks the chat still exists: if the user
 * deleted it while the reply was streaming, nothing is written (a merge-set
 * would otherwise recreate an invisible "ghost" chat with no lastUpdatedAt).
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
    const messageRef = chatRef.collection("messages").doc(assistantMessageId);
    await db.runTransaction(async (tx) => {
      const chatSnap = await tx.get(chatRef);
      if (!chatSnap.exists) return;
      tx.set(
        messageRef,
        {
          role: "assistant",
          content,
          clientId: assistantMessageId,
          interactionId: interactionId || null,
          timestamp: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      tx.set(
        chatRef,
        {
          ...(interactionId ? { lastInteractionId: interactionId } : {}),
          lastInteractionAt: FieldValue.serverTimestamp(),
          ...(input.generatedTitle ? { title: input.generatedTitle } : {}),
        },
        { merge: true },
      );
    });
  } catch (persistErr: any) {
    // Never fail the response over persistence — the client also writes.
    console.error(
      "[Synthesis] Server-side reply persist failed:",
      persistErr?.name || "error",
    );
  }
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
    messages: rawMessages,
    birthData,
    kundaliData,
    previousInteractionId: clientPreviousInteractionId,
    atmanData,
    recentSummaries,
    chatMessages,
    messageCount,
    yogaData,
    panchangData,
    // personaId is deliberately NOT read: named personas are paid
    // consultations (/api/consult/message), never available at chat price.
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
  let messages: any[] = rawMessages;
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

  // chatId / assistantMessageId become Firestore doc ids server-side: reject
  // anything that isn't a plain id (no path separators, bounded length).
  if (
    (chatId !== undefined && chatId !== null &&
      (typeof chatId !== "string" || !CLIENT_DOC_ID_PATTERN.test(chatId))) ||
    (assistantMessageId !== undefined && assistantMessageId !== null &&
      (typeof assistantMessageId !== "string" ||
        !CLIENT_DOC_ID_PATTERN.test(assistantMessageId)))
  ) {
    return new Response(JSON.stringify({ error: "Invalid chat id" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Crisis safety screen — deterministic, BEFORE rate limits, credit
  // reservation or any model call, for guests and signed-in users alike. A
  // person in crisis must never hit a paywall or a trial cap, and the model
  // must never improvise around self-harm.
  if (isCrisisTurn(messages)) {
    if (uid) {
      await persistAssistantReply({
        uid,
        chatId,
        assistantMessageId,
        content: CRISIS_SAFETY_REPLY,
      });
    }
    return crisisSafetyResponse({
      suggestAction: null,
      brainUpdated: false,
      generatedTitle: null,
      conversationSummary: null,
    });
  }

  const readingBirthData = parseChartReadingBirthData(body.chartReadingBirthData);
  if (body.chartReadingBirthData != null && !readingBirthData) {
    return new Response(
      JSON.stringify({ error: "Open your Kundali again to start this conversation." }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
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
        // Site-wide ceiling on free guest generations. Per-IP limits alone do
        // not bound total spend when requests come from many addresses.
        // Checked last so a request refused per-IP does not use it up.
        {
          scope: "synthesis_guest_global_day",
          key: "all",
          limit: guestGlobalDailyCap(),
          windowMs: 24 * 60 * 60 * 1000,
        },
      ];
  // Guests get a short trial, so they never need a long transcript.
  if (
    !uid &&
    Array.isArray(messages) &&
    (messages.length > GUEST_MAX_MESSAGES ||
      messages.some(
        (m: any) =>
          typeof m?.content === "string" &&
          m.content.length > GUEST_MAX_MESSAGE_CHARS,
      ))
  ) {
    return new Response(
      JSON.stringify({
        error: "That message is too long for a guest chat. Sign in to continue.",
        code: "auth_required",
      }),
      { status: 413, headers: { "Content-Type": "application/json" } },
    );
  }
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
  let accountLanguage = normalizePlatformLanguage(undefined);
  if (uid) {
    try {
      const userSnap = await db.collection("users").doc(uid).get();
      const userDoc = userSnap.data();
      unmeteredChat = isPaidSubscriptionActive(userDoc?.subscription);
      memoryPaused = userDoc?.memoryPaused === true;
      accountLanguage = normalizePlatformLanguage(userDoc?.profile?.language || userDoc?.language);
    } catch (subError) {
      // Fall back to metered billing if the subscription lookup fails, and
      // fail closed on memory: if we can't confirm memory is on, don't write.
      console.error("[Synthesis] Subscription lookup failed:", subError);
      memoryPaused = true;
    }
  }
  // Unmetered is not unlimited: a daily fair-use ceiling on top of the hourly
  // cap keeps one subscription from running an unbounded model bill.
  if (uid && unmeteredChat) {
    const dailyCap = resolveSubscriberDailyCap();
    const fairUse = await checkRateLimit({
      scope: "synthesis_subscriber_day",
      key: uid,
      limit: dailyCap,
      windowMs: 24 * 60 * 60 * 1000,
    });
    if (!fairUse.allowed) {
      return new Response(
        JSON.stringify({
          error: subscriberFairUseMessage(dailyCap),
          code: "fair_use_daily",
          resetAt: fairUse.resetAt.toISOString(),
        }),
        { status: 429, headers: { "Content-Type": "application/json" } },
      );
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

  // A client-supplied previousInteractionId is a bearer token for Gemini-side
  // conversation state: only chain onto ids in the caller's own server-only
  // interaction log. Otherwise start fresh (full context is rebuilt every
  // turn) and replay the visible transcript the client sent instead.
  let previousInteractionId: string | undefined;
  if (uid && clientPreviousInteractionId) {
    const logged = await readChatInteractionIds(
      db as unknown as RetentionDb,
      uid,
      typeof chatId === "string" ? chatId : "",
    );
    previousInteractionId = resolvePreviousInteractionId(
      clientPreviousInteractionId,
      logged,
    );
  }
  if (!previousInteractionId) {
    messages = messagesWithoutChain(messages, chatMessages);
  }

  // Build context inside the refund path: a Firestore blip here would otherwise
  // throw a 500 AFTER the credit was reserved, leaving the user charged for
  // nothing.
  let userContext, kundaliSummary;
  try {
    const selectedChart = readingBirthData && uid
      ? await getCachedNatalChart(chartBirthData(readingBirthData))
      : kundaliData;
    if (readingBirthData && !isUsableCachedKundali(selectedChart, "D1", "vedic")) {
      throw new Error("The selected Kundali is unavailable");
    }
    // A chart opened from Free Kundali has its own subject. Keep the account
    // for billing and chat storage, and use only the selected chart for guidance.
    ({ userContext, kundaliSummary } = await buildUserContext({
      uid: readingBirthData ? undefined : uid,
      birthData: readingBirthData ?? birthData,
      kundaliData: selectedChart,
      previousInteractionId,
      atmanData: readingBirthData ? undefined : atmanData,
      recentSummaries: readingBirthData ? undefined : recentSummaries || undefined,
      yogaData: readingBirthData ? undefined : yogaData,
      panchangData: readingBirthData ? undefined : panchangData,
      localDate,
    }));
    if (readingBirthData && uid) userContext.language = accountLanguage;
    const compatibilityContext = sanitizeCompatibilityContext(
      rawCompatibilityContext,
    );
    if (!readingBirthData && compatibilityContext && userContext) {
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

  // Title only the opening turn of a chat (by what the client claimed — a
  // refused chain id still means this is a follow-up, not a new chat).
  const isFirstMessage = !clientPreviousInteractionId;
  const lastUserMessage = messages[messages.length - 1].content;
  const waitUntil =
    typeof (context as any)?.waitUntil === "function"
      ? (p: Promise<unknown>) => (context as any).waitUntil(p)
      : undefined;

  // The shared chat stream pushes bytes immediately and keeps pushing SSE
  // comments (ignored by the client parser) so the CDN never sees an idle
  // connection — that idle gap produced a 504 "Inactivity Timeout" page in
  // production — and aborts the upstream Gemini stream if the client
  // disconnects mid-response.
  const readable = createChatSseStream(
    async ({ send, close, abortController }) => {
      // Text already streamed to the client (for a timeout after first token).
      let streamedText = "";
      // When this turn was requested; memory writes from its post-processing
      // are dropped if the user cleared memory after this point.
      const startedAt = Date.now();

      try {
        // Always the default Jyotish guide (no persona override).
        const iterator = synthesizeStream(
          messages.map((m: any) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
          userContext,
          kundaliSummary,
          previousInteractionId,
          undefined,
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
        // First-token / total deadlines; aborts the upstream on timeout.
        const turn = await consumeChatStream(iterator, {
          abortController,
          onDelta: (text) => {
            streamedText += text;
            send({ type: "delta", text });
          },
        });
        const fullContent = turn.content;
        const interactionId = turn.interactionId;
        const suggestedRoutine = turn.suggestedRoutine;

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
          uid && !memoryPaused && !readingBirthData
            ? {
                uid,
                requestedAt: startedAt,
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

        // 1-2 tappable follow-ups, as their own event just before "done".
        if (turn.chips.length > 0) {
          send({ type: "chips", chips: turn.chips });
        }

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
          waitUntil,
        });
      } catch (error: any) {
        const timedOut = error instanceof ChatStreamTimeoutError;
        // Hidden-tag fragments are stripped from the partial text too.
        const partialContent = timedOut ? partialChatReply(streamedText) : null;
        if (partialContent) {
          // The user already received (part of) a reply: keep the charge and
          // finish calmly with what streamed, rather than refunding content
          // that was delivered.
          console.error("[Synthesis] Generation timed out after first token");
          const content = partialContent;
          send({ type: "delta", text: PARTIAL_REPLY_NOTE });
          send({
            type: "done",
            content,
            interactionId: null,
            suggestAction: null,
            brainUpdated: false,
            generatedTitle: null,
            conversationSummary: null,
            suggestedRoutine: null,
            partial: true,
          });
          // Keep the function alive for the write: after close() an
          // un-awaited promise may be frozen with the instance.
          const persisted = persistAssistantReply({
            uid,
            chatId,
            assistantMessageId,
            content,
          });
          if (waitUntil) waitUntil(persisted);
          else await persisted;
          close();
          return;
        }
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
  );

  return new Response(readable, {
    status: 200,
    headers: SSE_HEADERS,
  });
};

const GUEST_MAX_MESSAGES = 24;
const GUEST_MAX_MESSAGE_CHARS = 2000;
/** Env GUEST_CHAT_DAILY_CAP; default 1,500 free guest replies a day site-wide. */
function guestGlobalDailyCap(): number {
  const parsed = Number(process.env.GUEST_CHAT_DAILY_CAP);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1500;
}

export const config: Config = {
  path: "/api/synthesis",
};
