import { auth, trackEvent } from "./firebase";
import {
  isAnalyticsEventName,
  type FunnelEventName,
} from "./analytics-events";
import {
  extractReferralCodeFromSearch,
  normalizeClientReferralCode,
} from "./referrals";

const STORAGE_KEY = "astroyou:acquisition";
const REFERRAL_STORAGE_KEY = "astroyou:pending_referral_code";
const ANALYTICS_ID_KEY = "astroyou:analytics_id";
const ANALYTICS_SESSION_KEY = "astroyou:analytics_session_id";

export interface AcquisitionSource {
  source: string;
  medium:
    | "seo_tool"
    | "seo_content"
    | "consult"
    | "pricing"
    | "referral"
    | "unknown";
  campaign?: string;
  capturedAt: number;
}

export function captureAcquisitionSource(
  source: Omit<AcquisitionSource, "capturedAt">,
) {
  if (typeof window === "undefined") return;
  const payload: AcquisitionSource = {
    ...source,
    capturedAt: Date.now(),
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn("[acquisition] Could not store source", err);
  }
  trackEvent("acquisition_source_captured", payload);
  void sendServerAnalyticsEvent("acquisition_source_captured", { ...payload });
}

export function getAcquisitionSource(): AcquisitionSource | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AcquisitionSource) : null;
  } catch (err) {
    console.warn("[acquisition] Could not read source", err);
    return null;
  }
}

export function captureReferralFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const code = extractReferralCodeFromSearch(window.location.search);
  if (!code) return null;

  try {
    localStorage.setItem(REFERRAL_STORAGE_KEY, code);
  } catch (err) {
    console.warn("[acquisition] Could not store referral", err);
  }

  captureAcquisitionSource({
    source: code,
    medium: "referral",
    campaign: "friend_invite",
  });
  return code;
}

export function getPendingReferralCode(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return normalizeClientReferralCode(localStorage.getItem(REFERRAL_STORAGE_KEY));
  } catch (err) {
    console.warn("[acquisition] Could not read referral", err);
    return null;
  }
}

export function clearPendingReferralCode() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(REFERRAL_STORAGE_KEY);
  } catch (err) {
    console.warn("[acquisition] Could not clear referral", err);
  }
}

export function trackAcquisitionEvent(
  name: FunnelEventName,
  params: Record<string, unknown> = {},
) {
  if (!isAnalyticsEventName(name)) return;
  const source = getAcquisitionSource();
  const payload = {
    ...params,
    acquisition_source: source?.source,
    acquisition_medium: source?.medium,
    acquisition_campaign: source?.campaign,
  };
  trackEvent(name, payload);
  void sendServerAnalyticsEvent(name, params);
}

async function sendServerAnalyticsEvent(
  eventName: string,
  params: Record<string, unknown> = {},
) {
  if (typeof window === "undefined") return;
  if (!shouldSendServerAnalytics()) return;

  try {
    const source = getAcquisitionSource();
    const idToken = auth.currentUser
      ? await auth.currentUser.getIdToken().catch(() => null)
      : null;

    await fetch("/api/analytics/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        idToken,
        eventName,
        params,
        path: window.location.pathname + window.location.search,
        referrer: document.referrer,
        anonymousId: getOrCreateStoredId(ANALYTICS_ID_KEY, "anon"),
        sessionId: getOrCreateStoredId(ANALYTICS_SESSION_KEY, "session", true),
        acquisition: source
          ? {
              source: source.source,
              medium: source.medium,
              campaign: source.campaign,
            }
          : undefined,
      }),
    });
  } catch (err) {
    console.warn("[analytics] Could not record server event", err);
  }
}

function shouldSendServerAnalytics() {
  if (import.meta.env.VITE_ENABLE_SERVER_ANALYTICS === "true") return true;
  return window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1";
}

function getOrCreateStoredId(key: string, prefix: string, sessionOnly = false) {
  const storage = sessionOnly ? window.sessionStorage : window.localStorage;
  const existing = storage.getItem(key);
  if (existing) return existing;

  const randomId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const value = `${prefix}_${randomId}`;
  storage.setItem(key, value);
  return value;
}
