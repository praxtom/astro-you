import { Config, Context } from "@netlify/functions";
import { db, FieldValue } from "./shared/firebase-admin";
import {
  AuthError,
  enforceRateLimit,
  jsonResponse,
  requireAuthBody,
} from "./shared/require-auth";
import { forgetChat, isValidChatId } from "./shared/atman-brain";
import {
  deleteChatInteractionLog,
  normalizeInteractionIds,
  readAllInteractionIds,
  readChatInteractionIds,
  type RetentionDb,
} from "./shared/interaction-retention";
import { ownedInteractionIds } from "./shared/interaction-ownership";
import { purgeInteractionsBestEffort } from "./shared/interaction-purge";

/**
 * Client-supplied ids are optional extras, honoured only when they appear in
 * the caller's server-only interaction log (any chat) — an interaction id is
 * a bearer token, so an arbitrary id must never be purged on request.
 */
const MAX_CLIENT_INTERACTION_IDS = 200;

/**
 * POST /api/memory/forget-chat
 * Body: { idToken: string, chatId: string, interactionIds?: string[] }
 * Removes every memory derived from that conversation (patterns, events,
 * advice, feelings, karmic threads, contradictions, ledger notes) and the
 * chat's stored summary. Works whether or not the chat doc still exists.
 * Also purges the chat's Gemini interactions (logged server-side under
 * users/{uid}/interactionLog/{chatId}, plus optional client-supplied ids that
 * are also in the caller's log)
 * — best-effort, never failing the request.
 */
export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method Not Allowed" }, 405);
  }

  let body: { idToken?: unknown; chatId?: unknown; interactionIds?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  try {
    const decoded = await requireAuthBody(body);
    if (!isValidChatId(body.chatId)) {
      return jsonResponse({ error: "Invalid chatId" }, 400);
    }
    await enforceRateLimit({
      scope: "memory_forget_chat",
      key: decoded.uid,
      limit: 60,
      windowMs: 60 * 60 * 1000,
    });

    const result = await forgetChat(
      { db, deleteField: () => FieldValue.delete() },
      decoded.uid,
      body.chatId,
    );
    const interactions = await purgeChatInteractions(
      decoded.uid,
      body.chatId,
      body.interactionIds,
      req.url,
    );
    return jsonResponse({ ok: true, ...result, interactionsQueued: interactions });
  } catch (err) {
    if (err instanceof AuthError) {
      return jsonResponse({ error: err.message }, err.status);
    }
    console.error(
      "[MemoryForgetChat] Failed:",
      err instanceof Error ? err.name : "error",
    );
    return jsonResponse({ error: "Could not forget this conversation" }, 500);
  }
};

async function purgeChatInteractions(
  uid: string,
  chatId: string,
  clientIds: unknown,
  requestUrl: string,
): Promise<number> {
  try {
    const retentionDb = db as unknown as RetentionDb;
    const chatIds = await readChatInteractionIds(retentionDb, uid, chatId);
    const clientCandidates = normalizeInteractionIds(
      clientIds,
      MAX_CLIENT_INTERACTION_IDS,
    );
    const extra =
      clientCandidates.length > 0
        ? ownedInteractionIds(
            clientCandidates,
            await readAllInteractionIds(retentionDb, uid),
          )
        : [];
    const ids = normalizeInteractionIds([...chatIds, ...extra]);
    const { queued } = await purgeInteractionsBestEffort(ids, { requestUrl });
    await deleteChatInteractionLog(retentionDb, uid, chatId);
    return queued;
  } catch (err) {
    console.warn(
      "[MemoryForgetChat] Interaction purge failed:",
      err instanceof Error ? err.name : "error",
    );
    return 0;
  }
}

export const config: Config = { path: "/api/memory/forget-chat" };
