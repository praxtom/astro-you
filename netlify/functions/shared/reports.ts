import {
  REPORT_PRICING,
  type ReportType,
} from "../../../src/lib/report-pricing.js";
import type { PdfBlock } from "./simple-pdf.js";

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

export function createReportFilename(
  reportType: PaidReportType,
  dateKey: string,
): string {
  const product = getReportProduct(reportType);
  const safeDate =
    dateKey.replace(/[^0-9-]/g, "") || new Date().toISOString().split("T")[0];
  return `astroyou-${product.filenameSlug}-${safeDate}.pdf`;
}

// ─── Yearly forecast → readable PDF sections ────────────────────────────────

export interface ReportSections {
  blocks: PdfBlock[];
  /** Characters of actual prose (not headings/labels). */
  proseChars: number;
}

/** Below this much prose a paid report is not worth delivering. */
export const MIN_REPORT_PROSE_CHARS = 200;

type AnyRecord = Record<string, unknown>;

function isRecord(value: unknown): value is AnyRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string {
  if (typeof value === "string") return value.replace(/\s+/g, " ").trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function firstText(record: AnyRecord, keys: string[]): string {
  for (const key of keys) {
    const value = text(record[key]);
    if (value) return value;
  }
  return "";
}

function firstArray(record: AnyRecord, keys: string[]): unknown[] {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value) && value.length > 0) return value;
  }
  return [];
}

