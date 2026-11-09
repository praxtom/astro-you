/**
 * Account deletion pipeline, shared by the user-facing endpoint
 * (delete-account.ts) and the hourly retry (account-deletion-retry-scheduled.ts).
 *
 * Every run is tracked in `deletionJobs/{uid}` (server-only; default-deny in
 * firestore.rules). The job is written BEFORE any destructive step and marked
 * `done` only after every cleanup step succeeded, so a timeout or a failed
 * step leaves a `pending` job the scheduler retries. Every step is idempotent.
 */
import Razorpay from "razorpay";
import { auth, db, FieldValue, getStorageBucket } from "./firebase-admin.js";
import { writeAuditLog } from "./audit-log.js";
import { reportOpsEvent } from "./ops-alerts.js";
import {
  normalizeInteractionIds,
  readAllInteractionIds,
  type RetentionDb,
} from "./interaction-retention.js";
import { purgeInteractionsBestEffort } from "./interaction-purge.js";

export const DELETION_JOBS_COLLECTION = "deletionJobs";
/** Give up (and flag for manual follow-up) after this many attempts. */
export const MAX_DELETION_ATTEMPTS = 10;
/** Finished jobs are kept briefly as a receipt, then TTL-deleted. */
const DONE_JOB_TTL_MS = 30 * 24 * 60 * 60 * 1000;

// Statuses that Razorpay can no longer bill — everything else (active,
// pending, halted, paused, cancelling, ...) must be cancelled at Razorpay
// BEFORE we destroy the account, or the subscriber keeps getting auto-charged
// with no remaining mapping back to a user.
const NON_BILLABLE_STATUSES = new Set(["cancelled", "completed", "expired"]);

export type SubscriptionCancellation = "none" | "cancelled" | "cancel_failed";

export interface DeletionJob {
  uid: string;
  email?: string;
  status: "pending" | "done" | "failed";
  attempts?: number;
  subscriptionCancellation?: SubscriptionCancellation;
  interactionIds?: string[];
  failedSteps?: string[];
}

