/**
 * Centralized Firebase Admin SDK initialization.
 * Import { db, auth } from this module instead of initializing in each function.
 */
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

if (!getApps().length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "{}");
    initializeApp({ credential: cert(serviceAccount) });
}

export const db = getFirestore();
export const auth = getAuth();
export { FieldValue };
