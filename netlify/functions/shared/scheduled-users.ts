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
  const deadlineMs = options.deadlineMs ?? 60_000;
  const start = Date.now();

  const cursorRef = db.collection("scheduledCursors").doc(options.job);
  const cursorSnap = await cursorRef.get();
  let lastId: string | undefined = cursorSnap.data()?.lastId || undefined;

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
      break;
    }

    for (const doc of snap.docs) {
      await handle(doc);
      processed += 1;
      lastId = doc.id;
      if (Date.now() - start >= deadlineMs || processed >= maxUsers) break;
    }
  }

  await cursorRef.set(
    { lastId: lastId ?? null, updatedAt: new Date() },
    { merge: true },
  );

  return { processed, reachedEnd };
}
