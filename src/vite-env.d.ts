/// <reference types="vite/client" />

// Merges into Vite's own ImportMetaEnv so the DSN is typed where it is read.
interface ImportMetaEnv {
  /** Sentry DSN. Optional — error monitoring is a no-op when it is unset. */
  readonly VITE_SENTRY_DSN?: string;
}
