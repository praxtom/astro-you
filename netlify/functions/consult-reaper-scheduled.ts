import type { Config } from "@netlify/functions";
import { auth, db, FieldValue } from "./shared/firebase-admin";
import {
  ConsultSessionError,
  finalizeConsultSession,
} from "./shared/consult-session";
import { writeAuditLog } from "./shared/audit-log";
import { recordJobRun } from "./shared/ops-alerts";

/**
 * Closes consultation sessions that were left "active" — e.g. the user closed
 * the tab without the client calling /api/consult/end. Without this, abandoned
 * sessions are never billed (the streaming endpoint deducts nothing per message;
 * billing only happens on finalize). Runs every 10 minutes.
 *
 * Oldest sessions go first and the run stops starting new work after a time
 * budget, so a backlog drains across runs instead of the same (newest) slice
 * being re-scanned while old sessions starve, and a slow run is never killed
 * mid-batch by the platform timeout.
 */

const STALE_MINUTES = Number(process.env.CONSULT_STALE_MINUTES || 15);
const BATCH_SIZE = Number(process.env.CONSULT_REAPER_BATCH_SIZE || 300);
/** Netlify kills scheduled functions at 30s; leave headroom. */
const TIME_BUDGET_MS = 20_000;

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

function isMissingIndexError(err: unknown): boolean {
  const code = (err as { code?: unknown })?.code;
  return code === 9 || code === "failed-precondition";
}

/**
 * Active sessions, oldest first. Needs the collection-group index
 * consultations(status ASC, createdAt ASC); until that index is deployed the
 * query fails with FAILED_PRECONDITION and we fall back to the unordered scan
 * rather than reaping nothing at all.
 */
async function loadActiveSessions() {
  const base = db
    .collectionGroup("consultations")
    .where("status", "==", "active");
  try {
    const ordered = await base
      .orderBy("createdAt", "asc")
      .limit(BATCH_SIZE)
      .get();
    if (ordered.size >= BATCH_SIZE) return ordered.docs;
    // orderBy drops documents without createdAt (legacy); pick those up too.
    const unordered = await base.limit(BATCH_SIZE).get();
    const seen = new Set(ordered.docs.map((d) => d.ref.path));
    return [
      ...ordered.docs,
      ...unordered.docs.filter((d) => !seen.has(d.ref.path)),
    ];
  } catch (err) {
    if (!isMissingIndexError(err)) throw err;
    console.warn(
      "[ConsultReaper] Ordered query needs the consultations(status, createdAt ASC) index — falling back to unordered",
    );
    return (await base.limit(BATCH_SIZE).get()).docs;
  }
}

export default async (_req: Request): Promise<Response> => {
  try {
    return await runReaper();
  } catch (err) {
    console.error("[ConsultReaper] Run failed:", err);
    await recordJobRun("consult-reaper", { ok: false, note: "run_threw" });
    return new Response(JSON.stringify({ error: "reaper_failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

async function runReaper(): Promise<Response> {
  const startedAt = Date.now();
  const cutoff = startedAt - STALE_MINUTES * 60_000;

  const docs = await loadActiveSessions();

  let billed = 0;
  let skippedFresh = 0;
  let failed = 0;
  // Failures other than the expected 402 (insufficient credits).
  let unexpectedFailed = 0;
  let deferred = 0;

  for (const doc of docs) {
    if (Date.now() - startedAt > TIME_BUDGET_MS) {
      deferred++;
      continue;
    }
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
        unexpectedFailed++;
        console.error(
          "[ConsultReaper] Failed to finalize",
          `${uid}/${doc.id}:`,
          err?.message || err,
        );
      }
    }
  }

  const summary = {
    scanned: docs.length,
    billed,
    skippedFresh,
    failed,
    deferred,
  };
  console.log(`[ConsultReaper] ${JSON.stringify(summary)}`);
  await recordJobRun("consult-reaper", {
    ok: true,
    processed: billed,
    failed: unexpectedFailed,
    skipped: skippedFresh + deferred,
  });
  return new Response(JSON.stringify(summary), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

export const config: Config = { schedule: "*/10 * * * *" };