function sentence(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function rating(value: unknown): string {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return "";
  const out = n <= 5 ? `${Math.round(n * 10) / 10}/5` : `${Math.round(n)}/100`;
  return out;
}

function humanize(key: string): string {
  const spaced = key.replace(/[_-]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Drop a leading emoji/symbol from upstream titles like "💼 Career". */
function cleanTitle(value: string): string {
  return value.replace(/^[^\p{L}\p{N}]+/u, "").trim();
}

const PROSE_KEYS = [
  "prediction",
  "description",
  "summary",
  "forecast",
  "advice",
  "guidance",
  "text",
  "interpretation",
  "details",
  "content",
];

/**
 * Turn the structured `/horoscope/personal/yearly` payload into headings and
 * sentences. Recognises the documented shape (yearly_theme, quarterly_breakdown,
 * life_areas, planetary_influences, ...) plus common variants, and falls back
 * to the prose fields of any unrecognised section. Never emits raw JSON; the
 * caller refunds when `proseChars` is too small to be a real report.
 */
export function formatYearlyForecastSections(input: unknown): ReportSections {
  const blocks: PdfBlock[] = [];
  let proseChars = 0;
  const prose = (value: string) => {
    const s = sentence(value);
    if (!s) return;
    blocks.push(s);
    proseChars += s.length;
  };
  const label = (value: string) => {
    if (value) blocks.push(sentence(value));
  };

  let data: unknown = input;
  if (typeof data === "string") {
    const trimmed = data.trim();
    if (trimmed && !/^[[{]/.test(trimmed)) prose(trimmed);
    return { blocks, proseChars };
  }
  if (isRecord(data) && isRecord(data.data)) data = data.data;
  if (!isRecord(data)) return { blocks, proseChars };

  const handled = new Set<string>();
  const markHandled = (...keys: string[]) => keys.forEach((k) => handled.add(k));

  // Overview
  const themeKeys = [
    "yearly_theme",
    "theme",
    "overview",
    "summary",
    "general",
    "prediction",
  ];
  markHandled(
    ...themeKeys,
    "overall_rating",
    "time_window",
    "subject",
    "sign",
    "timeframe",
  );
  const theme = firstText(data, themeKeys);
  const overall = rating(data.overall_rating);
  const window = isRecord(data.time_window) ? data.time_window : null;
  if (theme || overall || window) {
    blocks.push({ heading: "Your year at a glance" });
    if (window && text(window.start) && text(window.end)) {
      label(`Covers ${text(window.start)} to ${text(window.end)}`);
    }
    if (theme) prose(theme);
    if (overall) label(`Overall outlook: ${overall}`);
  }

  // Quarters
  const quarterKeys = ["quarterly_breakdown", "quarters", "quarterly"];
  markHandled(...quarterKeys);
  const quarters = firstArray(data, quarterKeys).filter(isRecord);
  if (quarters.length) {
    blocks.push({ heading: "Quarter by quarter" });
    quarters.forEach((q, i) => {
      const name =
        firstText(q, ["quarter", "name", "period"]) || `Quarter ${i + 1}`;
      const focus = firstText(q, ["focus", "theme", "title"]);
      blocks.push({ subheading: focus ? `${name} - ${focus}` : name });
      const body = firstText(q, PROSE_KEYS);
      if (body) prose(body);
      const r = rating(q.rating);
      if (r) label(`Energy: ${r}`);
    });
  }

  // Months
  const monthKeys = [
    "monthly_breakdown",
    "months",
    "monthly",
    "monthly_forecast",
  ];
  markHandled(...monthKeys);
  const months = firstArray(data, monthKeys).filter(isRecord);
  if (months.length) {
    blocks.push({ heading: "Month by month" });
    months.forEach((m, i) => {
      const name =
        firstText(m, ["month", "name", "period"]) || `Month ${i + 1}`;
      const focus = firstText(m, ["focus", "theme", "title"]);
      blocks.push({ subheading: focus ? `${name} - ${focus}` : name });
      const body = firstText(m, PROSE_KEYS);
      if (body) prose(body);
      const r = rating(m.rating);
      if (r) label(`Energy: ${r}`);
    });
  }

  // Life areas
  const areaKeys = ["life_areas", "areas", "life_area_forecasts"];
  markHandled(...areaKeys);
  const areas = firstArray(data, areaKeys).filter(isRecord);
  if (areas.length) {
    blocks.push({ heading: "Areas of life" });
    areas.forEach((a) => {
      const title = cleanTitle(firstText(a, ["title", "area", "name"]));
      if (title) blocks.push({ subheading: humanize(title) });
      const body = firstText(a, PROSE_KEYS);
      if (body) prose(body);
      const r = rating(a.rating);
      if (r) label(`Outlook: ${r}`);
      if (Array.isArray(a.keywords)) {
        const words = a.keywords.map(text).filter(Boolean).slice(0, 8);
        if (words.length) label(`Keywords: ${words.join(", ")}`);
      }
    });
  }

  // Planetary influences / major transits
  const influenceKeys = [
    "planetary_influences",
    "major_transits",
    "key_transits",
    "transits",
  ];
  markHandled(...influenceKeys);
  const influences = firstArray(data, influenceKeys).filter(isRecord);
  if (influences.length) {
    blocks.push({ heading: "Planetary influences" });
    influences.forEach((p) => {
      const planet = firstText(p, ["planet", "transiting_planet", "name"]);
      const aspect = firstText(p, ["aspect_type", "aspect"]);
      const natal = firstText(p, ["natal_planet", "target"]);
      const head = [planet, aspect, natal ? `natal ${natal}` : ""]
        .filter(Boolean)
        .join(" ");
      const body = firstText(p, PROSE_KEYS);
      if (head && body) prose(`${head}: ${body}`);
      else if (body) prose(body);
      else if (head) label(head);
    });
  }

  // Retrogrades
  const retroKeys = ["retrograde_periods", "retrogrades"];
  markHandled(...retroKeys);
  const retros = firstArray(data, retroKeys).filter(isRecord);
  if (retros.length) {
    blocks.push({ heading: "Retrograde periods" });
    retros.forEach((r) => {
      const planet = firstText(r, ["planet", "name"]);
      const start = firstText(r, ["start", "start_date", "from"]);
      const end = firstText(r, ["end", "end_date", "to"]);
      const when = start && end ? ` (${start} to ${end})` : "";
      const body = firstText(r, PROSE_KEYS);
      if (body)
        prose(`${planet ? `${planet} retrograde${when}: ` : ""}${body}`);
      else if (planet) label(`${planet} retrograde${when}`);
    });
  }

  // Key dates
  const dateKeys = ["key_dates", "important_dates", "keyDates"];
  markHandled(...dateKeys);
  const dates = firstArray(data, dateKeys).filter(isRecord);
  if (dates.length) {
    blocks.push({ heading: "Key dates" });
    dates.forEach((d) => {
      const date = firstText(d, ["date", "day", "start"]);
      const body = firstText(d, ["event", "title", ...PROSE_KEYS]);
      if (body) prose(date ? `${date}: ${body}` : body);
    });
  }

  // Advice
  const adviceKeys = ["advice", "recommendations", "tips", "guidance"];
  markHandled(...adviceKeys);
  for (const key of adviceKeys) {
    const value = data[key];
    const items = Array.isArray(value)
      ? value.map((v) => (isRecord(v) ? firstText(v, PROSE_KEYS) : text(v)))
      : [text(value)];
    const clean = items.filter((v) => v.length > 0);
    if (clean.length) {
      blocks.push({ heading: "Guidance for the year" });
      clean.forEach(prose);
      break;
    }
  }

  // Anything else: keep its prose fields, labelled by key. Never the JSON.
  for (const [key, value] of Object.entries(data)) {
    if (handled.has(key)) continue;
    const pieces: string[] = [];
    if (typeof value === "string" && value.trim().length >= 40) {
      pieces.push(value);
    } else if (Array.isArray(value)) {
      value.forEach((item) => {
        if (typeof item === "string" && item.trim().length >= 20)
          pieces.push(item);
        else if (isRecord(item)) {
          const body = firstText(item, PROSE_KEYS);
          if (body) pieces.push(body);
        }
      });
    } else if (isRecord(value)) {
      const body = firstText(value, PROSE_KEYS);
      if (body) pieces.push(body);
    }
    if (pieces.length) {
      blocks.push({ heading: humanize(key) });
      pieces.slice(0, 20).forEach(prose);
    }
  }

  return { blocks, proseChars };
}
