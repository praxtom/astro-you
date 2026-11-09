import type { Config } from "@netlify/functions";
import { db } from "./shared/firebase-admin";
import {
  DELETION_JOBS_COLLECTION,
  runDeletionJob,
} from "./shared/account-deletion";
import { recordJobRun } from "./shared/ops-alerts";

/**
 * Hourly retry for account deletions that didn't finish (function timeout,
 * a failed Firestore/Storage step). delete-account.ts writes
 * `deletionJobs/{uid}` before starting and marks it `done` at the end; any
 * job still `pending` is resumed here. Every step is idempotent.
 */

// Leave jobs alone while the original request may still be running.
const MIN_AGE_MS = 15 * 60 * 1000;
const BATCH_SIZE = 25;

function updatedAtMs(data: Record<string, any>): number {
  const value = data.updatedAt ?? data.createdAt;
  if (value && typeof value.toMillis === "function") return value.toMillis();
  return 0;
}

export default async () => {
  try {
    await runDeletionRetry();
  } catch (err) {
    console.error(
      "[DeletionRetry] Run failed:",
      err instanceof Error ? err.message : err,
    );
    await recordJobRun("account-deletion-retry", {
      ok: false,
      note: "run_threw",
    });
  }
};

async function runDeletionRetry(): Promise<void> {
  const cutoff = Date.now() - MIN_AGE_MS;
  // Single-field equality query: served by the automatic index.
  const snap = await db
    .collection(DELETION_JOBS_COLLECTION)
    .where("status", "==", "pending")
    .limit(BATCH_SIZE * 4)
    .get();

  let resumed = 0;
  let completed = 0;
  let failed = 0;
  for (const doc of snap.docs) {
    if (resumed >= BATCH_SIZE) break;
    if (updatedAtMs(doc.data()) > cutoff) continue;
    resumed++;
    try {
      const { failedSteps } = await runDeletionJob(doc.id);
      if (failedSteps.length === 0) completed++;
      else {
        failed++;
        console.warn(
          `[DeletionRetry] ${doc.id} still incomplete: ${failedSteps.join(", ")}`,
        );
      }
    } catch (err) {
      failed++;
      console.error(
        `[DeletionRetry] ${doc.id} failed:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  if (resumed > 0) console.warn(
    `[DeletionRetry] pending=${snap.size} resumed=${resumed} completed=${completed}`,
  );
  await recordJobRun("account-deletion-retry", {
    ok: true,
    processed: completed,
    failed,
  });
}

export const config: Config = { schedule: "@hourly" };
