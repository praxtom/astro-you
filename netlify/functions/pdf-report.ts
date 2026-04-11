import { Config, Context } from "@netlify/functions";
import { getNatalReportPDF, getDailyHoroscopePDF, getWeeklyHoroscopePDF } from "./shared/astro-api";

export default async (req: Request, _context: Context) => {
    if (req.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
    }

    try {
        const { birthData, reportType = 'natal', date } = await req.json();

        if (!birthData || !birthData.dob || !birthData.tob) {
            return new Response(
                JSON.stringify({ error: "Missing birth data" }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        console.log(`[PDF Report] Generating ${reportType} report...`);

        let pdfBuffer: ArrayBuffer | null = null;
        let filename = 'astroyou-report.pdf';

        switch (reportType) {
            case 'natal':
                pdfBuffer = await getNatalReportPDF(birthData);
                filename = `astroyou-natal-report-${new Date().toISOString().split('T')[0]}.pdf`;
                break;
            case 'daily':
                pdfBuffer = await getDailyHoroscopePDF(birthData, date);
                filename = `astroyou-daily-horoscope-${date || new Date().toISOString().split('T')[0]}.pdf`;
                break;
            case 'weekly':
                pdfBuffer = await getWeeklyHoroscopePDF(birthData, date);
                filename = `astroyou-weekly-horoscope-${date || new Date().toISOString().split('T')[0]}.pdf`;
                break;
            default:
                return new Response(
                    JSON.stringify({ error: `Unknown report type: ${reportType}` }),
                    { status: 400, headers: { "Content-Type": "application/json" } }
                );
        }

        if (!pdfBuffer) {
            return new Response(
                JSON.stringify({ error: "Failed to generate PDF" }),
                { status: 502, headers: { "Content-Type": "application/json" } }
            );
        }

        return new Response(pdfBuffer, {
            status: 200,
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="${filename}"`,
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