/** Create (or re-open) the job record before anything destructive happens. */
export async function openDeletionJob(uid: string, email: string) {
  await db
    .collection(DELETION_JOBS_COLLECTION)
    .doc(uid)
    .set(
      {
        uid,
        email: email || null,
        status: "pending",
        attempts: FieldValue.increment(0),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
}

/**
 * Run (or resume) a deletion. Returns the subscription outcome and the list
 * of cleanup steps that failed (empty = fully deleted, job marked done).
 */
export async function runDeletionJob(
  uid: string,
  options: { requestUrl?: string } = {},
): Promise<{
  subscriptionCancellation: SubscriptionCancellation;
  failedSteps: string[];
}> {
  const jobRef = db.collection(DELETION_JOBS_COLLECTION).doc(uid);
  const jobSnap = await jobRef.get();
  const job = (jobSnap.data() || {}) as Partial<DeletionJob>;
  await jobRef.set(
    {
      attempts: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  const userRef = db.collection("users").doc(uid);
  const userSnap = await userRef.get();
  const userData = userSnap.data() || {};
  // Only the verified email captured when the job was opened; never fall back
  // to profile fields (see delete-account.ts).
  const email =
    typeof job.email === "string" ? job.email.toLowerCase().trim() : "";

  // 1. Stop billing FIRST (once). The user doc holds the subscription mapping.
  let subscriptionCancellation = job.subscriptionCancellation;
  if (!subscriptionCancellation) {
    subscriptionCancellation = userSnap.exists
      ? await cancelActiveSubscription(uid, userData.subscription)
      : "none";
    await jobRef.set({ subscriptionCancellation }, { merge: true });
  }

  // 2. Interaction ids live under the user subtree — capture them before it
  //    is deleted, and persist them on the job so a retry can still purge.
  let interactionIds = Array.isArray(job.interactionIds)
    ? normalizeInteractionIds(job.interactionIds)
    : null;
  if (!interactionIds) {
    interactionIds = userSnap.exists ? await collectInteractionIds(uid) : [];
    await jobRef.set({ interactionIds }, { merge: true });
  }

  const failedSteps: string[] = [];
  const step = async (name: string, fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch (err) {
      failedSteps.push(name);
      console.error(
        `[AccountDeletion] ${name} failed:`,
        err instanceof Error ? err.message : err,
      );
      // Never throws; the hourly retry job resumes the step.
      await reportOpsEvent(
        "account_cleanup_failed",
        { uid, step: name },
        { severity: "warning", dedupeKey: `${uid}_${name}` },
      );
    }
  };

  // 3. Revoke access: delete the Auth user (already gone on a retry is fine).
  await step("auth_user", async () => {
    try {
      await auth.deleteUser(uid);
    } catch (err: any) {
      if (err?.code !== "auth/user-not-found") throw err;
    }
  });

  // 4. The user's own subtree.
  await step("user_tree", () => db.recursiveDelete(userRef));

  // 5. Records about this user that live OUTSIDE their subtree.
  await step("referrals", () =>
    deleteQuery(db.collectionGroup("referrals").where("refereeUid", "==", uid)),
  );
  // Public copies of approved consultation reviews
  // (astrologers/{personaId}/reviews/*, written by admin-trust-moderation).
  await step("published_reviews", () =>
    deleteQuery(db.collectionGroup("reviews").where("uid", "==", uid)),
  );
  for (const coll of [
    "analyticsEvents",
    "trustModerationQueue",
    "supportTickets",
    "remedyRequests",
    "predictionFeedbackAggregateQueue",
    "weeklyAstrologyContext",
  ]) {
    await step(coll, () =>
      deleteQuery(db.collection(coll).where("uid", "==", uid)),
    );
  }
  if (email) {
    // expertApplications is written by an anonymous endpoint and only carries
    // the applicant's email; the OTP login doc is keyed by email.
    await step("expertApplications", () =>
      deleteQuery(
        db.collection("expertApplications").where("email", "==", email),
      ),
    );
    await step("otps", () => db.collection("otps").doc(email).delete());
  }
  await step("storage", () =>
    getStorageBucket().deleteFiles({
      prefix: `users/${safeSegment(uid)}/`,
      force: true,
    }),
  );

  // 6. Gemini-side conversation copies — best-effort, never throws.
  const interactionPurge = await purgeInteractionsBestEffort(interactionIds, {
    requestUrl: options.requestUrl,
  }).catch(() => ({ queued: 0, mode: "none" as const }));

  if (failedSteps.length === 0) {
    await jobRef.set(
      {
        status: "done",
        failedSteps: [],
        completedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        expiresAt: new Date(Date.now() + DONE_JOB_TTL_MS),
        // Drop personal data / bearer tokens from the receipt.
        email: FieldValue.delete(),
        interactionIds: FieldValue.delete(),
      },
      { merge: true },
    );
    await writeAuditLog({
      uid,
      action: "account_deleted",
      entityType: "user",
      entityId: uid,
      metadata: {
        subscriptionCancellation,
        interactionsPurgeQueued: interactionPurge.queued,
      },
    }).catch((e) => console.error("[AccountDeletion] Audit log failed:", e));
  } else {
    const attempts = (job.attempts ?? 0) + 1;
    const gaveUp = attempts >= MAX_DELETION_ATTEMPTS;
    await jobRef.set(
      {
        status: gaveUp ? "failed" : "pending",
        failedSteps,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    if (gaveUp) {
      // Retries exhausted: personal data may remain. Needs a human.
      await reportOpsEvent(
        "account_cleanup_failed",
        { uid, step: failedSteps.join(","), attempts, final: true },
        { severity: "critical", dedupeKey: `${uid}_final` },
      );
    }
  }

  return { subscriptionCancellation, failedSteps };
}

const DELETE_PAGE_SIZE = 300;

/** Delete every doc a query matches, in pages. */
async function deleteQuery(query: FirebaseFirestore.Query) {
  for (;;) {
    const snap = await query.limit(DELETE_PAGE_SIZE).get();
    if (snap.empty) return;
    const batch = db.batch();
    for (const doc of snap.docs) batch.delete(doc.ref);
    await batch.commit();
    if (snap.size < DELETE_PAGE_SIZE) return;
  }
}

/**
 * Interaction ids from the server-side log only. Chat docs' lastInteractionId
 * is client-writable, so it is never purged on its own (an interaction id is
 * a bearer token — a planted id would delete someone else's interaction).
 * Never throws.
 */
async function collectInteractionIds(uid: string): Promise<string[]> {
  try {
    const logged = await readAllInteractionIds(
      db as unknown as RetentionDb,
      uid,
    );
    return normalizeInteractionIds(logged);
  } catch (err) {
    console.error(
      "[AccountDeletion] Interaction id collection failed:",
      err instanceof Error ? err.name : "error",
    );
    return [];
  }
}

async function cancelActiveSubscription(
  uid: string,
  subscription: Record<string, any> | undefined,
): Promise<SubscriptionCancellation> {
  const subscriptionId =
    subscription?.razorpaySubscriptionId || subscription?.razorpaySubId;
  const status = String(subscription?.status || "");
  if (!subscriptionId || NON_BILLABLE_STATUSES.has(status)) {
    return "none";
  }

  try {
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID || "",
      key_secret: process.env.RAZORPAY_KEY_SECRET || "",
    });
    // false = cancel immediately, not at cycle end — the account is going away.
    await razorpay.subscriptions.cancel(subscriptionId, false);
    await writeAuditLog({
      uid,
      action: "account_delete_subscription_cancelled",
      entityType: "subscription",
      entityId: subscriptionId,
      metadata: { previousStatus: status },
    }).catch((auditError) => {
      console.error("[AccountDeletion] Audit log failed:", auditError);
    });
    return "cancelled";
  } catch (cancelError: any) {
    // Razorpay treats cancelling an already-cancelled/completed subscription
    // as an error — that still means billing has stopped, so proceed.
    const description = String(
      cancelError?.error?.description || cancelError?.message || cancelError,
    );
    console.error(
      `[AccountDeletion] Razorpay cancellation failed for ${subscriptionId}:`,
      description,
    );
    // Record the subscription id so support can cancel it manually — the user
    // doc that held the mapping is about to be deleted.
    await writeAuditLog({
      uid,
      action: "account_delete_subscription_cancel_failed",
      entityType: "subscription",
      entityId: subscriptionId,
      metadata: { previousStatus: status, error: description.slice(0, 500) },
    }).catch((auditError) => {
      console.error("[AccountDeletion] Audit log failed:", auditError);
    });
    return "cancel_failed";
  }
}

function safeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 160);
}
