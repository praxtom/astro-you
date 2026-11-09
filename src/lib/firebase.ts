import { initializeApp } from "firebase/app";
import {
  browserLocalPersistence,
  browserPopupRedirectResolver,
  inMemoryPersistence,
  indexedDBLocalPersistence,
  initializeAuth,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import {
  getAnalytics,
  logEvent,
  setAnalyticsCollectionEnabled,
  type Analytics,
} from "firebase/analytics";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

// Auth persistence is ordered deliberately. Firebase's IndexedDB store closes
// its database the moment the tab reports `hidden`, which Chrome does while the
// Google sign-in popup covers the window — the write that lands when the popup
// returns then throws "Database is closing/hidden" and the sign-in is lost.
// localStorage has no such lifecycle, so it leads; IndexedDB and memory stay on
// as fallbacks for browsers that block it. The resolver must be passed
// explicitly here: initializeAuth (unlike getAuth) does not bundle one, and
// both signInWithPopup and getRedirectResult need it.
export const auth = initializeAuth(app, {
  persistence: [
    browserLocalPersistence,
    indexedDBLocalPersistence,
    inMemoryPersistence,
  ],
  popupRedirectResolver: browserPopupRedirectResolver,
});
export const db = getFirestore(app);
export const storage = getStorage(app);

// GA4 must NOT initialize before the user has opted in — getAnalytics() drops
// cookies and pings Google, which is unlawful pre-consent. Analytics consent is
// its own, unbundled choice (an unchecked box at sign-in, a toggle in
// Settings); agreeing to the Terms/Privacy notice does not imply it.
//
// The stored value is versioned: the old "granted" value was recorded by a
// sign-in notice that bundled analytics with the Terms, so it is not treated
// as consent and is dropped on load. Only an explicit opt-in writes OPTED_IN.
const ANALYTICS_CONSENT_KEY = "astroyou:analytics_consent";
const OPTED_IN = "opted-in:v2";
let analytics: Analytics | null = null;

function readConsent(): boolean {
  try {
    if (typeof window === "undefined") return false;
    const value = window.localStorage.getItem(ANALYTICS_CONSENT_KEY);
    if (value !== null && value !== OPTED_IN) {
      window.localStorage.removeItem(ANALYTICS_CONSENT_KEY);
      return false;
    }
    return value === OPTED_IN;
  } catch {
    return false;
  }
}

function initAnalytics() {
  if (typeof window === "undefined") return;
  try {
    if (analytics) {
      // Re-enabled after a withdrawal in the same page session.
      setAnalyticsCollectionEnabled(analytics, true);
      return;
    }
    analytics = getAnalytics(app);
  } catch {
    /* analytics is best-effort — never break the app over it */
  }
}

/** Best-effort removal of the GA4 first-party cookies (_ga, _ga_<id>). */
function clearAnalyticsCookies() {
  if (typeof document === "undefined") return;
  try {
    const host = window.location.hostname;
    const parts = host.split(".");
    const domains = ["", host];
    for (let i = 1; i < parts.length - 1; i++) {
      domains.push(`.${parts.slice(i).join(".")}`);
    }
    for (const cookie of document.cookie.split(";")) {
      const name = cookie.split("=")[0]?.trim();
      if (!name || !/^_ga(_|$)/.test(name)) continue;
      for (const domain of domains) {
        document.cookie = `${name}=; Max-Age=0; path=/${domain ? `; domain=${domain}` : ""}`;
      }
    }
  } catch {
    /* ignore */
  }
}

/** Whether the user has opted in to analytics in this browser. */
export function hasAnalyticsConsent(): boolean {
  return readConsent();
}

/**
 * Record (true) or withdraw (false) analytics consent. Opting in starts GA4;
 * withdrawing stops collection immediately, forgets the choice and clears the
 * GA cookies. Settings and the sign-in modal both call this.
 */
export function setAnalyticsConsent(granted: boolean) {
  if (typeof window === "undefined") return;
  try {
    if (granted) window.localStorage.setItem(ANALYTICS_CONSENT_KEY, OPTED_IN);
    else window.localStorage.removeItem(ANALYTICS_CONSENT_KEY);
  } catch {
    /* ignore storage failures */
  }
  if (granted) {
    initAnalytics();
    return;
  }
  if (analytics) {
    try {
      setAnalyticsCollectionEnabled(analytics, false);
    } catch {
      /* ignore */
    }
  }
  clearAnalyticsCookies();
}

/**
 * A Google sign-in that falls back to a full-page redirect loses the modal's
 * checkbox state, so the opt-in rides along in sessionStorage and is applied
 * only once the redirect actually signs the user in.
 */
const PENDING_OPT_IN_KEY = "astroyou:analytics_optin_pending";

export function rememberPendingAnalyticsOptIn(granted: boolean) {
  try {
    if (granted) window.sessionStorage.setItem(PENDING_OPT_IN_KEY, "1");
    else window.sessionStorage.removeItem(PENDING_OPT_IN_KEY);
  } catch {
    /* ignore */
  }
}

/** Apply (and clear) an opt-in carried across a sign-in redirect. */
export function applyPendingAnalyticsOptIn(signedIn: boolean) {
  try {
    const pending = window.sessionStorage.getItem(PENDING_OPT_IN_KEY) === "1";
    window.sessionStorage.removeItem(PENDING_OPT_IN_KEY);
    if (pending && signedIn) setAnalyticsConsent(true);
  } catch {
    /* ignore */
  }
}

// Honor a prior explicit opt-in so returning users keep their choice.
if (readConsent()) initAnalytics();

export function trackEvent(name: string, params?: Record<string, any>) {
  if (analytics && readConsent()) logEvent(analytics, name, params);
}

export default app;
