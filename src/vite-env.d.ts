/// <reference types="vite/client" />

// Merges into Vite's own ImportMetaEnv so the DSN is typed where it is read.
interface ImportMetaEnv {
  /** Sentry DSN. Optional — error monitoring is a no-op when it is unset. */
  readonly VITE_SENTRY_DSN?: string;
  /**
   * Absolute origin the site is deployed at (e.g. "https://astroyou.app" or
   * "https://astroyou.netlify.app"). Optional — falls back to
   * `window.location.origin` in the browser, or the production domain
   * during SSR/prerender. Mirrored from `APP_BASE_URL` by vite.config.ts
   * when unset. See src/lib/site-url.ts.
   */
  readonly VITE_APP_BASE_URL?: string;
}
