import type { Config } from "@netlify/functions";
import { db, FieldValue } from "./shared/firebase-admin";
import { writeAuditLog } from "./shared/audit-log";
import { recordJobRun } from "./shared/ops-alerts";
import { reapStuckReport, STUCK_REPORT_MS } from "./shared/report-access";

/**
 * Refunds and fails paid PDF reports stuck in "generating".
 *
 * /api/pdf-report charges before the slow generation step. If that function
 * is killed (platform timeout, crash) between the charge and its own refund /
 * completion write, the report would sit in "generating" with the credits
 * gone. This sweep finds reports older than STUCK_REPORT_MS (15 min — far
 * beyond any function's lifetime, so it never races a live request), refunds
 * the charge through the ledger (idempotent with pdf-report's own refund id)
 * and marks them failed.
 */

const BATCH_SIZE = Number(process.env.REPORT_REAPER_BATCH_SIZE || 100);
/** Netlify kills scheduled functions at 30s; leave headroom. */
const TIME_BUDGET_MS = 20_000;

function isMissingIndexError(err: unknown): boolean {
  const code = (err as { code?: unknown })?.code;
  return code === 9 || code === "failed-precondition";
}

async function loadStuckReports(cutoff: Date) {
  const base = db
    .collectionGroup("reports")
    .where("status", "==", "generating");
  try {
    // Served by the existing reports(status ASC, createdAt DESC) index.
    // Every processed doc leaves "generating", so the backlog drains.
    return (
      await base
        .where("createdAt", "<", cutoff)
        .orderBy("createdAt", "desc")
        .limit(BATCH_SIZE)
        .get()
    ).docs;
  } catch (err) {
    if (!isMissingIndexError(err)) throw err;
    console.warn(
      "[ReportReaper] Range query needs the reports(status, createdAt) index — falling back to an unordered scan",
    );
    return (await base.limit(BATCH_SIZE).get()).docs;
  }
}

export default async (_req: Request): Promise<Response> => {
  try {
    return await runReaper();
  } catch (err) {
    console.error("[ReportReaper] Run failed:", err);
    await recordJobRun("pdf-report-reaper", { ok: false, note: "run_threw" });
    return new Response(JSON.stringify({ error: "reaper_failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

async function runReaper(): Promise<Response> {
  const startedAt = Date.now();
  const cutoff = new Date(startedAt - STUCK_REPORT_MS);
  const docs = await loadStuckReports(cutoff);

  let refunded = 0;
  let failedWithoutCharge = 0;
  let skipped = 0;
  let errors = 0;
  let deferred = 0;

  for (const doc of docs) {
    if (Date.now() - startedAt > TIME_BUDGET_MS) {
      deferred++;
      continue;
    }
    const uid = doc.ref.parent.parent?.id;
    if (!uid) {
      skipped++;
      continue;
    }
    try {
      const outcome = await reapStuckReport({ db, FieldValue }, uid, doc.id);
      if (outcome === "skipped") {
        skipped++;
        continue;
      }
      if (outcome === "refunded") refunded++;
      else failedWithoutCharge++;
      await writeAuditLog({
        uid,
        action: "report_reaped",
        entityType: "report",
        entityId: doc.id,
        metadata: { outcome, reason: "timed_out" },
      }).catch((auditError) => {
        console.error("[ReportReaper] Audit log failed:", auditError);
      });
    } catch (err: any) {
      errors++;
      console.error(
        "[ReportReaper] Failed to reap",
        `${uid}/${doc.id}:`,
        err?.message || err,
      );
    }
  }

  const summary = {
    scanned: docs.length,
    refunded,
    failedWithoutCharge,
    skipped,
    errors,
    deferred,
  };
  console.log(`[ReportReaper] ${JSON.stringify(summary)}`);
  await recordJobRun("pdf-report-reaper", {
    ok: true,
    processed: refunded + failedWithoutCharge,
    failed: errors,
    skipped: skipped + deferred,
  });
  return new Response(JSON.stringify(summary), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

export const config: Config = { schedule: "*/15 * * * *" };
