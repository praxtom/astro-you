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
    description: "A downloadable Vedic birth chart report for your core placements.",
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
