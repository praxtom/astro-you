/**
 * Firebase-free decision for a pdf-report request that names a `reportId`.
 *
 * A re-download is free ONLY for a report the caller already paid for and
 * that finished: status "completed" with a stored PDF under the caller's own
 * storage prefix. A failed or still-"generating" doc (e.g. one created by a
 * 402 insufficient-credits attempt) is never a free re-download — treating it
 * as one handed out unlimited free PDFs. Such ids are rejected; the client
 * must make a fresh (charged) request instead.
 */
import { createReportStoragePath } from "./report-storage.js";
import { applyCreditChangeInTransaction } from "./credits.js";

export const REPORT_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export type ReportIdDecision =
  | { kind: "redownload"; storagePath: string }
  | { kind: "not_found" }
  | { kind: "not_available" };

export function decideReportIdRequest(
  uid: string,
  existingReport: Record<string, unknown> | null | undefined,
): ReportIdDecision {
  if (!existingReport) return { kind: "not_found" };
  const storagePath = existingReport.storagePath;
  // Same sanitisation as the path the PDF was saved under.
  const ownPrefix = createReportStoragePath({
    uid,
    reportId: "r",
    filename: "f",
  }).slice(0, -"r/f".length);
  if (
    existingReport.status === "completed" &&
    typeof storagePath === "string" &&
    storagePath.startsWith(ownPrefix) &&
    !storagePath.includes("..") &&
    (existingReport.uid === undefined || existingReport.uid === uid)
  ) {
    return { kind: "redownload", storagePath };
  }
  return { kind: "not_available" };
}

/**
 * A client-chosen `requestId` (the report id for a NEW report) that already
 * exists means this is a retry of the same purchase. Never charge it again:
 * a finished one is served free, one still generating is "in progress", and
 * a failed one (already refunded) needs a fresh request id.
 */
export type ReportRetryDecision =
  | { kind: "redownload"; storagePath: string }
  | { kind: "in_progress" }
  | { kind: "failed" };

export function decideReportRetry(
  uid: string,
  existingReport: Record<string, unknown>,
): ReportRetryDecision {
  const decision = decideReportIdRequest(uid, existingReport);
  if (decision.kind === "redownload") return decision;
  if (existingReport.status === "generating") return { kind: "in_progress" };
  return { kind: "failed" };
}

/** A report still "generating" after this long was killed mid-flight. */
export const STUCK_REPORT_MS = 15 * 60 * 1000;

interface ReapDocRef {
  collection(name: string): { doc(id?: string): ReapDocRef };
  id?: string;
  path?: string;
}

interface ReapTx {
  get(ref: ReapDocRef): Promise<{
    exists?: boolean;
    data(): Record<string, any> | undefined;
  }>;
  update(ref: ReapDocRef, data: Record<string, unknown>): void;
  set(
    ref: ReapDocRef,
    data: Record<string, unknown>,
    options?: Record<string, unknown>,
  ): void;
}

export interface ReapStuckReportDeps {
  db: {
    collection(name: string): { doc(id?: string): ReapDocRef };
    runTransaction<T>(callback: (tx: ReapTx) => Promise<T>): Promise<T>;
  };
  FieldValue: {
    increment(value: number): unknown;
    serverTimestamp(): unknown;
  };
  nowMs?: number;
}

function timeMs(value: unknown): number | null {
  if (value instanceof Date) return value.getTime();
  if (
    value &&
    typeof (value as { toMillis?: () => number }).toMillis === "function"
  ) {
    return (value as { toMillis: () => number }).toMillis();
  }
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
}

/**
 * Refund and fail one report stuck in "generating" (the function was killed
 * after charging). Re-checks everything inside the transaction; the refund
 * reuses pdf-report's own ledger id (`report_refund_{id}`), so it can never
 * double-refund, and nothing is refunded unless the charge entry exists.
 */
export async function reapStuckReport(
  deps: ReapStuckReportDeps,
  uid: string,
  reportId: string,
): Promise<"refunded" | "failed_without_charge" | "skipped"> {
  const nowMs = deps.nowMs ?? Date.now();
  const userRef = deps.db.collection("users").doc(uid);
  const reportRef = userRef.collection("reports").doc(reportId);
  const chargeRef = userRef
    .collection("creditLedger")
    .doc(`report_${reportId}`);

  return deps.db.runTransaction(async (tx) => {
    const reportSnap = await tx.get(reportRef);
    const report = reportSnap.data();
    if (reportSnap.exists === false || !report) return "skipped";
    if (report.status !== "generating") return "skipped";
    const createdMs = timeMs(report.createdAt);
    if (createdMs !== null && nowMs - createdMs < STUCK_REPORT_MS) {
      return "skipped";
    }
    const userSnap = await tx.get(userRef);
    const chargeSnap = await tx.get(chargeRef);
    const charge = chargeSnap.exists === false ? undefined : chargeSnap.data();
    const charged =
      charge && typeof charge.amount === "number" && charge.amount < 0
        ? -charge.amount
        : 0;

    if (charged > 0 && userSnap.exists !== false && userSnap.data()) {
      await applyCreditChangeInTransaction(
        tx,
        { FieldValue: deps.FieldValue },
        userRef,
        {
          uid,
          amount: charged,
          type: "refund",
          source: "pdf_report_refund",
          referenceId: reportId,
          ledgerId: `report_refund_${reportId}`,
          metadata: {
            reportType: report.reportType ?? null,
            reason: "timed_out",
          },
        },
        userSnap.data()?.credits ?? 0,
      );
    }
    tx.set(
      reportRef,
      {
        status: "failed",
        failureReason: "timed_out",
        refundedCredits: charged,
        updatedAt: deps.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    return charged > 0 ? "refunded" : "failed_without_charge";
  });
}
