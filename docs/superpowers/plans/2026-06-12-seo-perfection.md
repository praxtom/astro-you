# SEO Perfection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn AstroYou SEO from crawl-ready into a compounding acquisition system built around fast indexable tools, deep topical clusters, clean metadata, and measurable conversion.

**Architecture:** Keep product/app routes clean and private. Public SEO routes are statically prerendered, listed in the sitemap, and supported by structured data, internal links, and conversion tracking. SEO content and tool metadata live in reusable registries so pages, routes, sitemap generation, and tests stay aligned.

**Tech Stack:** Vite, React, TypeScript, Netlify Functions, static prerender script, Google Search-compatible metadata and JSON-LD.

---

### Task 1: SEO Hygiene Gates

**Files:**
- Modify: `netlify/functions/__tests__/seo-content.test.ts`
- Modify: `src/components/SEO.tsx`
- Create or update: `public/og-image.svg`

- [ ] **Step 1: Write failing tests**

Add tests that assert:
- every default social image path points to an existing `public` asset,
- every SEO content page has enough body depth,
- every primary/secondary CTA points to an app route or SEO route known to the project.

- [ ] **Step 2: Run test to verify red**

Run: `pnpm run test:functions`

Expected: fail until the missing social image and content quality rules are satisfied.

- [ ] **Step 3: Implement the minimal fix**

Add the social image asset, update the default SEO image if needed, and improve failing SEO page metadata/content.

- [ ] **Step 4: Verify green**

Run: `pnpm run test:functions`

Expected: all function tests pass.

### Task 2: Tool-Led SEO Registry

**Files:**
- Create: `src/lib/seo-tools.ts`
- Modify: `netlify/functions/__tests__/seo-content.test.ts`
- Modify: `scripts/prerender-seo-pages.mjs`
- Modify: `src/App.tsx`

- [ ] **Step 1: Write failing tests**

Add tests requiring dedicated SEO tool entries for:
- `/moon-sign-calculator`
- `/nakshatra-finder`
- `/sade-sati-calculator`
- `/manglik-dosha-checker`
- `/dasha-calculator`
- `/panchang-today`

- [ ] **Step 2: Run test to verify red**

Run: `pnpm run test:functions`

Expected: fail until the registry exists and is included in SEO route generation.

- [ ] **Step 3: Implement registry and routes**

Create the registry with titles, descriptions, schema type, FAQs, and CTAs. Add public React routes and prerender entries.

- [ ] **Step 4: Verify green**

Run: `pnpm run test:functions`

Expected: tests pass and sitemap generation includes the new routes.

### Task 3: Public Tool Page Experience

**Files:**
- Create: `src/pages/SeoToolPage.tsx`
- Modify: `src/App.tsx`
- Modify: `src/lib/seo-tools.ts`

- [ ] **Step 1: Write failing tests**

Add tests that each tool page has:
- a first-screen tool CTA,
- FAQ schema,
- related tool links,
- no private route as the canonical URL.

- [ ] **Step 2: Run test to verify red**

Run: `pnpm run test:functions`

Expected: fail until tool pages expose the required metadata.

- [ ] **Step 3: Implement page**

Build a clean shared page: tool intent first, short explanation below, FAQs collapsed/lower on page, related links at bottom.

- [ ] **Step 4: Verify green**

Run: `pnpm test`

Expected: TypeScript and function tests pass.

### Task 4: Content Depth Expansion

**Files:**
- Modify: `src/lib/seo-content.ts`
- Modify: `netlify/functions/__tests__/seo-content.test.ts`

- [ ] **Step 1: Write failing tests**

Add minimum depth rules for SEO pages:
- at least 3 sections,
- at least 80 words of section body text total,
- at least 3 FAQs,
- at least 4 related links available.

- [ ] **Step 2: Run test to verify red**

Run: `pnpm run test:functions`

Expected: fail for thin pages.

- [ ] **Step 3: Expand pages**

Increase useful explanations for priority clusters first: Kundali, Matching, Sade Sati, Manglik, Panchang, Moon sign, Nakshatra, Dasha.

- [ ] **Step 4: Verify green**

Run: `pnpm test`

Expected: TypeScript and function tests pass.

### Task 5: Prerender And Sitemap Verification

**Files:**
- Modify: `scripts/prerender-seo-pages.mjs`
- Modify: `netlify/functions/__tests__/seo-content.test.ts`

- [ ] **Step 1: Write failing tests**

Add static checks that sitemap-prerender inputs exclude authenticated routes and include all public SEO routes.

- [ ] **Step 2: Run test to verify red**

Run: `pnpm run test:functions`

Expected: fail if any public SEO registry page is missing from prerender input.

- [ ] **Step 3: Implement shared route source or assertions**

Make route generation and tests consume the same public SEO route data.

- [ ] **Step 4: Verify build**

Run: `pnpm run build`

Expected: build completes and prerender logs the final route count.

### Task 6: Measurement And Distribution

**Files:**
- Modify: `src/lib/acquisition.ts`
- Modify: `docs/SEO_DISTRIBUTION_PLAN.md`

- [ ] **Step 1: Add tracking assertions**

Add tests or static checks for SEO acquisition events on tool pages and content CTAs.

- [ ] **Step 2: Implement tracking**

Ensure SEO page view, tool start, tool completion, CTA click, signup, first chat, and purchase attribution are captured.

- [ ] **Step 3: Write distribution plan**

Create a weekly process for publishing, Search Console review, creator outreach, backlink targets, and update cadence.

- [ ] **Step 4: Verify**

Run: `pnpm test`

Expected: TypeScript and function tests pass.
