import { REPORT_PRICING, type ReportType } from "../../../src/lib/report-pricing.js";

export type PaidReportType = ReportType;

export interface ReportProduct {
  type: PaidReportType;
  title: string;
  creditCost: number;
  filenameSlug: string;
}

export const REPORT_PRODUCTS: Record<PaidReportType, ReportProduct> = {
  natal: {
    type: "natal",
    title: REPORT_PRICING.natal.title,
    creditCost: REPORT_PRICING.natal.creditCost,
    filenameSlug: "natal-report",
  },
  compatibility: {
    type: "compatibility",
    title: REPORT_PRICING.compatibility.title,
    creditCost: REPORT_PRICING.compatibility.creditCost,
    filenameSlug: "compatibility-report",
  },
  yearly: {
    type: "yearly",
    title: REPORT_PRICING.yearly.title,
    creditCost: REPORT_PRICING.yearly.creditCost,
    filenameSlug: "yearly-forecast",
  },
  daily: {
    type: "daily",
    title: REPORT_PRICING.daily.title,
    creditCost: REPORT_PRICING.daily.creditCost,
    filenameSlug: "daily-horoscope",
  },
  weekly: {
    type: "weekly",
    title: REPORT_PRICING.weekly.title,
    creditCost: REPORT_PRICING.weekly.creditCost,
    filenameSlug: "weekly-horoscope",
  },
};

export function isReportType(value: unknown): value is PaidReportType {
  return typeof value === "string" && value in REPORT_PRODUCTS;
}

export function getReportProduct(reportType: unknown): ReportProduct {
  if (!isReportType(reportType)) {
    throw new Error(`Unknown report type: ${String(reportType)}`);
  }
  return REPORT_PRODUCTS[reportType];
}

export function createReportFilename(reportType: PaidReportType, dateKey: string): string {
  const product = getReportProduct(reportType);
  const safeDate = dateKey.replace(/[^0-9-]/g, "") || new Date().toISOString().split("T")[0];
  return `astroyou-${product.filenameSlug}-${safeDate}.pdf`;
}
