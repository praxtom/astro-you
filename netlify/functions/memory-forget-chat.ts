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
  readChatInteractionIds,
  type RetentionDb,
} from "./shared/interaction-retention";
import { purgeInteractionsBestEffort } from "./shared/interaction-purge";

/** Client-supplied ids are a fallback for chats that predate the server log. */
const MAX_CLIENT_INTERACTION_IDS = 200;

/**
 * POST /api/memory/forget-chat
 * Body: { idToken: string, chatId: string, interactionIds?: string[] }
 * Removes every memory derived from that conversation (patterns, events,
 * advice, feelings, karmic threads, contradictions, ledger notes) and the
 * chat's stored summary. Works whether or not the chat doc still exists.
 * Also purges the chat's Gemini interactions (logged server-side under
 * users/{uid}/interactionLog/{chatId}, plus any optional client-supplied ids)
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
    const ids = normalizeInteractionIds([
      ...(await readChatInteractionIds(retentionDb, uid, chatId)),
      ...normalizeInteractionIds(clientIds, MAX_CLIENT_INTERACTION_IDS),
    ]);
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
