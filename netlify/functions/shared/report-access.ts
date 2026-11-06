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
  const ownPrefix = createReportStoragePath({ uid, reportId: "r", filename: "f" })
    .slice(0, -"r/f".length);
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
