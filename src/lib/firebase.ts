import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics, logEvent } from "firebase/analytics";

// Determine if we're in production (not localhost)
const isProduction =
    typeof window !== "undefined" &&
    window.location.hostname !== "localhost" &&
    window.location.hostname !== "127.0.0.1";

// For redirect auth to work, authDomain must match the hosting domain
// In production, use the current hostname; in dev, use the Firebase default
const authDomain = isProduction
    ? window.location.hostname
    : import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: authDomain,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;

export function trackEvent(name: string, params?: Record<string, any>) {
    if (analytics) logEvent(analytics, name, params);
}

export default app;
