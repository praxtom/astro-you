import {
  INTERACTION_LOG_COLLECTION,
  MAX_PURGE_IDS,
  normalizeInteractionIds,
  type RetentionDb,
} from "./interaction-retention.js";

export interface ForgetAllInteractionsDeps {
  db: RetentionDb;
  /** Hands ids to the Gemini interaction purge (shared/interaction-purge). */
  purge: (ids: string[]) => Promise<{ queued: number }>;
}

export interface ForgetAllInteractionsResult {
  logs: number;
  interactionsQueued: number;
}

/**
 * "Forget everything": purge every stored Gemini interaction logged for the
 * user (users/{uid}/interactionLog/*, across all chats) and clear the log.
 *
 * Ids are purged in chunks of MAX_PURGE_IDS. A log doc is deleted only after
 * its ids were handed to the purge, so a failure leaves the rest of the log in
 * place for a retry. Throws when the log cannot be read, so the caller can
 * tell the user the purge did not happen.
 */
export async function forgetAllInteractions(
  deps: ForgetAllInteractionsDeps,
  uid: string,
): Promise<ForgetAllInteractionsResult> {
  const logRef = deps.db
    .collection("users")
    .doc(uid)
    .collection(INTERACTION_LOG_COLLECTION);
  const snap = await logRef.get();

  let interactionsQueued = 0;
  let pending: string[] = [];
  let pendingDocs: string[] = [];

  const flush = async () => {
    const ids = normalizeInteractionIds(pending);
    if (ids.length) interactionsQueued += (await deps.purge(ids)).queued;
    await Promise.all(
      pendingDocs.map((id) =>
        logRef
          .doc(id)
          .delete()
          .catch(() => undefined),
      ),
    );
    pending = [];
    pendingDocs = [];
  };

  for (const doc of snap.docs) {
    const ids = normalizeInteractionIds(doc.data()?.ids, MAX_PURGE_IDS);
    if (pending.length + ids.length > MAX_PURGE_IDS) await flush();
    pending.push(...ids);
    pendingDocs.push(doc.id);
  }
  await flush();

  return { logs: snap.docs.length, interactionsQueued };
}
