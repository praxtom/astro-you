import { db } from "./firebase-admin.js";

/**
 * Iterate users for a scheduled job with durable cursor pagination.
 *
 * Without this, `users.limit(200).get()` reprocesses the SAME first 200 users
 * every run and never serves the tail. We page with orderBy(__name__) +
 * startAfter(cursor), persist the cursor in `scheduledCursors/{job}`, and
 * advance it each run — wrapping back to the start when the end is reached.
 * A wall-clock deadline keeps a single invocation under the function timeout.
 */
export interface PagedUsersOptions {
  job: string;
  pageSize?: number;
  maxUsers?: number;
  deadlineMs?: number;
}

export async function processUsersPaged(
  options: PagedUsersOptions,
  handle: (userDoc: FirebaseFirestore.QueryDocumentSnapshot) => Promise<void>,
): Promise<{ processed: number; reachedEnd: boolean }> {
  const pageSize = options.pageSize ?? 100;
  const maxUsers = options.maxUsers ?? 1000;
  // Default well under the platform's scheduled-function timeout. A larger
  // window risks the platform killing the run before the cursor is persisted,
  // which would reprocess the same head users forever. Background functions
  // (15-min cap) can pass a larger override.
  const deadlineMs = options.deadlineMs ?? 8_000;
  const start = Date.now();

  const cursorRef = db.collection("scheduledCursors").doc(options.job);
  const cursorSnap = await cursorRef.get();
  let lastId: string | undefined = cursorSnap.data()?.lastId || undefined;

  const persistCursor = () =>
    cursorRef.set(
      { lastId: lastId ?? null, updatedAt: new Date() },
      { merge: true },
    );

  let processed = 0;
  let reachedEnd = false;

  while (processed < maxUsers && Date.now() - start < deadlineMs) {
    let q = db
      .collection("users")
      .orderBy("__name__")
      .limit(Math.min(pageSize, maxUsers - processed));
    if (lastId) q = q.startAfter(lastId);

    const snap = await q.get();
    if (snap.empty) {
      // Reached the end — wrap the cursor back to the start for next run.
      reachedEnd = true;
      lastId = undefined;
      await persistCursor();
      break;
    }

    for (const doc of snap.docs) {
      await handle(doc);
      processed += 1;
      lastId = doc.id;
      if (Date.now() - start >= deadlineMs || processed >= maxUsers) break;
    }

    // Persist progress after every page so a mid-run platform kill can't lose
    // it — otherwise the next run restarts from the last fully-completed run.
    await persistCursor();
  }

  return { processed, reachedEnd };
}
