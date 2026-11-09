import { db } from "./firebase-admin.js";

/**
 * Iterate users for a scheduled job with durable cursor pagination.
 *
 * Without this, `users.limit(200).get()` reprocesses the SAME first 200 users
 * every run and never serves the tail. We page with orderBy(__name__) +
 * startAfter(cursor), persist the cursor in `scheduledCursors/{job}`, and
 * advance it each run — wrapping back to the start when the end is reached.
 * A wall-clock deadline keeps a single invocation under the function timeout.
 *
 * `runKey` (optional) scopes the cursor to one logical run, e.g. a calendar
 * day: a stored cursor from a different run key is ignored (start from the
 * top), and once the end is reached for a run key, later calls with the same
 * key return immediately with `alreadyCompleted`. Background jobs that chain
 * several invocations use this to cover every user exactly once per day.
 */
export interface PagedUsersOptions {
  job: string;
  pageSize?: number;
  maxUsers?: number;
  deadlineMs?: number;
  runKey?: string;
  /** Users handled in parallel within a page (default 1 = sequential). */
  concurrency?: number;
}

export interface PagedUsersResult {
  processed: number;
  reachedEnd: boolean;
  alreadyCompleted?: boolean;
}

export async function processUsersPaged(
  options: PagedUsersOptions,
  handle: (userDoc: FirebaseFirestore.QueryDocumentSnapshot) => Promise<void>,
): Promise<PagedUsersResult> {
  const pageSize = options.pageSize ?? 100;
  const maxUsers = options.maxUsers ?? 1000;
  const concurrency = Math.max(1, Math.min(options.concurrency ?? 1, 16));
  // Default well under the platform's scheduled-function timeout. A larger
  // window risks the platform killing the run before the cursor is persisted,
  // which would reprocess the same head users forever. Background functions
  // (15-min cap) can pass a larger override.
  const deadlineMs = options.deadlineMs ?? 8_000;
  const start = Date.now();

  const cursorRef = db.collection("scheduledCursors").doc(options.job);
  const cursorSnap = await cursorRef.get();
  const cursorData = cursorSnap.data() || {};
  if (options.runKey && cursorData.completedRunKey === options.runKey) {
    return { processed: 0, reachedEnd: true, alreadyCompleted: true };
  }
  let lastId: string | undefined =
    options.runKey && cursorData.runKey !== options.runKey
      ? undefined
      : cursorData.lastId || undefined;

  const persistCursor = (extra: Record<string, unknown> = {}) =>
    cursorRef.set(
      {
        lastId: lastId ?? null,
        updatedAt: new Date(),
        ...(options.runKey ? { runKey: options.runKey } : {}),
        ...extra,
      },
      { merge: true },
    );

  let processed = 0;
  let reachedEnd = false;
  const hasBudget = () =>
    Date.now() - start < deadlineMs && processed < maxUsers;

  while (hasBudget()) {
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
      await persistCursor(
        options.runKey ? { completedRunKey: options.runKey } : {},
      );
      break;
    }

    const docs = snap.docs;
    for (let i = 0; i < docs.length; i += concurrency) {
      const chunk = docs.slice(i, i + concurrency);
      await Promise.all(chunk.map((doc) => handle(doc)));
      processed += chunk.length;
      lastId = chunk[chunk.length - 1].id;
      if (!hasBudget()) break;
    }

    // Persist progress after every page so a mid-run platform kill can't lose
    // it — otherwise the next run restarts from the last fully-completed run.
    await persistCursor();
  }

  return { processed, reachedEnd };
}

/**
 * Best-effort exclusive lease for a long-running job (e.g. a background
 * function that may be double-dispatched). Returns a release function, or
 * null when another holder's lease is still live.
 */
export async function acquireJobLease(
  job: string,
  holder: string,
  ttlMs: number,
): Promise<(() => Promise<void>) | null> {
  const ref = db.collection("jobLeases").doc(job);
  const acquired = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data() || {};
    const until =
      data.leaseUntil && typeof data.leaseUntil.toDate === "function"
        ? data.leaseUntil.toDate().getTime()
        : 0;
    if (data.holder && data.holder !== holder && until > Date.now()) {
      return false;
    }
    tx.set(ref, {
      holder,
      leaseUntil: new Date(Date.now() + ttlMs),
      updatedAt: new Date(),
    });
    return true;
  });
  if (!acquired) return null;
  return async () => {
    await db
      .runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (snap.data()?.holder === holder) {
          tx.set(ref, {
            holder: null,
            leaseUntil: new Date(0),
            updatedAt: new Date(),
          });
        }
      })
      .catch(() => undefined);
  };
}
