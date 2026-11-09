import { Config, Context } from "@netlify/functions";
import {
  getDailyHoroscopePDF,
  getNatalReportPDF,
  getWeeklyHoroscopePDF,
  getYearlyHoroscope,
} from "./shared/astro-api";
import {
  auth,
  db,
  FieldValue,
  getStorageBucket,
} from "./shared/firebase-admin";
import { applyCreditChange, CreditError } from "./shared/credits";
import { enforceIpRateLimit, AuthError } from "./shared/require-auth";
import {
  createReportFilename,
  formatYearlyForecastSections,
  getReportProduct,
  isReportType,
  MIN_REPORT_PROSE_CHARS,
  type PaidReportType,
} from "./shared/reports";
import { createTextPdf } from "./shared/simple-pdf";
import { generateCompatibilityNarrative } from "./shared/gemini";
import { writeAuditLog } from "./shared/audit-log";
import {
  createReportStoragePath,
  downloadReportPdf,
  saveReportPdf,
} from "./shared/report-storage";
import { requestedDateKey } from "./shared/request-date.js";
import { isEmptyForecast } from "./shared/forecast-delivery.js";
import {
  decideReportIdRequest,
  decideReportRetry,
  REPORT_ID_PATTERN,
  type ReportIdDecision,
} from "./shared/report-access.js";
import { describeError } from "./shared/error-summary.js";
import { normalizeZodiacMode } from "../../src/lib/zodiac-mode.js";

function jsonResponse(
  payload: Record<string, unknown>,
  status: number,
  extraHeaders: Record<string, string> = {},
) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders },
  });
}

