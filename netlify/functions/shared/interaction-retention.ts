/**
 * Gemini Interactions retention.
 *
 * Every synthesis turn creates an interaction that Google stores by default
 * (store=true, ~55 days) so the next turn can chain via
 * previous_interaction_id. Deleting a chat or an account must delete those
 * too. We log each turn's interaction id server-side under
 * users/{uid}/interactionLog/{chatId} — the chat doc itself is already gone
 * by the time /api/memory/forget-chat runs — and purge from that log.
 *
 * Purging is best-effort: logged, never blocking the user's deletion.
 */

export const INTERACTION_LOG_COLLECTION = "interactionLog";
/** Log doc for turns that had no chatId (still purged on account deletion). */
export const UNASSIGNED_LOG_ID = "_unassigned";
/** Hard cap on ids handled in one purge request. */
export const MAX_PURGE_IDS = 2000;

const INTERACTION_ID_PATTERN = /^[A-Za-z0-9_.:-]{1,200}$/;

export function isValidInteractionId(value: unknown): value is string {
  return typeof value === "string" && INTERACTION_ID_PATTERN.test(value);
}

/** Dedupe + validate + cap an untrusted list of interaction ids. */
export function normalizeInteractionIds(
  values: unknown,
  max = MAX_PURGE_IDS,
): string[] {
  if (!Array.isArray(values)) return [];
  const out = new Set<string>();
  for (const value of values) {
    if (out.size >= max) break;
    if (isValidInteractionId(value)) out.add(value);
  }
  return [...out];
}

export function interactionLogDocId(chatId: unknown): string {
  return typeof chatId === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(chatId)
    ? chatId
    : UNASSIGNED_LOG_ID;
}

// Minimal structural Firestore surface, so tests can pass a fake.
interface LogDocSnapshot {
  exists: boolean;
  data(): Record<string, any> | undefined;
}
interface LogDocRef {
  get(): Promise<LogDocSnapshot>;
  set(
    data: Record<string, unknown>,
    options?: { merge?: boolean },
  ): Promise<unknown>;
  delete(): Promise<unknown>;
}
interface LogCollectionRef {
  doc(id: string): LogDocRef;
  get(): Promise<{ docs: Array<{ id: string; data(): Record<string, any> }> }>;
}
export interface RetentionDb {
  collection(name: string): {
    doc(id: string): { collection(name: string): LogCollectionRef };
  };
}

function logCollection(db: RetentionDb, uid: string): LogCollectionRef {
  return db.collection("users").doc(uid).collection(INTERACTION_LOG_COLLECTION);
}

/** Append one turn's interaction id to the chat's log. Never throws. */
export async function recordInteractionId(
  deps: {
    db: RetentionDb;
    arrayUnion: (...ids: string[]) => unknown;
    now?: () => unknown;
  },
  uid: string,
  chatId: unknown,
  interactionId: unknown,
): Promise<void> {
  if (!uid || !isValidInteractionId(interactionId)) return;
  try {
    await logCollection(deps.db, uid)
      .doc(interactionLogDocId(chatId))
      .set(
        {
          ids: deps.arrayUnion(interactionId),
          updatedAt: deps.now ? deps.now() : new Date(),
        },
        { merge: true },
      );
  } catch (err) {
    console.warn(
      "[InteractionRetention] Could not log interaction id:",
      err instanceof Error ? err.name : "error",
    );
  }
}

/** Ids logged for one chat (empty on any failure). */
export async function readChatInteractionIds(
  db: RetentionDb,
  uid: string,
  chatId: string,
): Promise<string[]> {
  try {
    const snap = await logCollection(db, uid)
      .doc(interactionLogDocId(chatId))
      .get();
    return snap.exists ? normalizeInteractionIds(snap.data()?.ids) : [];
  } catch (err) {
    console.warn(
      "[InteractionRetention] Could not read interaction log:",
      err instanceof Error ? err.name : "error",
    );
    return [];
  }
}

/** Every id logged for the user, across all chats (empty on failure). */
export async function readAllInteractionIds(
  db: RetentionDb,
  uid: string,
): Promise<string[]> {
  try {
    const snap = await logCollection(db, uid).get();
    return normalizeInteractionIds(
      snap.docs.flatMap((d) => d.data()?.ids || []),
    );
  } catch (err) {
    console.warn(
      "[InteractionRetention] Could not read interaction logs:",
      err instanceof Error ? err.name : "error",
    );
    return [];
  }
}

export async function deleteChatInteractionLog(
  db: RetentionDb,
  uid: string,
  chatId: string,
): Promise<void> {
  await logCollection(db, uid)
    .doc(interactionLogDocId(chatId))
    .delete()
    .catch(() => undefined);
}

export interface DeleteInteractionsResult {
  deleted: number;
  failed: number;
  skipped: number;
}

/**
 * Delete interactions on Google's side with bounded concurrency and an overall
 * time budget. A 404 (already expired/deleted) counts as deleted. Never throws.
 */
export async function deleteInteractions(
  ids: string[],
  deleteOne: (id: string) => Promise<unknown>,
  options: { concurrency?: number; budgetMs?: number; now?: () => number } = {},
): Promise<DeleteInteractionsResult> {
  const queue = normalizeInteractionIds(ids);
  const concurrency = Math.max(1, options.concurrency ?? 6);
  const now = options.now ?? Date.now;
  const deadline = now() + (options.budgetMs ?? 60_000);
  const result: DeleteInteractionsResult = {
    deleted: 0,
    failed: 0,
    skipped: 0,
  };
  let cursor = 0;

  const worker = async () => {
    while (cursor < queue.length) {
      if (now() > deadline) {
        result.skipped += queue.length - cursor;
        cursor = queue.length;
        return;
      }
      const id = queue[cursor++];
      try {
        await deleteOne(id);
        result.deleted += 1;
      } catch (err: any) {
        const status = err?.status ?? err?.code;
        if (status === 404 || status === "NOT_FOUND") {
          result.deleted += 1;
        } else {
          result.failed += 1;
        }
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, queue.length) }, worker),
  );
  if (result.failed || result.skipped) {
    console.warn(
      `[InteractionRetention] Purge incomplete: deleted=${result.deleted} failed=${result.failed} skipped=${result.skipped}`,
    );
  }
  return result;
}
