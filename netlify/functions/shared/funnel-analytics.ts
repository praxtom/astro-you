import {
  isAnalyticsEventName,
  type FunnelEventName,
} from "../../../src/lib/analytics-events.js";

export type { FunnelEventName } from "../../../src/lib/analytics-events.js";

export type AcquisitionMedium =
  | "seo_tool"
  | "seo_content"
  | "consult"
  | "pricing"
  | "referral"
  | "unknown";

export interface FunnelEventPayload {
  eventName?: unknown;
  params?: unknown;
  path?: unknown;
  referrer?: unknown;
  anonymousId?: unknown;
  sessionId?: unknown;
  acquisition?: unknown;
}

export interface FunnelEventContext {
  uid?: string | null;
}

export class FunnelAnalyticsError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
    this.name = "FunnelAnalyticsError";
  }
}

const BLOCKED_PARAM_KEYS = [
  "email",
  "phone",
  "name",
  "fullName",
  "dob",
  "tob",
  "birthData",
  "message",
  "question",
  "notes",
  "bio",
  "sampleApproach",
];

export function buildFunnelEventRecord(
  payload: FunnelEventPayload,
  context: FunnelEventContext,
  createdAt: unknown,
) {
  const eventName = cleanString(payload.eventName, 80) as FunnelEventName;
  if (!isAnalyticsEventName(eventName)) {
    throw new FunnelAnalyticsError("Supported analytics event is required");
  }

  const acquisition = normalizeAcquisition(payload.acquisition);

  return {
    eventName,
    uid: cleanString(context.uid, 128) || null,
    anonymousId: cleanString(payload.anonymousId, 100) || null,
    sessionId: cleanString(payload.sessionId, 100) || null,
    path: normalizePath(payload.path),
    referrerHost: normalizeReferrerHost(payload.referrer),
    params: sanitizeParams(payload.params),
    acquisition,
    createdAt,
  };
}

function sanitizeParams(value: unknown) {
  const source = isRecord(value) ? value : {};
  const entries = Object.entries(source).slice(0, 30);
  const params: Record<string, string | number | boolean | null> = {};

  for (const [rawKey, rawValue] of entries) {
    const key = cleanParamKey(rawKey);
    if (!key || isBlockedParamKey(key)) continue;

    if (typeof rawValue === "string") {
      params[key] = cleanString(rawValue, 240);
    } else if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
      params[key] = rawValue;
    } else if (typeof rawValue === "boolean" || rawValue === null) {
      params[key] = rawValue;
    }
  }

  return params;
}

function normalizeAcquisition(value: unknown) {
  const source = isRecord(value) ? value : {};
  const medium = cleanString(source.medium, 40) as AcquisitionMedium;
  const allowedMediums: AcquisitionMedium[] = [
    "seo_tool",
    "seo_content",
    "consult",
    "pricing",
    "referral",
    "unknown",
  ];

  return {
    source: cleanString(source.source, 100) || null,
    medium: allowedMediums.includes(medium) ? medium : "unknown",
    campaign: cleanString(source.campaign, 100) || null,
  };
}

function normalizePath(value: unknown) {
  const rawPath = cleanString(value, 240);
  if (!rawPath) return null;

  try {
    const parsed = rawPath.startsWith("http")
      ? new URL(rawPath)
      : new URL(rawPath, "https://astroyou.local");
    return parsed.pathname.slice(0, 220);
  } catch {
    return rawPath.startsWith("/") ? rawPath.split("?")[0].slice(0, 220) : null;
  }
}

function normalizeReferrerHost(value: unknown) {
  const rawReferrer = cleanString(value, 240);
  if (!rawReferrer) return null;

  try {
    return new URL(rawReferrer).hostname.slice(0, 120);
  } catch {
    return null;
  }
}

function cleanParamKey(value: string) {
  return value.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 40);
}

function isBlockedParamKey(key: string) {
  const normalized = key.toLowerCase();
  return BLOCKED_PARAM_KEYS.some((blocked) => normalized.includes(blocked.toLowerCase()));
}

function cleanString(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, maxLength) : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
