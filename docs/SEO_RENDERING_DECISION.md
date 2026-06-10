# SEO Rendering Decision

## Decision

AstroYou will keep the current Vite React app for product speed and add a post-build static prerender step for SEO acquisition pages.

## Why

AstroSage wins through indexable pages. Runtime-only React meta tags are not enough for pages that must rank. The first wave of SEO pages now writes route-specific HTML files into `dist/{route}/index.html` after `vite build`.

## Scope

Static prerender applies to:

- `/free-kundali`
- `/free-kundali-matching`
- `/panchang`
- `/muhurat`
- `/kundali`
- `/kundali-matching`
- `/daily-horoscope`
- `/sade-sati`
- `/manglik`
- `/nakshatra`
- `/dasha`
- `/horoscope/{sign}/{daily|weekly|monthly|yearly}`

## Rules

- Pages that must rank need useful HTML before client JavaScript runs.
- The React page still owns the interactive tool after hydration.
- Free tools must give value before signup.
- Signup CTAs should feel like saving or deepening, not a hard wall.
- SEO pages must route into product actions: profile save, Synthesis, Consult, or payment.

## Implementation

- `scripts/prerender-seo-pages.mjs` creates static route HTML and `sitemap.xml`.
- `pnpm run build` runs TypeScript, Vite, then the prerender step.
- Netlify runs `pnpm run build` and serves static route files before the SPA fallback.
