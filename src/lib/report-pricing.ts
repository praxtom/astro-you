export type ReportType = "natal" | "compatibility" | "yearly" | "daily" | "weekly";

export interface ReportPricing {
  type: ReportType;
  title: string;
  creditCost: number;
}

export const REPORT_PRICING: Record<ReportType, ReportPricing> = {
  natal: {
    type: "natal",
    title: "Birth Chart Report",
    creditCost: 75,
  },
  daily: {
    type: "daily",
    title: "Daily Horoscope PDF",
    creditCost: 10,
  },
  weekly: {
    type: "weekly",
    title: "Weekly Horoscope PDF",
    creditCost: 25,
  },
  yearly: {
    type: "yearly",
    title: "Yearly Forecast Report",
    creditCost: 199,
  },
  compatibility: {
    type: "compatibility",
    title: "Compatibility Report",
    creditCost: 99,
  },
};
