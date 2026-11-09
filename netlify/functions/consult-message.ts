import { Config, Context } from "@netlify/functions";
import { auth, db, FieldValue } from "./shared/firebase-admin";
import {
  analyzeUserConsciousness,
  buildPersonaOverride,
  extractActionableAdvice,
  synthesizeStream,
  UserContext,
} from "./shared/gemini";
import {
  computeBillableCapMinutes,
  getConsultPersona,
} from "./shared/consult-session";
import { buildUserContext } from "./shared/user-context";
import { checkRateLimit } from "./shared/rate-limit";
import {
  isAtmanMemoryPaused,
  persistAtmanInsights,
  type PersistAtmanInsightsResult,
} from "./shared/atman-brain";
import { isWithinSynthesisInputLimits } from "./shared/synthesis-limits";
import {
  readChatInteractionIds,
  recordInteractionId,
  type RetentionDb,
} from "./shared/interaction-retention";
import {
  consultInteractionLogId,
  resolvePreviousInteractionId,
} from "./shared/interaction-ownership";
import {
  ChatStreamTimeoutError,
  consumeChatStream,
  createChatSseStream,
  crisisSafetyResponse,
  isCrisisTurn,
  partialChatReply,
  SSE_HEADERS,
} from "./shared/chat-stream";
import { PARTIAL_REPLY_NOTE } from "./shared/synthesis-timeout";

type ConsultTurn = { role: "user" | "assistant"; content: string };

/** Keep only well-formed turns (string content, known role). */
function normalizeTurns(value: unknown[]): ConsultTurn[] {
  return value
    .filter(
      (m: any) =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string",
    )
    .map((m: any) => ({ role: m.role, content: m.content }));
}

