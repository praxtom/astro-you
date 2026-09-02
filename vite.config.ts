import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Netlify UI sets APP_BASE_URL (server-side env, not exposed to the client
// bundle by default — Vite only inlines VITE_*). Mirror it into
// VITE_APP_BASE_URL at build time so src/lib/site-url.ts sees the same value
// without requiring it to be duplicated in the Netlify UI. An explicit
// VITE_APP_BASE_URL (e.g. from a local .env) always wins.
const appBaseUrl = process.env.VITE_APP_BASE_URL || process.env.APP_BASE_URL;

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: appBaseUrl
    ? { "import.meta.env.VITE_APP_BASE_URL": JSON.stringify(appBaseUrl) }
    : {},
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8888",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
