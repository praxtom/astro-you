import { Config, Context } from "@netlify/functions";
import {
    getDailyHoroscopePDF,
    getNatalReportPDF,
    getWeeklyHoroscopePDF,
    getYearlyHoroscope,
} from "./shared/astro-api";
import { auth, db, FieldValue, getStorageBucket } from "./shared/firebase-admin";
import { applyCreditChange } from "./shared/credits";
import {
    createReportFilename,
    getReportProduct,
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

export default async (req: Request, _context: Context) => {
    if (req.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
    }

    try {
        const {
            idToken,
            birthData,
            reportType = 'natal',
            reportId,
            date,
            compatibilityData,
            person1Name,
            person2Name,
        } = await req.json();

        if (!idToken) {
            return new Response(
                JSON.stringify({ error: "Missing idToken" }),
                { status: 401, headers: { "Content-Type": "application/json" } }
            );
        }

        const decoded = await auth.verifyIdToken(idToken);
        const uid = decoded.uid;
        const storageBucket = getStorageBucket();
        const userRef = db.collection("users").doc(uid);
        const userSnap = await userRef.get();
        const userData = userSnap.data() || {};

        const reportRef = reportId
            ? userRef.collection("reports").doc(reportId)
            : userRef.collection("reports").doc();
        const existingReportSnap = reportId ? await reportRef.get() : null;
        const existingReport = existingReportSnap?.data();
        if (reportId && !existingReport) {
            return new Response(
                JSON.stringify({ error: "Report not found" }),
                { status: 404, headers: { "Content-Type": "application/json" } }
            );
        }

        const effectiveReportType = (existingReport?.reportType || reportType) as PaidReportType;
        const product = getReportProduct(effectiveReportType);
        const dateKey = existingReport?.dateKey || date || new Date().toISOString().split('T')[0];
        const filename = existingReport?.filename || createReportFilename(product.type, dateKey);
        const isRedownload = Boolean(existingReport);
        const effectiveBirthData = birthData || toBirthData(userData.profile || userData);

        if (isRedownload && existingReport?.storagePath) {
            const storedPdf = await downloadReportPdf({
                bucket: storageBucket,
                path: existingReport.storagePath,
            });

            await reportRef.set({
                lastDownloadedAt: FieldValue.serverTimestamp(),
            }, { merge: true });

            await writeAuditLog({
                uid,
                action: "report_redownloaded",
                entityType: "report",
                entityId: reportRef.id,
                metadata: {
                    reportType: product.type,
                    chargedCredits: 0,
                    filename,
                    storagePath: existingReport.storagePath,
                },
            }).catch((auditError) => {
                console.error("[PDF Report] Audit log failed:", auditError);
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
            return new Response(
                JSON.stringify({ error: "Missing birth data" }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        if (!isRedownload && (userData.credits ?? 0) < product.creditCost) {
            return new Response(
                JSON.stringify({ error: "Insufficient credits for this report" }),
                { status: 402, headers: { "Content-Type": "application/json" } }
            );
        }

        if (!isRedownload) {
            await reportRef.set({
                reportType: product.type,
                title: product.title,
                status: "generating",
                creditCost: product.creditCost,
                dateKey,
                filename,
                createdAt: FieldValue.serverTimestamp(),
            });
        }

        console.log(`[PDF Report] Generating ${product.type} report for ${uid}...`);

        let pdfBuffer: ArrayBuffer | null = null;

        switch (product.type) {
            case 'natal':
                pdfBuffer = await getNatalReportPDF(effectiveBirthData);
                break;
            case 'daily':
                pdfBuffer = await getDailyHoroscopePDF(effectiveBirthData, dateKey);
                break;
            case 'weekly':
                pdfBuffer = await getWeeklyHoroscopePDF(effectiveBirthData, dateKey);
                break;
            case 'yearly': {
                const yearly = await getYearlyHoroscope(effectiveBirthData, dateKey);
                pdfBuffer = createTextPdf(product.title, [
                    `Prepared for ${effectiveBirthData.name || "Seeker"}.`,
                    stringifyReportData(yearly || "Yearly forecast data was unavailable."),
                ]);
                break;
            }
            case 'compatibility': {
                if (!compatibilityData) {
                    return new Response(
                        JSON.stringify({ error: "Missing compatibility data" }),
                        { status: 400, headers: { "Content-Type": "application/json" } }
                    );
                }
                const narrative = await generateCompatibilityNarrative(
                    compatibilityData,
                    person1Name || "Person 1",
                    person2Name || "Person 2",
                );
                pdfBuffer = createTextPdf(product.title, [
                    `${person1Name || "Person 1"} and ${person2Name || "Person 2"}`,
                    narrative || stringifyReportData(compatibilityData),
                ]);
                break;
            }
            default:
                return new Response(
                    JSON.stringify({ error: `Unknown report type: ${product.type}` }),
                    { status: 400, headers: { "Content-Type": "application/json" } }
                );
        }

        if (!pdfBuffer) {
            await reportRef.set({
                status: "failed",
                failureReason: "generation_failed",
                updatedAt: FieldValue.serverTimestamp(),
            }, { merge: true });
            return new Response(
                JSON.stringify({ error: "Failed to generate PDF" }),
                { status: 502, headers: { "Content-Type": "application/json" } }
            );
        }

        const storagePath = createReportStoragePath({
            uid,
            reportId: reportRef.id,
            filename,
        });
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

        if (!isRedownload && product.creditCost > 0) {
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
        }

        await reportRef.set({
            status: "completed",
            completedAt: FieldValue.serverTimestamp(),
            lastDownloadedAt: FieldValue.serverTimestamp(),
            chargedCredits: isRedownload ? 0 : product.creditCost,
            storagePath,
        }, { merge: true });

        await writeAuditLog({
            uid,
            action: isRedownload ? "report_redownloaded" : "report_generated",
            entityType: "report",
            entityId: reportRef.id,
            metadata: {
                reportType: product.type,
                chargedCredits: isRedownload ? 0 : product.creditCost,
                filename,
                storagePath,
            },
        }).catch((auditError) => {
            console.error("[PDF Report] Audit log failed:", auditError);
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
        console.error("[PDF Report] Error:", error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { "Content-Type": "application/json" } }
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

function stringifyReportData(data: any): string {
    if (typeof data === "string") return data;
    if (!data) return "";
    return JSON.stringify(data, null, 2).slice(0, 3500);
}
