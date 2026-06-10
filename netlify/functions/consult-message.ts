import { Config, Context } from "@netlify/functions";
import { auth, db, FieldValue } from "./shared/firebase-admin";
import {
  analyzeUserConsciousness,
  extractActionableAdvice,
  synthesizeStream,
  UserContext,
} from "./shared/gemini";
import { getConsultPersona } from "./shared/consult-session";
import { buildUserContext } from "./shared/user-context";
import { checkRateLimit } from "./shared/rate-limit";
import { persistAtmanInsights } from "./shared/atman-brain";

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

  try {
    const decoded = await auth.verifyIdToken(body.idToken);
    const uid = decoded.uid;
    const rateLimit = await checkRateLimit({
      scope: "ai_consult",
      key: uid,
      limit: 120,
      windowMs: 60 * 60 * 1000,
    });
    if (!rateLimit.allowed) {
      return json({
        error: "Too many consultation messages. Please try again later.",
        resetAt: rateLimit.resetAt.toISOString(),
      }, 429);
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
    const preferredLanguage =
      typeof session.preferredLanguage === "string"
        ? session.preferredLanguage.trim().slice(0, 40)
        : "";

    const { userContext, kundaliSummary } = await buildUserContext({
      uid,
      birthData: body.birthData,
      kundaliData: body.kundaliData,
      previousInteractionId: body.previousInteractionId,
      atmanData: body.atmanData,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        const send = (data: any) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        try {
          let fullContent = "";
          let interactionId = "";
          let suggestedRoutine: any = undefined;
          const languageInstruction = preferredLanguage
            ? `\nPreferred consultation language: ${preferredLanguage}. Respond primarily in this language, while keeping Sanskrit terms readable and explained simply.`
            : "";
          const personaOverride = `\n\nPERSONA OVERRIDE:\nYour name is ${persona.name}. ${persona.promptModifier}${languageInstruction}`;

          for await (const event of synthesizeStream(
            body.messages || [],
            userContext,
            kundaliSummary,
            body.previousInteractionId,
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

          await sessionRef.set(
            {
              messageCount: FieldValue.increment(1),
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true },
          );
          const lastUserMessage =
            [...(body.messages || [])].reverse().find((message) => message.role === "user")?.content || "";
          const safe = <T,>(promise: Promise<T>): Promise<T | null> => promise.catch((err) => {
            console.warn("[Consult Message] Brain task failed:", err?.message || err);
            return null;
          });
          const [analysisResult, extractedAdvice] = await Promise.all([
            safe(analyzeUserConsciousness((body.messages || []).slice(-5), userContext)),
            safe(extractActionableAdvice(fullContent, lastUserMessage)),
          ]);
          const brainResult = await safe(persistAtmanInsights(
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
            },
          ));

          send({
            type: "done",
            content: fullContent,
            interactionId,
            brainUpdated: Boolean(brainResult?.persisted),
            suggestedRoutine: suggestedRoutine || null,
          });
          controller.close();
        } catch (error: any) {
          console.error("[Consult Message] Streaming error:", error);
          send({ type: "error", error: error.message || "Consultation failed" });
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
  } catch (error: any) {
    console.error("[Consult Message] Error:", error);
    return json({ error: error.message || "Could not send consultation message" }, 500);
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
