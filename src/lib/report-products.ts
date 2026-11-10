import type { LucideIcon } from "lucide-react";
import { CalendarDays, FileText, Heart, Sparkles, Sun } from "lucide-react";
import { REPORT_PRICING, type ReportType } from "./report-pricing";

export type ClientReportType = ReportType;

export interface ClientReportProduct {
  type: ClientReportType;
  title: string;
  description: string;
  creditCost: number;
  cta: string;
  icon: LucideIcon;
  requiresCompatibilityFlow?: boolean;
}

export const REPORT_PRODUCTS: ClientReportProduct[] = [
  {
    type: "natal",
    title: REPORT_PRICING.natal.title,
    description: "A PDF reading of your birth chart. Note: this report uses Western astrology, so your signs in it may be one sign off from your Vedic chart here.",
    creditCost: REPORT_PRICING.natal.creditCost,
    cta: "Generate PDF",
    icon: FileText,
  },
  {
    type: "daily",
    title: REPORT_PRICING.daily.title,
    description: "A compact PDF for today's guidance and timing.",
    creditCost: REPORT_PRICING.daily.creditCost,
    cta: "Generate Today",
    icon: Sun,
  },
  {
    type: "weekly",
    title: "Weekly Forecast PDF",
    description: "A week-ahead report for planning decisions and routines.",
    creditCost: REPORT_PRICING.weekly.creditCost,
    cta: "Generate Week",
    icon: CalendarDays,
  },
  {
    type: "yearly",
    title: "Yearly Forecast",
    description: "A deeper annual report from your current planetary periods.",
    creditCost: REPORT_PRICING.yearly.creditCost,
    cta: "Generate Year",
    icon: Sparkles,
  },
  {
    type: "compatibility",
    title: REPORT_PRICING.compatibility.title,
    description: "Create this after running a partner matching analysis.",
    creditCost: REPORT_PRICING.compatibility.creditCost,
    cta: "Open Matching",
    icon: Heart,
    requiresCompatibilityFlow: true,
  },
];

/**
 * Client-chosen id for ONE paid report purchase, sent to /api/pdf-report as
 * `requestId`. The server uses it as the report id and charges at most once
 * per id, so retrying the same click after a network failure can't double
 * charge. Use a fresh id for each new purchase. Matches the server's
 * REPORT_ID_PATTERN (letters, digits, "_" and "-").
 */
export function createReportRequestId(): string {
  const random =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  return `req_${random}`;
}

/**
 * POST /api/pdf-report, retrying a network drop once with the SAME body (so
 * the same `requestId`): the server either finishes the original purchase
 * (served free) or answers 409 `report_in_progress` — never a second charge.
 * Callers keep the requestId until the server answers, so a later click after
 * two failed attempts also reuses it.
 */
export async function postPdfReport(
  body: Record<string, unknown> & { requestId: string },
): Promise<Response> {
  const send = () =>
    fetch("/api/pdf-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  try {
    return await send();
  } catch {
    await new Promise((resolve) => window.setTimeout(resolve, 1500));
    return send();
  }
}

/** The 409 the server sends while a retried purchase is still generating. */
export const REPORT_IN_PROGRESS_MESSAGE =
  "This report is still being prepared. It will appear in your Reports library shortly.";
