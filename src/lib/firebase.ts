import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics, logEvent, type Analytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// GA4 must NOT initialize before the user has accepted the privacy notice —
// getAnalytics() drops cookies and pings Google, which is unlawful pre-consent
// for EU visitors. It stays off until enableAnalytics() is called (on the
// consent gesture at sign-in) or a prior grant is found in this browser.
const ANALYTICS_CONSENT_KEY = "astroyou:analytics_consent";
let analytics: Analytics | null = null;

function readConsent(): boolean {
  try {
    return (
      typeof window !== "undefined" &&
      window.localStorage.getItem(ANALYTICS_CONSENT_KEY) === "granted"
    );
  } catch {
    return false;
  }
}

function initAnalytics() {
  if (analytics || typeof window === "undefined") return;
  try {
    analytics = getAnalytics(app);
  } catch {
    /* analytics is best-effort — never break the app over it */
  }
}

/** Whether the user has previously granted analytics consent in this browser. */
export function hasAnalyticsConsent(): boolean {
  return readConsent();
}

/** Record consent and start GA4. Called when the user accepts the notice. */
export function enableAnalytics() {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(ANALYTICS_CONSENT_KEY, "granted");
    } catch {
      /* ignore storage failures */
    }
  }
  initAnalytics();
}

// Honor a prior grant so returning users keep analytics without re-consenting.
if (readConsent()) initAnalytics();

export function trackEvent(name: string, params?: Record<string, any>) {
  if (analytics) logEvent(analytics, name, params);
}

export default app;