function isAlreadyExists(err: unknown): boolean {
  const code = (err as { code?: unknown })?.code;
  return code === 6 || code === "already-exists";
}

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const {
      idToken,
      birthData,
      reportType = "natal",
      reportId,
      requestId,
      date,
      compatibilityData,
      person1Name,
      person2Name,
      localDate,
    } = await req.json();

    if (!idToken) {
      return jsonResponse({ error: "Missing idToken" }, 401);
    }

    const decoded = await auth.verifyIdToken(idToken);
    const uid = decoded.uid;
    try {
      await enforceIpRateLimit(req, "pdf_report", 20, 60 * 60 * 1000);
    } catch (err) {
      const status = err instanceof AuthError ? err.status : 429;
      return jsonResponse(
        { error: "Too many report requests. Please slow down." },
        status,
      );
    }

    for (const [name, value] of [
      ["reportId", reportId],
      ["requestId", requestId],
    ] as const) {
      if (value !== undefined && value !== null) {
        if (typeof value !== "string" || !REPORT_ID_PATTERN.test(value)) {
          return jsonResponse({ error: `Invalid ${name}` }, 400);
        }
      }
    }
    // Reject an unknown type before anything is written or charged.
    if (!reportId && !isReportType(reportType)) {
      return jsonResponse({ error: "Unknown report type" }, 400);
    }

    const storageBucket = getStorageBucket();
    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();
    const userData = userSnap.data() || {};

    // `reportId` is ONLY a free re-download of a completed report the caller
    // owns. Failed / "generating" docs are rejected (never free, and never
    // re-charged under their old, possibly refunded, ledger id).
    //
    // `requestId` is the client-chosen id for a NEW report. Reusing it (a
    // network retry of the same click) is idempotent: the report is charged
    // at most once under ledger id `report_{requestId}`.
    const targetId: string | null = reportId || requestId || null;
    const reportRef = targetId
      ? userRef.collection("reports").doc(targetId)
      : userRef.collection("reports").doc();
    const existingReportSnap = targetId ? await reportRef.get() : null;
    const existingReport = existingReportSnap?.exists
      ? existingReportSnap.data()
      : undefined;

    let decision: ReportIdDecision | null = null;
    if (reportId) {
      decision = decideReportIdRequest(uid, existingReport);
    } else if (requestId && existingReport) {
      const retry = decideReportRetry(uid, existingReport);
      if (retry.kind === "in_progress") {
        return jsonResponse(
          {
            error:
              "This report is still being prepared. It will appear in your library shortly.",
            code: "report_in_progress",
            reportId: reportRef.id,
          },
          409,
        );
      }
      decision =
        retry.kind === "redownload" ? retry : { kind: "not_available" };
    }
    if (decision?.kind === "not_found") {
      return jsonResponse({ error: "Report not found" }, 404);
    }
    if (decision?.kind === "not_available") {
      return jsonResponse(
        {
          error:
            "This report isn't available to download. Please request a new report.",
          code: "report_not_available",
        },
        409,
      );
    }

    const effectiveReportType = (existingReport?.reportType ||
      reportType) as PaidReportType;
    const product = getReportProduct(effectiveReportType);
    const dateKey =
      existingReport?.dateKey || date || requestedDateKey(localDate);
    const filename =
      existingReport?.filename || createReportFilename(product.type, dateKey);
    const savedProfile = userData.profile || userData;
    const effectiveBirthData = withProfileSigns(
      birthData || toBirthData(savedProfile),
      savedProfile,
    );
    // Sign PDFs: sidereal Moon sign in Vedic mode, tropical in Western.
    const signOptions = {
      mode: normalizeZodiacMode(
        savedProfile?.zodiacMode ?? userData.zodiacMode,
      ),
    };

    if (decision?.kind === "redownload") {
      const storedPdf = await downloadReportPdf({
        bucket: storageBucket,
        path: decision.storagePath,
      });

      await reportRef.set(
        {
          lastDownloadedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

      await writeAuditLog({
        uid,
        action: "report_redownloaded",
        entityType: "report",
        entityId: reportRef.id,
        metadata: {
          reportType: product.type,
          chargedCredits: 0,
          filename,
          storagePath: decision.storagePath,
        },
      }).catch((auditError) => {
        console.error(
          "[PDF Report] Audit log failed:",
          describeError(auditError),
        );
      });

      const storedArrayBuffer = new ArrayBuffer(storedPdf.byteLength);
      new Uint8Array(storedArrayBuffer).set(storedPdf);

      return new Response(storedArrayBuffer, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "X-AstroYou-Report-Id": reportRef.id,
        },
      });
    }

    if (!effectiveBirthData?.dob || !effectiveBirthData?.tob) {
      return jsonResponse({ error: "Missing birth data" }, 400);
    }

    // Charge the credit BEFORE generating so a failure after delivery can't
    // give a free report. applyCreditChange is atomic and throws CreditError
    // (402) when the balance is insufficient. Refunded on any later failure;
    // if this function is killed before it can refund, the report reaper
    // (pdf-report-reaper-scheduled) refunds anything stuck in "generating".
    const newReportDoc = {
      reportType: product.type,
      title: product.title,
      status: "generating",
      creditCost: product.creditCost,
      dateKey,
      filename,
      ...(requestId ? { requestId } : {}),
      createdAt: FieldValue.serverTimestamp(),
    };
    if (requestId) {
      // create() fails if a concurrent retry claimed this id first, so two
      // in-flight copies of the same request can never both charge.
      try {
        await reportRef.create(newReportDoc);
      } catch (createErr) {
        if (isAlreadyExists(createErr)) {
          return jsonResponse(
            {
              error:
                "This report is still being prepared. It will appear in your library shortly.",
              code: "report_in_progress",
              reportId: reportRef.id,
            },
            409,
          );
        }
        throw createErr;
      }
    } else {
      await reportRef.set(newReportDoc);
    }

    let creditCharged = false;
    if (product.creditCost > 0) {
      try {
        await applyCreditChange(
          { db, FieldValue },
          {
            uid,
            amount: -product.creditCost,
            type: "report",
            source: "pdf_report",
            referenceId: reportRef.id,
            ledgerId: `report_${reportRef.id}`,
            metadata: { reportType: product.type, filename },
          },
        );
        creditCharged = true;
      } catch (err) {
        if (err instanceof CreditError) {
          await reportRef.set(
            { status: "failed", failureReason: "insufficient_credits" },
            { merge: true },
          );
          return jsonResponse(
            { error: "Insufficient credits for this report" },
            402,
          );
        }
        // Unknown whether the charge committed: leave the report
        // "generating" so the reaper refunds it iff the charge entry exists.
        throw err;
      }
    }

    /**
     * Refund (if charged) and mark the report failed. If the refund itself
     * fails, the report is left "generating" (with the reason) so the
     * scheduled reaper retries the refund instead of the credits being lost.
     */
    const refundAndFail = async (reason: string) => {
      let refunded = true;
      if (creditCharged) {
        await applyCreditChange(
          { db, FieldValue },
          {
            uid,
            amount: product.creditCost,
            type: "refund",
            source: "pdf_report_refund",
            referenceId: reportRef.id,
            ledgerId: `report_refund_${reportRef.id}`,
            metadata: { reportType: product.type, reason },
          },
        ).catch((e) => {
          refunded = false;
          console.error("[PDF Report] Refund failed:", describeError(e));
        });
      }
      await reportRef
        .set(
          refunded
            ? {
                status: "failed",
                failureReason: reason,
                updatedAt: FieldValue.serverTimestamp(),
              }
            : {
                failureReason: reason,
                refundPending: true,
                updatedAt: FieldValue.serverTimestamp(),
              },
          { merge: true },
        )
        .catch((e) =>
          console.error("[PDF Report] Status update failed:", describeError(e)),
        );
    };

    /** Refund, mark the report failed, and build the client error. */
    const failReport = async (
      reason: string,
      status: number,
      payload: Record<string, unknown>,
      extraHeaders: Record<string, string> = {},
    ) => {
      await refundAndFail(reason);
      return jsonResponse(payload, status, extraHeaders);
    };

    console.log(`[PDF Report] Generating ${product.type} report for ${uid}...`);

    let pdfBuffer: ArrayBuffer | null = null;

    try {
      switch (product.type) {
        case "natal":
          pdfBuffer = await getNatalReportPDF(effectiveBirthData);
          break;
        case "daily":
          pdfBuffer = await getDailyHoroscopePDF(
            effectiveBirthData,
            dateKey,
            signOptions,
          );
          break;
        case "weekly":
          pdfBuffer = await getWeeklyHoroscopePDF(
            effectiveBirthData,
            dateKey,
            signOptions,
          );
          break;
        case "yearly": {
          const yearly = await getYearlyHoroscope(effectiveBirthData, dateKey);
          // Readable sections only — never raw JSON. If the upstream payload
          // is empty or has no real prose, refund rather than sell a hollow PDF.
          const sections = isEmptyForecast(yearly)
            ? null
            : formatYearlyForecastSections(yearly);
          if (!sections || sections.proseChars < MIN_REPORT_PROSE_CHARS) {
            return await failReport(
              "forecast_unavailable",
              503,
              {
                error:
                  "Your yearly forecast couldn't be prepared right now. No credits were used — please try again in a little while.",
                code: "forecast_unavailable",
              },
              { "Retry-After": "300" },
            );
          }
          pdfBuffer = createTextPdf(product.title, [
            `Prepared for ${effectiveBirthData.name || "Seeker"}.`,
            ...sections.blocks,
          ]);
          break;
        }
        case "compatibility": {
          if (!compatibilityData) {
            return await failReport("missing_compatibility_data", 400, {
              error: "Missing compatibility data",
            });
          }
          const narrative = await generateCompatibilityNarrative(
            compatibilityData,
            person1Name || "Person 1",
            person2Name || "Person 2",
          );
          // No narrative means no report: refund instead of shipping JSON.
          if (typeof narrative !== "string" || narrative.trim().length < 80) {
            return await failReport("narrative_unavailable", 503, {
              error:
                "Your compatibility report couldn't be written right now. No credits were used — please try again in a little while.",
              code: "narrative_unavailable",
            });
          }
          pdfBuffer = createTextPdf(product.title, [
            `${person1Name || "Person 1"} and ${person2Name || "Person 2"}`,
            ...narrative
              .split(/\n{2,}/)
              .map((paragraph) => paragraph.trim())
              .filter(Boolean),
          ]);
          break;
        }
        default:
          return await failReport("unknown_report_type", 400, {
            error: "Unknown report type",
          });
      }
    } catch (genErr) {
      // Generation threw — refund and mark failed so the report isn't stuck.
      await refundAndFail("generation_error");
      throw genErr;
    }

    if (!pdfBuffer) {
      return await failReport("generation_failed", 502, {
        error: "Failed to generate PDF",
      });
    }

    const storagePath = createReportStoragePath({
      uid,
      reportId: reportRef.id,
      filename,
    });
    try {
      await saveReportPdf({
        bucket: storageBucket,
        path: storagePath,
        pdf: pdfBuffer,
        metadata: {
          uid,
          reportId: reportRef.id,
          reportType: product.type,
        },
      });
    } catch (storageErr) {
      await refundAndFail("storage_failed");
      throw storageErr;
    }

    // Credit was already charged before generation (above).
    await reportRef.set(
      {
        status: "completed",
        completedAt: FieldValue.serverTimestamp(),
        lastDownloadedAt: FieldValue.serverTimestamp(),
        chargedCredits: product.creditCost,
        storagePath,
      },
      { merge: true },
    );

    await writeAuditLog({
      uid,
      action: "report_generated",
      entityType: "report",
      entityId: reportRef.id,
      metadata: {
        reportType: product.type,
        chargedCredits: product.creditCost,
        filename,
        storagePath,
      },
    }).catch((auditError) => {
      console.error(
        "[PDF Report] Audit log failed:",
        describeError(auditError),
      );
    });

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-AstroYou-Report-Id": reportRef.id,
      },
    });
  } catch (error: any) {
    console.error("[PDF Report] Error:", describeError(error));
    return jsonResponse(
      { error: "Report generation failed. Please try again." },
      500,
    );
  }
};

export const config: Config = { path: "/api/pdf-report" };

function toBirthData(profile: any) {
  if (!profile?.dob || !profile?.tob) return null;
  return {
    name: profile.name,
    dob: profile.dob,
    tob: profile.tob,
    pob: profile.pob || "",
    lat: profile.lat ?? profile.coordinates?.lat,
    lng: profile.lng ?? profile.coordinates?.lng,
    coordinates: profile.coordinates,
  };
}

/**
 * Attach the profile's saved sidereal Moon/Sun signs — but only when the
 * report is for the profile's own birth moment (a client-sent chart for
 * someone else must not inherit the account holder's signs).
 */
function withProfileSigns(birth: any, profile: any) {
  if (!birth) return birth;
  const sameChart =
    profile?.dob === birth.dob &&
    String(profile?.tob ?? "").slice(0, 5) ===
      String(birth.tob ?? "").slice(0, 5);
  if (!sameChart) return birth;
  return {
    ...birth,
    ...(typeof profile.moonSign === "string"
      ? { moonSign: profile.moonSign }
      : {}),
    ...(typeof profile.sunSign === "string"
      ? { sunSign: profile.sunSign }
      : {}),
  };
}