interface ConsultMessagePayload {
  idToken?: string;
  sessionId?: string;
  messages?: Array<{ role: "user" | "assistant"; content: string }>;
  birthData?: any;
  kundaliData?: any;
  previousInteractionId?: string;
  atmanData?: UserContext["atman"];
}

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let body: ConsultMessagePayload;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }

  if (!body.idToken || !body.sessionId || !Array.isArray(body.messages)) {
    return json({ error: "Missing session data" }, 400);
  }
  const logId = consultInteractionLogId(body.sessionId);
  if (!logId) {
    return json({ error: "Invalid session" }, 400);
  }

  // Bound the prompt payload BEFORE any (paid) Gemini call — the same limits
  // the Synthesis chat applies. An unbounded transcript, or one huge message,
  // is otherwise a cheap way to run up our model bill inside a single
  // per-minute consultation, and can blow the model's context window.
  if (!isWithinSynthesisInputLimits(body.messages)) {
    return json({ error: "Message too long" }, 400);
  }

  const messages = normalizeTurns(body.messages);
  if (messages.length === 0) {
    return json({ error: "Missing session data" }, 400);
  }

  try {
    const decoded = await auth.verifyIdToken(body.idToken);
    const uid = decoded.uid;

    // Crisis safety screen — deterministic, BEFORE the rate limit, the
    // session/time-cap checks and any model call. A person in crisis must
    // never hit a paywall, and the model must never improvise around
    // self-harm. Fixed reply, no charge-relevant work, no memory writes.
    if (isCrisisTurn(messages)) {
      return crisisSafetyResponse({ brainUpdated: false });
    }

    const rateLimit = await checkRateLimit({
      scope: "ai_consult",
      key: uid,
      limit: 120,
      windowMs: 60 * 60 * 1000,
    });
    if (!rateLimit.allowed) {
      return json(
        {
          error: "Too many consultation messages. Please try again later.",
          resetAt: rateLimit.resetAt.toISOString(),
        },
        429,
      );
    }

    const sessionRef = db
      .collection("users")
      .doc(uid)
      .collection("consultations")
      .doc(body.sessionId);
    const sessionSnap = await sessionRef.get();
    const session = sessionSnap.data();

    if (!sessionSnap.exists || !session) {
      return json({ error: "Consultation session not found" }, 404);
    }

    if (session.status !== "active") {
      return json({ error: "Consultation session is not active" }, 409);
    }

    const persona = getConsultPersona(String(session.personaId || ""));
    if (!persona) {
      return json({ error: "Unknown persona" }, 400);
    }

    // Mid-session credit guard: once the user has used the minutes their balance
    // funded, stop serving (paid) AI responses. Without this a user could run a
    // session indefinitely and only be billed up to the cap on finalize, while
    // we keep paying for Gemini calls past their funded time.
    //
    // The cap is recomputed from the LIVE wallet balance rather than the value
    // frozen into the session at start, so topping up mid-session actually
    // extends the consultation instead of leaving the user locked out until
    // they end and restart.
    const startedAtMs =
      typeof session.startedAtMs === "number" ? session.startedAtMs : null;
    if (startedAtMs) {
      const userSnap = await db.collection("users").doc(uid).get();
      const credits = userSnap.data()?.credits ?? 0;
      const capMinutes = computeBillableCapMinutes(
        session,
        credits,
        persona.pricePerMin,
      );
      const elapsedMinutes = Math.floor((Date.now() - startedAtMs) / 60_000);
      if (capMinutes !== undefined && elapsedMinutes >= capMinutes) {
        return json(
          {
            error: "Your consultation time is up. Please top up to continue.",
            code: "time_exhausted",
          },
          402,
        );
      }
    }
    const preferredLanguage =
      typeof session.preferredLanguage === "string"
        ? session.preferredLanguage.trim().slice(0, 40)
        : "";

    // previousInteractionId is a bearer token for Gemini-side conversation
    // state: only chain onto an id this session logged server-side. Otherwise
    // start fresh — the client always sends the visible transcript, which
    // buildInteractionInput replays when there is no chain id.
    const retentionDb = db as unknown as RetentionDb;
    const previousInteractionId = body.previousInteractionId
      ? resolvePreviousInteractionId(
          body.previousInteractionId,
          await readChatInteractionIds(retentionDb, uid, logId),
        )
      : undefined;

    // The chart and diary always come from the server for a signed-in user;
    // client-sent kundaliData is never trusted (buildUserContext ignores it).
    const { userContext, kundaliSummary } = await buildUserContext({
      uid,
      birthData: body.birthData,
      previousInteractionId,
      atmanData: body.atmanData,
    });

    // Shared chat stream: open comment + keepalive, and an abort that stops
    // the upstream Gemini stream when the client disconnects.
    const readable = createChatSseStream(
      async ({ send, close, abortController }) => {
        // Text already streamed (for a timeout after the first token).
        let streamedText = "";
        try {
          const personaOverride = buildPersonaOverride(
            persona,
            preferredLanguage || undefined,
          );

          const turn = await consumeChatStream(
            synthesizeStream(
              messages,
              userContext,
              kundaliSummary,
              previousInteractionId,
              personaOverride,
              abortController.signal,
            ),
            {
              abortController,
              onDelta: (text) => {
                streamedText += text;
                send({ type: "delta", text });
              },
            },
          );
          // Client gone mid-reply: nobody is listening, and the client only
          // persists what it received — skip bookkeeping and brain work.
          if (turn.aborted) return;
          const fullContent = turn.content;
          const interactionId = turn.interactionId;
          const suggestedRoutine = turn.suggestedRoutine;
          if (!fullContent.trim()) {
            send({
              type: "error",
              error: "No response generated. Please try again.",
            });
            close();
            return;
          }

          await Promise.all([
            sessionRef.set(
              {
                messageCount: FieldValue.increment(1),
                updatedAt: FieldValue.serverTimestamp(),
              },
              { merge: true },
            ),
            // Server-only log: lets the next turn chain, and account deletion
            // purge this interaction. Never throws.
            recordInteractionId(
              {
                db: retentionDb,
                arrayUnion: (...ids: string[]) => FieldValue.arrayUnion(...ids),
                now: () => FieldValue.serverTimestamp(),
              },
              uid,
              logId,
              interactionId,
            ),
          ]);
          // Emit `done` as soon as the answer is on disk — the per-minute meter
          // is running, so the user must not be kept waiting on the (slow,
          // best-effort) brain tasks below. `brainUpdated` arrives afterwards
          // in its own `brain` event.
          if (turn.chips.length > 0) {
            send({ type: "chips", chips: turn.chips });
          }
          send({
            type: "done",
            content: fullContent,
            interactionId,
            suggestedRoutine: suggestedRoutine || null,
          });

          const lastUserMessage =
            [...messages].reverse().find((message) => message.role === "user")
              ?.content || "";
          const safe = <T>(promise: Promise<T>): Promise<T | null> =>
            promise.catch((err) => {
              // Log only the error name/type — AI SDK messages can echo prompt
              // or response fragments containing the user's chat content.
              console.warn(
                "[Consult Message] Brain task failed:",
                err?.name || "error",
              );
              return null;
            });
          // Memory paused: skip the memory model calls entirely so the
          // transcript is never sent for extraction (fail closed).
          const brainRequestedAt = Date.now();
          const memoryPaused = await isAtmanMemoryPaused({ db }, uid).catch(
            () => true,
          );
          const [analysisResult, extractedAdvice] = memoryPaused
            ? [null, null]
            : await Promise.all([
                safe(
                  analyzeUserConsciousness(messages.slice(-5), userContext),
                ),
                safe(extractActionableAdvice(fullContent, lastUserMessage)),
              ]);
          const brainResult: PersistAtmanInsightsResult | null = memoryPaused
            ? null
            : await safe(
                persistAtmanInsights(
                  { db },
                  {
                    uid,
                    analysisResult,
                    extractedAdvice,
                    source: {
                      surface: "consult",
                      sessionId: body.sessionId,
                      interactionId,
                      personaId: persona.id,
                      userMessage: lastUserMessage,
                      assistantMessage: fullContent,
                    },
                    requestedAt: brainRequestedAt,
                  },
                ),
              );

          send({
            type: "brain",
            brainUpdated: Boolean(brainResult?.persisted),
          });
          close();
        } catch (error: any) {
          const timedOut = error instanceof ChatStreamTimeoutError;
          const partialContent = timedOut
            ? partialChatReply(streamedText)
            : null;
          if (partialContent) {
            // Part of the reply already reached the user — finish calmly with
            // it rather than an error. (Consult billing is per minute; there
            // is no per-message charge to refund either way.)
            console.error(
              "[Consult Message] Generation timed out after first token",
            );
            send({ type: "delta", text: PARTIAL_REPLY_NOTE });
            send({
              type: "done",
              content: partialContent,
              interactionId: null,
              suggestedRoutine: null,
              partial: true,
            });
            close();
            return;
          }
          // Log the error type only — AI SDK messages can echo prompt or
          // response fragments containing the user's chat content.
          console.error(
            timedOut
              ? "[Consult Message] Generation timed out"
              : "[Consult Message] Streaming error:",
            error?.name || "error",
            error?.status ?? "",
          );
          send({
            type: "error",
            error: timedOut
              ? "Your guide is taking longer than usual — please ask again in a moment."
              : "Consultation failed",
          });
          close();
        }
      },
    );

    return new Response(readable, { status: 200, headers: SSE_HEADERS });
  } catch (error: any) {
    // Never echo an upstream/SDK message to the client: it can carry prompt
    // fragments, Firestore internals, or credential hints.
    console.error(
      "[Consult Message] Error:",
      error?.name || "error",
      error?.status ?? "",
    );
    return json({ error: "Could not send consultation message" }, 500);
  }
};

function json(payload: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const config: Config = {
  path: "/api/consult/message",
};
