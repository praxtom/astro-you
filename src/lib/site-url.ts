/**
 * Single source of truth for the site's own absolute origin.
 *
 * Production runs at whatever `APP_BASE_URL` is set to in the Netlify UI
 * (currently astroyou.netlify.app while astroyou.app is not yet live), and
 * `vite.config.ts` mirrors that into the client-visible `VITE_APP_BASE_URL`
 * at build time. This module reads that value so no file has to hard-code
 * a domain.
 *
 * `getSiteOrigin()` is also called from `src/lib/seo-content.ts` at module
 * load time, which the prerender script (`scripts/prerender-seo-pages.mjs`)
 * compiles with a standalone `tsc` invocation (no tsconfig, no vite/client
 * types) and runs under plain Node — outside Vite, so `import.meta.env`
 * itself is `undefined` there. The cast below is load-bearing on two counts:
 * it avoids a compile error against `ImportMeta` (which has no `env` in that
 * standalone compile) and, via optional chaining, keeps the access from
 * throwing at runtime — falling through to the Node/window/fallback
 * branches instead.
 *
 * That Node execution does inherit `process.env.APP_BASE_URL` (the same
 * value Netlify's build passes to `npm run build`, since the prerender
 * script's own `tsc` subprocess and the dynamic `import()` of its output
 * both run inside that same `node scripts/prerender-seo-pages.mjs`
 * process), so it is checked as a second source of truth before falling
 * back to the hardcoded production domain. `(globalThis as any).process` —
 * rather than a bare `process` reference — is deliberate: referencing an
 * undeclared `process` identifier directly would throw a ReferenceError in
 * the browser, where no such global exists, whereas a property lookup on
 * `globalThis` just resolves to `undefined` and the optional chaining short
 * -circuits harmlessly.
 */
export function getSiteOrigin(): string {
  const env = (
    import.meta as unknown as { env?: Record<string, string | undefined> }
  ).env;
  const configured = env?.VITE_APP_BASE_URL;
  if (configured && configured.trim() !== "") {
    return configured.replace(/\/+$/, "");
  }

  const nodeEnv = (globalThis as any).process?.env as
    Record<string, string | undefined> | undefined;
  const nodeConfigured = nodeEnv?.APP_BASE_URL;
  if (nodeConfigured && nodeConfigured.trim() !== "") {
    return normalizeWithScheme(nodeConfigured);
  }

  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return "https://astroyou.app";
}

/** Strips a trailing slash and prepends "https://" when no scheme is present. */
function normalizeWithScheme(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

/** Builds an absolute URL on the site's own origin from a path. */
export function siteUrl(path = "/"): string {
  const origin = getSiteOrigin();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${origin}${normalizedPath}`;
}
