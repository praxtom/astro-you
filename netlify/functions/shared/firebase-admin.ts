/**
 * Centralized Firebase Admin SDK initialization.
 * Import { db, auth } from this module instead of initializing in each function.
 */
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";
import { getMessaging } from "firebase-admin/messaging";

if (!getApps().length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "{}");
    const storageBucket = getConfiguredStorageBucket();
    const options: Parameters<typeof initializeApp>[0] = {
        credential: cert(serviceAccount),
    };
    if (storageBucket) {
        options.storageBucket = storageBucket;
    }
    initializeApp(options);
}

export const db = getFirestore();
export const auth = getAuth();
export const messaging = getMessaging();
export function getStorageBucket() {
    const storageBucket = getConfiguredStorageBucket();
    return storageBucket
        ? getStorage().bucket(storageBucket)
        : getStorage().bucket();
}
export { FieldValue };

function getConfiguredStorageBucket() {
    return process.env.FIREBASE_STORAGE_BUCKET || process.env.VITE_FIREBASE_STORAGE_BUCKET;
}
