import type { User } from "firebase/auth";
import app from "./firebase";

export async function isPushSupported() {
  if (typeof window === "undefined") return false;
  if (!("Notification" in window) || !("serviceWorker" in navigator)) return false;
  const { isSupported } = await import("firebase/messaging");
  return isSupported();
}

export async function requestBrainPushToken(user: User) {
  if (!(await isPushSupported())) {
    throw new Error("Browser push is not supported on this device.");
  }

  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
  if (!vapidKey) {
    throw new Error("Browser push is not configured yet.");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Browser push permission was not granted.");
  }

  const registration = await getServiceWorkerRegistration();
  const { getMessaging, getToken } = await import("firebase/messaging");
  const messaging = getMessaging(app);
  const token = await getToken(messaging, {
    vapidKey,
    serviceWorkerRegistration: registration,
  });
  if (!token) throw new Error("Could not create a browser push token.");

  const idToken = await user.getIdToken();
  const response = await fetch("/api/push-token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      idToken,
      token,
      platform: navigator.platform,
      userAgent: navigator.userAgent,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Could not save browser push token.");
  }

  return token;
}

export async function disableBrainPushNotifications(user: User) {
  const idToken = await user.getIdToken();
  const response = await fetch("/api/push-token", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Could not turn off browser push.");
  }
}

async function getServiceWorkerRegistration() {
  const existing = await navigator.serviceWorker.getRegistration("/");
  if (existing) return existing;
  return navigator.serviceWorker.register("/sw.js");
}
