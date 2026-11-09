import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { MotionConfig } from "framer-motion";
import App from "./App.tsx";
import "./index.css";
import { AuthProvider } from "./lib/AuthContext.tsx";
import { ToastProvider } from "./components/ui/Toast.tsx";

/**
 * A deploy replaces the hashed lazy chunks, so a tab that was open across the
 * deploy asks for a filename that no longer exists and the route renders as a
 * blank screen. Vite raises `vite:preloadError` for exactly that case — reload
 * once so the fresh index.html (and its fresh chunk names) is picked up.
 */
window.addEventListener("vite:preloadError", () => {
  window.location.reload();
});

/**
 * Error monitoring. Entirely optional: with no `VITE_SENTRY_DSN` set, nothing
 * is imported and nothing is sent, so the SDK stays out of the eager bundle.
 * When a DSN is present the SDK is code-split behind a dynamic import and
 * published on `window.Sentry`, which is what `lib/reportError.ts` looks for.
 */
const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
if (typeof sentryDsn === "string" && sentryDsn.trim() !== "") {
  void import("@sentry/react")
    .then((Sentry) => {
      Sentry.init({
        dsn: sentryDsn,
        environment: import.meta.env.MODE,
        sendDefaultPii: false,
        tracesSampleRate: 0,
      });
      (globalThis as { Sentry?: unknown }).Sentry = Sentry;
    })
    .catch(() => {
      /* monitoring is best-effort — never break the app over it */
    });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </MotionConfig>
  </StrictMode>,
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
