import { schedule } from "@netlify/functions";
import { auth, db, FieldValue } from "./shared/firebase-admin";
import {
  ConsultSessionError,
  finalizeConsultSession,
} from "./shared/consult-session";
import { writeAuditLog } from "./shared/audit-log";

/**
 * Closes consultation sessions that were left "active" — e.g. the user closed
 * the tab without the client calling /api/consult/end. Without this, abandoned
 * sessions are never billed (the streaming endpoint deducts nothing per message;
 * billing only happens on finalize). Runs every 10 minutes.
 */

const STALE_MINUTES = Number(process.env.CONSULT_STALE_MINUTES || 15);
const BATCH_SIZE = Number(process.env.CONSULT_REAPER_BATCH_SIZE || 300);

/** Best-effort "last activity" timestamp (ms) for a consultation document. */
function lastActivityMs(data: Record<string, any>): number {
  const candidates = [data.updatedAt, data.startedAt, data.createdAt];
  for (const value of candidates) {
    if (value && typeof value.toMillis === "function") {
      return value.toMillis();
    }
  }
  if (typeof data.startedAtMs === "number") return data.startedAtMs;
  return 0;
}

export const handler = schedule("*/10 * * * *", async () => {
  const cutoff = Date.now() - STALE_MINUTES * 60_000;

  const snap = await db
    .collectionGroup("consultations")
    .where("status", "==", "active")
    .limit(BATCH_SIZE)
    .get();

  let billed = 0;
  let skippedFresh = 0;
  let failed = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    const activityMs = lastActivityMs(data);

    // Leave genuinely-live sessions alone; only reap idle ones.
    if (!activityMs || activityMs > cutoff) {
      skippedFresh++;
      continue;
    }

    const uid = doc.ref.parent.parent?.id;
    if (!uid) continue;

    try {
      // Bill up to the user's last activity, not "now" — they should not be
      // charged for the idle minutes between abandonment and this sweep.
      const result = await finalizeConsultSession(
        { auth, db, FieldValue, now: () => activityMs },
        { uid, sessionId: doc.id, reason: "auto_timeout" },
      );
      billed++;
      await writeAuditLog({
        uid,
        action: "consultation_auto_billed",
        entityType: "consultation",
        entityId: doc.id,
        metadata: {
          minutes: result.minutes,
          cost: result.cost,
          durationSeconds: result.durationSeconds,
          reason: "auto_timeout",
        },
      }).catch((auditError) => {
        console.error("[ConsultReaper] Audit log failed:", auditError);
      });
    } catch (err: any) {
      failed++;
      // 402 means the session was already marked "failed" (insufficient credits) —
      // expected, not an error worth alarming on.
      if (!(err instanceof ConsultSessionError && err.status === 402)) {
        console.error(
          "[ConsultReaper] Failed to finalize",
          `${uid}/${doc.id}:`,
          err?.message || err,
        );
      }
    }
  }

  console.log(
    `[ConsultReaper] scanned=${snap.size} billed=${billed} skippedFresh=${skippedFresh} failed=${failed}`,
  );

  return {
    statusCode: 200,
    body: JSON.stringify({ scanned: snap.size, billed, skippedFresh, failed }),
  };
});
