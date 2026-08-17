# International / US Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make AstroYou correct and sellable for users outside India — fix the date/location bugs that only fire outside IST, add a Vedic/Western zodiac mode, support USD checkout via Razorpay, and reframe the Sanskrit-heavy, marriage-oriented UI for a mainstream US audience.

**Architecture:** Four independently shippable phases. Each introduces one pure-logic module under `src/lib/` (unit-testable from the existing `node:test` function harness), then threads it through the serverless functions, then the React layer. No new dependencies. Phases 1–3 are correctness/commerce and can ship in any order; Phase 4 is presentation and depends on Phase 2's mode flag.

**Tech Stack:** Vite 6 + React 19 + TypeScript, Netlify Functions, Firebase Firestore/Admin, Razorpay, astrology-api.io v3, `node:test` + `node:assert/strict`.

**Spec:** This document is self-contained. It implements the findings of the international-readiness audit recorded in the session that produced it; each phase header restates the defect it fixes and the evidence for it.

## Global Constraints

- **No new npm dependencies.** Use `Intl.*` built-ins for all date, timezone and currency formatting.
- **Every new `src/lib/*.ts` module MUST be added to the `include` array in `tsconfig.functions-test.json`.** The include list is explicit; an unregistered module makes `pnpm run test:functions` fail to compile.
- **Test runner:** `node:test` + `node:assert/strict`. Tests live in `netlify/functions/__tests__/*.test.ts` and import source as `../../../src/lib/<name>.js` (`.js` extension, NodeNext resolution).
- **Verify with:** `pnpm run test` (runs `test:types` then `test:functions`). Never claim a task done without pasting real output.
- **Never send the user's real name to astrology-api.io.** `buildSubject` sends `name: "AstroYou User"` deliberately ([astro-api.ts:182-197](../../../netlify/functions/shared/astro-api.ts)). Preserve this.
- **Netlify function style:** modern `export default async (req, ctx) => Response` + `export const config: Config`. Never the legacy `Handler` format.
- **Fallback timezone is `"Asia/Kolkata"`**, matching the existing default in [brain-nudges.ts:147](../../../netlify/functions/shared/brain-nudges.ts). India stays the default market; internationalization is additive.
- **Currency codes are ISO 4217 uppercase** (`"INR"`, `"USD"`). Both have 100 minor units, so a single `×100` conversion is correct for both.
- **Razorpay USD requires international payments to be activated on the Razorpay account.** Code must degrade to INR-only when `RAZORPAY_INTERNATIONAL_ENABLED` is not `"true"`.

---

## File Structure

**Phase 1 — Time & place correctness**

- Create `src/lib/local-date.ts` — timezone resolution + local calendar-day keys. Pure.
- Create `netlify/functions/__tests__/local-date.test.ts`
- Modify `src/types/user.ts` — document `timezone` as required-on-write
- Modify `src/pages/Onboarding.tsx` — capture browser timezone
- Modify `src/hooks/usePanchang.ts` — remove New Delhi default
- Modify `src/components/dashboard/PanchangCard.tsx` — accept props, drop duplicate fetch
- Modify `src/pages/Dashboard.tsx` — pass panchang down
- Modify `src/pages/Compatibility.tsx` — remove `"Mumbai, India"` fallback
- Modify `netlify/functions/shared/astro-api.ts` — classify upstream DST failures
- Modify `netlify/functions/kundali.ts` — surface DST error code
- Modify the 43 `toISOString().split("T")[0]` call sites

**Phase 2 — Zodiac mode**

- Create `src/lib/zodiac-mode.ts` — mode type, normalizer, API options, sign derivation
- Create `netlify/functions/__tests__/zodiac-mode.test.ts`
- Modify `netlify/functions/shared/astro-api.ts` — thread mode through 9 options blocks
- Modify `netlify/functions/kundali.ts` — accept mode, include it in the cache key
- Modify `src/hooks/useKundali.ts`, `useDailyPrediction.ts`, `useTransit.ts`
- Modify `src/pages/Settings.tsx`, `src/pages/Onboarding.tsx` — mode picker + explainer

**Phase 3 — Multi-currency**

- Create `src/lib/currency.ts` — currency type, detection, formatting, minor units
- Create `netlify/functions/__tests__/currency.test.ts`
- Modify `src/lib/credit-packs.ts` — per-currency amounts
- Modify `netlify/functions/shared/entitlements.ts` — per-currency tier prices
- Modify `netlify/functions/shared/razorpay-payments.ts` — currency-aware orders
- Modify `netlify/functions/razorpay-order.ts`, `razorpay-verify.ts`, `subscription-webhook.ts`
- Modify `src/pages/Pricing.tsx`, `src/pages/Wallet.tsx`

**Phase 4 — Mainstream reframe**

- Create `src/lib/glossary.ts` — term definitions
- Create `src/components/ui/GlossaryTerm.tsx` — accessible inline definition
- Create `netlify/functions/__tests__/glossary.test.ts`
- Modify dashboard cards — wrap Sanskrit terms
- Modify `src/pages/Compatibility.tsx` + `netlify/functions/compatibility.ts` — `personA`/`personB`
- Modify `netlify/functions/kundali.ts` + `FestivalCard.tsx` — region-aware festivals

---

# Phase 1 — Time & Place Correctness

**Defect:** `new Date().toISOString().split("T")[0]` is used in 43 places to mean "today". That is the **UTC** date. For a US Pacific user (UTC−7) the whole app flips to tomorrow at ~5pm local — horoscope, daily tarot, panchang, `DailyAltar`, streaks, journal. India is UTC+5:30, so its broken window is 00:00–05:30 IST, which is why this shipped unnoticed. Additionally `PanchangCard` is hardcoded to New Delhi, `Compatibility` falls back to Mumbai, and DST-ambiguous birth times hard-fail with a generic retry message.

### Task 1: `local-date` module

**Files:**

- Create: `src/lib/local-date.ts`
- Test: `netlify/functions/__tests__/local-date.test.ts`
- Modify: `tsconfig.functions-test.json`

**Interfaces:**

- Produces: `resolveTimezone(candidate?: string | null): string`, `localDateKey(timezone: string, at?: Date): string`, `localHour(timezone: string, at?: Date): number`, `isValidTimezone(value: unknown): value is string`, `DATE_KEY_RE: RegExp`, `FALLBACK_TIMEZONE: string`

- [ ] **Step 1: Write the failing test**

```ts
// netlify/functions/__tests__/local-date.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveTimezone,
  localDateKey,
  localHour,
  isValidTimezone,
  DATE_KEY_RE,
  FALLBACK_TIMEZONE,
} from "../../../src/lib/local-date.js";

// 2026-08-17T23:30:00Z. In UTC this is the 17th. In Los Angeles (UTC-7)
// it is 16:30 on the 17th; in Kolkata (UTC+5:30) it is 05:00 on the 18th.
// The UTC-date bug is exactly the disagreement between these three.
const AT = new Date("2026-08-17T23:30:00.000Z");

test("localDateKey returns the local calendar day, not the UTC day", () => {
  assert.equal(localDateKey("America/Los_Angeles", AT), "2026-08-17");
  assert.equal(localDateKey("Asia/Kolkata", AT), "2026-08-18");
  assert.equal(localDateKey("UTC", AT), "2026-08-17");
});

test("localDateKey crosses the US evening boundary the old code got wrong", () => {
  // 2026-08-18T00:30:00Z -> still the 17th in America/New_York (UTC-4).
  const evening = new Date("2026-08-18T00:30:00.000Z");
  assert.equal(localDateKey("America/New_York", evening), "2026-08-17");
  assert.equal(evening.toISOString().split("T")[0], "2026-08-18"); // the bug
});

test("localDateKey zero-pads single-digit months and days", () => {
  const early = new Date("2026-01-05T12:00:00.000Z");
  assert.equal(localDateKey("UTC", early), "2026-01-05");
  assert.match(localDateKey("UTC", early), DATE_KEY_RE);
});

test("localHour reports the local wall-clock hour in 0-23", () => {
  assert.equal(localHour("America/Los_Angeles", AT), 16);
  assert.equal(localHour("Asia/Kolkata", AT), 5);
});

test("localHour returns 0 for local midnight, not 24", () => {
  const midnightIst = new Date("2026-08-17T18:30:00.000Z");
  assert.equal(localHour("Asia/Kolkata", midnightIst), 0);
});

test("isValidTimezone accepts IANA names and rejects junk", () => {
  assert.equal(isValidTimezone("America/New_York"), true);
  assert.equal(isValidTimezone("Asia/Kolkata"), true);
  assert.equal(isValidTimezone("Not/AZone"), false);
  assert.equal(isValidTimezone(""), false);
  assert.equal(isValidTimezone(undefined), false);
  assert.equal(isValidTimezone(42), false);
});

test("resolveTimezone prefers a valid candidate and falls back otherwise", () => {
  assert.equal(resolveTimezone("America/Denver"), "America/Denver");
  assert.equal(resolveTimezone("Not/AZone"), FALLBACK_TIMEZONE);
  assert.equal(resolveTimezone(null), FALLBACK_TIMEZONE);
  assert.equal(resolveTimezone(undefined), FALLBACK_TIMEZONE);
});

test("fallback stays Asia/Kolkata so the Indian default is unchanged", () => {
  assert.equal(FALLBACK_TIMEZONE, "Asia/Kolkata");
});
```

- [ ] **Step 2: Register the module for the test compile**

In `tsconfig.functions-test.json`, add `"src/lib/local-date.ts"` to `include`, immediately after `"src/lib/atman-schema.ts"`.

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm run test:functions`
Expected: FAIL — `Cannot find module '../../../src/lib/local-date.js'`

- [ ] **Step 4: Write the implementation**

```ts
// src/lib/local-date.ts
/**
 * Local calendar-day helpers.
 *
 * `new Date().toISOString().split("T")[0]` is the UTC date, not the user's
 * date. In IST (UTC+5:30) the two disagree only between 00:00 and 05:30
 * local, so the bug was invisible in the Indian market. In US Pacific
 * (UTC-7) they disagree from ~17:00 local onward — the whole evening — so
 * "today's" horoscope, tarot, panchang and streaks all rolled a day early.
 *
 * Everything here is pure and takes an explicit `at` so it is testable
 * without freezing the clock.
 */

/** India stays the default market; internationalization is additive. */
export const FALLBACK_TIMEZONE = "Asia/Kolkata";

/** Matches the YYYY-MM-DD keys used for Firestore cache documents. */
export const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidTimezone(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0) return false;
  try {
    // Throws RangeError on an unknown IANA zone.
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export function resolveTimezone(candidate?: string | null): string {
  return isValidTimezone(candidate) ? candidate : FALLBACK_TIMEZONE;
}

/**
 * The local calendar day as YYYY-MM-DD. "en-CA" is used because its short
 * date format is already ISO-ordered and zero-padded, which avoids
 * hand-assembling parts.
 */
export function localDateKey(timezone: string, at: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: resolveTimezone(timezone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

/** Local wall-clock hour, 0-23. `hourCycle: "h23"` keeps midnight at 0. */
export function localHour(timezone: string, at: Date = new Date()): number {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: resolveTimezone(timezone),
    hour: "2-digit",
    hourCycle: "h23",
  }).format(at);
  return Number(hour);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm run test:functions`
Expected: PASS — all 8 `local-date` tests.

- [ ] **Step 6: Commit**

```bash
git add src/lib/local-date.ts netlify/functions/__tests__/local-date.test.ts tsconfig.functions-test.json
git commit -m "feat(i18n): add timezone-aware local calendar-day helpers"
```

### Task 2: Capture the user's timezone at onboarding

**Files:**

- Modify: `src/pages/Onboarding.tsx`
- Modify: `src/types/user.ts:211`

**Interfaces:**

- Consumes: `resolveTimezone` from Task 1
- Produces: `profile.timezone` populated on every new profile write

- [ ] **Step 1: Read the current profile write**

Read `src/pages/Onboarding.tsx:200-270` — the `profilePayload` construction. Note that `coordinates` is conditionally set and `deleteField()`-ed when the birth place changes; `timezone` follows the same write path but is unconditional.

- [ ] **Step 2: Add the import**

```ts
import { resolveTimezone } from "../lib/local-date";
```

- [ ] **Step 3: Populate timezone in the profile payload**

In the `profilePayload` object, add:

```ts
// The browser's zone is the user's *current* zone, which is what "today"
// means for horoscopes, streaks and panchang. Birth-chart timezone is a
// separate concern and is resolved upstream from birth coordinates.
timezone: resolveTimezone(
  typeof Intl !== "undefined"
    ? Intl.DateTimeFormat().resolvedOptions().timeZone
    : undefined,
),
```

- [ ] **Step 4: Do the same for the guest path**

In the guest branch (`src/pages/Onboarding.tsx:294` area, the sessionStorage/localStorage write), include the same `timezone` field so a guest who later signs up carries their zone through migration.

- [ ] **Step 5: Document the field**

In `src/types/user.ts`, replace the bare `timezone?: string;` line with:

```ts
    /**
     * IANA zone of the user's *current* location (e.g. "America/Denver"),
     * captured at onboarding. Drives every "today" boundary: horoscopes,
     * panchang, tarot, streaks, journal. Defaults to Asia/Kolkata when
     * absent — see src/lib/local-date.ts.
     */
    timezone?: string;
```

- [ ] **Step 6: Verify types**

Run: `pnpm run test:types`
Expected: PASS, no errors.

- [ ] **Step 7: Commit**

```bash
git add src/pages/Onboarding.tsx src/types/user.ts
git commit -m "feat(i18n): capture the user's IANA timezone at onboarding"
```

### Task 3: Fix the Panchang card's hardcoded New Delhi

**Files:**

- Modify: `src/hooks/usePanchang.ts:27-29`
- Modify: `src/components/dashboard/PanchangCard.tsx:20-21`
- Modify: `src/pages/Dashboard.tsx:251`

**Interfaces:**

- Produces: `PanchangCard` accepts `{ panchang, loading, error }` props

`PanchangCard` calls `usePanchang()` with no arguments, so it always renders Delhi sunrise, sunset and Rahu Kaal. `Dashboard` _already_ fetches a location-aware panchang at line 111 and throws it away for the card. Fixing this also removes a duplicate paid API call per dashboard load.

- [ ] **Step 1: Remove the New Delhi default from the hook**

In `src/hooks/usePanchang.ts`, replace the body of the `postJson` payload:

```ts
const response = await postJson(
  "/api/kundali",
  {
    chartType: "PANCHANG",
    // No Delhi fallback: panchang is location-specific (sunrise,
    // sunset, rahu kaal). A wrong location is worse than none —
    // Delhi values are 10.5h off for a US user. The server
    // defaults only when these are absent.
    ...(city ? { city } : {}),
    ...(lat !== undefined && lng !== undefined ? { lat, lng } : {}),
    localDate: localDateKey(resolveTimezone(timezone)),
  },
  { signal: controller.signal },
);
```

Widen the signature and imports:

```ts
import { localDateKey, resolveTimezone } from "../lib/local-date";

export function usePanchang(
  city?: string,
  lat?: number,
  lng?: number,
  timezone?: string,
) {
```

Add `timezone` to the effect dependency array: `}, [city, lat, lng, timezone]);`

- [ ] **Step 2: Convert `PanchangCard` to a presentational component**

In `src/components/dashboard/PanchangCard.tsx`, delete the `usePanchang` import and the `const { panchang, loading, error } = usePanchang();` line. Replace the component signature:

```ts
import type { PanchangData } from "../../hooks/usePanchang";

interface PanchangCardProps {
    panchang: PanchangData | null;
    loading: boolean;
    error: string | null;
}

export const PanchangCard: React.FC<PanchangCardProps> = ({ panchang, loading, error }) => {
```

- [ ] **Step 3: Pass the location-aware data down**

In `src/pages/Dashboard.tsx`, change the `usePanchang` call at line 111 to include the timezone, and the render at line 251 to pass props:

```tsx
  } = usePanchang(
    profile?.pob,
    profile?.coordinates?.lat,
    profile?.coordinates?.lng,
    profile?.timezone,
  );
```

```tsx
<PanchangCard
  panchang={panchang}
  loading={panchangLoading}
  error={panchangError}
/>
```

- [ ] **Step 4: Verify types**

Run: `pnpm run test:types`
Expected: PASS. If it fails on `PanchangCard` used elsewhere, `grep -rn "PanchangCard" src/` and pass the same three props at each site.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/usePanchang.ts src/components/dashboard/PanchangCard.tsx src/pages/Dashboard.tsx
git commit -m "fix(panchang): use the user's location instead of hardcoded New Delhi"
```

### Task 4: Remove the Mumbai fallback in Compatibility

**Files:**

- Modify: `src/pages/Compatibility.tsx:189`

Casting the user's own chart in Mumbai when their birth place is missing produces a confidently wrong reading.

- [ ] **Step 1: Replace the fallback with a guard**

Delete `pob: birthData.pob || "Mumbai, India",` and use `pob: birthData.pob,`. Then, at the top of the submit handler (before `setIsMatching(true)`), add:

```ts
if (!birthData.pob) {
  setError(
    "Add your birth place in Settings before running a compatibility match — " +
      "an accurate chart needs the birth location, and guessing it would " +
      "produce a confidently wrong reading.",
  );
  return;
}
```

- [ ] **Step 2: Verify no other India fallbacks remain**

Run: `grep -rniE "\|\| \"(Mumbai|New Delhi|Delhi)" src/ netlify/`
Expected: only the deliberate server-side panchang default in `astro-api.ts:656-658` (documented as the shared-cache default), and the SEO page defaults in `PanchangSeo.tsx` / `MuhuratSeo.tsx`, which are public marketing pages for an Indian keyword and are correct as-is.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Compatibility.tsx
git commit -m "fix(compatibility): stop silently casting the user's chart in Mumbai"
```

### Task 5: Classify DST-ambiguous birth times

**Files:**

- Modify: `netlify/functions/shared/astro-api.ts`
- Modify: `netlify/functions/kundali.ts:417-421`
- Test: `netlify/functions/__tests__/astro-error-classify.test.ts`

**Interfaces:**

- Produces: `classifyUpstreamChartError(status: number, body: string): "dst_ambiguous" | "location_unresolved" | "unknown"`

Verified against the live API: a Denver birth at `2020-11-01 01:30` (the repeated fall-back hour) and `2020-03-08 02:30` (the nonexistent spring-forward hour) both return HTTP 422 `CHART_CALCULATION_ERROR`. Today both surface as _"Astrology request failed. Please try again."_ — a permanent dead end, because retrying never helps. This is impossible in India, which has never observed DST.

- [ ] **Step 1: Write the failing test**

```ts
// netlify/functions/__tests__/astro-error-classify.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { classifyUpstreamChartError } from "../shared/astro-error-classify.js";

// Real 422 body shape observed from astrology-api.io for a birth time that
// falls in the DST spring-forward gap.
const DST_422 = JSON.stringify({
  detail: {
    success: false,
    error: {
      error_code: "CHART_CALCULATION_ERROR",
      message: "Failed to calculate astrological chart",
      field: "birth_data",
    },
  },
});

const LOCATION_422 = JSON.stringify({
  detail: [
    {
      type: "value_error",
      loc: ["body", "subject", "birth_data"],
      msg: "Value error, Location is required. Provide either: (1) 'city' ...",
    },
  ],
});

test("classifies a chart-calculation 422 as DST-ambiguous", () => {
  assert.equal(classifyUpstreamChartError(422, DST_422), "dst_ambiguous");
});

test("classifies a missing-location 422 separately", () => {
  assert.equal(
    classifyUpstreamChartError(422, LOCATION_422),
    "location_unresolved",
  );
});

test("does not classify non-422 failures", () => {
  assert.equal(classifyUpstreamChartError(500, DST_422), "unknown");
  assert.equal(classifyUpstreamChartError(401, "nope"), "unknown");
});

test("tolerates an unparseable body", () => {
  assert.equal(classifyUpstreamChartError(422, "<html>502</html>"), "unknown");
  assert.equal(classifyUpstreamChartError(422, ""), "unknown");
});
```

- [ ] **Step 2: Register for the test compile**

Add `"netlify/functions/shared/astro-error-classify.ts"` to `include` in `tsconfig.functions-test.json`.

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm run test:functions`
Expected: FAIL — cannot find module `astro-error-classify.js`.

- [ ] **Step 4: Write the implementation**

```ts
// netlify/functions/shared/astro-error-classify.ts
/**
 * Upstream chart failures worth telling the user apart.
 *
 * `dst_ambiguous` is the one that matters internationally: a local birth
 * time that either never existed (spring-forward gap) or happened twice
 * (fall-back hour) makes the upstream ephemeris reject the request with a
 * 422. Retrying can never succeed, so the generic "please try again"
 * message is a dead end. India has never observed DST, so this class of
 * failure is unreachable for Indian births.
 */
export type UpstreamChartErrorKind =
  "dst_ambiguous" | "location_unresolved" | "unknown";

export function classifyUpstreamChartError(
  status: number,
  body: string,
): UpstreamChartErrorKind {
  if (status !== 422) return "unknown";

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return "unknown";
  }

  const detail = (parsed as { detail?: unknown } | null)?.detail;

  // Pydantic validation errors arrive as an array of issues.
  if (Array.isArray(detail)) {
    const joined = detail
      .map((issue) => String((issue as { msg?: unknown })?.msg ?? ""))
      .join(" ");
    return /location is required/i.test(joined)
      ? "location_unresolved"
      : "unknown";
  }

  const code = (detail as { error?: { error_code?: unknown } } | null)?.error
    ?.error_code;
  return code === "CHART_CALCULATION_ERROR" ? "dst_ambiguous" : "unknown";
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm run test:functions`
Expected: PASS — 4 `astro-error-classify` tests.

- [ ] **Step 6: Throw a typed error from the API wrapper**

In `netlify/functions/shared/astro-api.ts`, add near the other internals (after `apiFetch`):

```ts
import {
  classifyUpstreamChartError,
  type UpstreamChartErrorKind,
} from "./astro-error-classify.js";

export class AstroChartError extends Error {
  constructor(
    message: string,
    readonly kind: UpstreamChartErrorKind,
    readonly status: number,
  ) {
    super(message);
    this.name = "AstroChartError";
    Object.setPrototypeOf(this, AstroChartError.prototype);
  }
}

/** Throw a classified error for a failed chart response. */
export async function throwChartError(
  res: Response,
  label: string,
): Promise<never> {
  const body = await res.text();
  throw new AstroChartError(
    `${label} error: ${res.status} - ${body}`,
    classifyUpstreamChartError(res.status, body),
    res.status,
  );
}
```

Then in `getNatalChart` and `getNavamsaChart`, replace the existing
`if (!res.ok) throw new Error(...)` with `if (!res.ok) await throwChartError(res, "Natal chart");` (and `"Divisional chart"` respectively).

- [ ] **Step 7: Surface a specific message from the endpoint**

In `netlify/functions/kundali.ts`, replace the catch block at lines 417-421:

```ts
  } catch (error: any) {
    console.error("[Kundali] Error:", error);

    // A DST-ambiguous or nonexistent local birth time can never succeed on
    // retry, so it must not get the generic "please try again" message.
    if (error?.name === "AstroChartError" && error.kind === "dst_ambiguous") {
      return json(
        {
          error:
            "That birth time doesn't map to a single moment in your birth " +
            "city — it either never occurred or occurred twice when the " +
            "clocks changed for daylight saving. Please confirm the time " +
            "on your birth record; if it's correct, nudge it by one hour.",
          code: "dst_ambiguous",
        },
        422,
      );
    }

    // Generic message — never leak upstream/Firestore internals to the client.
    return json({ error: "Astrology request failed. Please try again." }, 500);
  }
```

**No import is needed in `kundali.ts`.** The guard above matches on `error?.name === "AstroChartError"` rather than `instanceof`, deliberately: `AstroChartError` is declared in `astro-api.ts`, and a name check keeps the guard working even if the class identity differs across bundles. Do not add an `instanceof` check — it can silently evaluate false and send the user back to the generic retry message.

- [ ] **Step 8: Run the full suite**

Run: `pnpm run test`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add netlify/functions/shared/astro-error-classify.ts netlify/functions/shared/astro-api.ts netlify/functions/kundali.ts netlify/functions/__tests__/astro-error-classify.test.ts tsconfig.functions-test.json
git commit -m "fix(charts): explain DST-ambiguous birth times instead of a generic retry"
```

### Task 6: Replace the 43 UTC "today" call sites

**Files:**

- Modify: all files listed by the grep below

This is mechanical but must be done per-site, because "today" means different things in different layers: client sites use the user's zone, shared-cache server sites must key by the _requested_ local date, and download filenames can stay UTC.

- [ ] **Step 1: Enumerate the sites**

Run: `grep -rn "toISOString().split(\"T\")\[0\]\|toISOString().split('T')\[0\]" --include="*.ts" --include="*.tsx" src netlify | grep -v __tests__`
Expected: 43 lines.

- [ ] **Step 2: Classify each site**

Write the list into three buckets:

- **Client "today"** — must use the user's zone. `FestivalCard.tsx:33`, `DailyAltar.tsx:32`, `useProactiveTriggers.ts:54,98,119`, `useTransit.ts:50`, `atman.ts:545,564`, `Reports.tsx:156`, `DailyForecast.tsx:98,167,798`, `PanchangSeo.tsx:14`, `MuhuratSeo.tsx:14`.
- **Server cache key** — must use the client-supplied `localDate`. `kundali.ts:247,272`, `sign-horoscope.ts:132`, `daily-prediction.ts:81`, `horoscope.ts:86`, `transit.ts:64,75`, `compatibility.ts:60`, `pdf-report.ts:88`.
- **Cosmetic only** — leave as-is, but add a trailing comment `// UTC is fine: filename only`. `Dashboard.tsx:182`, `Compatibility.tsx:240`.

- [ ] **Step 3: Convert the client sites**

For each client site, import and substitute. Example for `src/components/sadhana/DailyAltar.tsx:32`:

```ts
import { localDateKey, resolveTimezone } from "../../lib/local-date";
// ...
const today = localDateKey(resolveTimezone(profile?.timezone));
```

Where the component has no profile in scope, thread `timezone` in as a prop from the nearest ancestor that does, rather than reaching for `Intl` directly — a stored profile zone must win over the current device zone so a travelling user's streaks don't break.

- [ ] **Step 4: Convert the server sites to accept `localDate`**

Server functions must not guess the user's zone. Each already receives a JSON body, so accept an optional validated `localDate` and fall back to UTC. Add this helper to `netlify/functions/shared/request-date.ts`:

```ts
import { DATE_KEY_RE } from "../../../src/lib/local-date.js";

/**
 * The caller's local calendar day, used for per-day cache keys. Falls back
 * to the UTC date when absent so existing clients keep working.
 */
export function requestedDateKey(value: unknown): string {
  return typeof value === "string" && DATE_KEY_RE.test(value)
    ? value
    : new Date().toISOString().split("T")[0];
}
```

Add `"netlify/functions/shared/request-date.ts"` to `tsconfig.functions-test.json`. Then at each server site replace `new Date().toISOString().split("T")[0]` with `requestedDateKey(payload.localDate)` (using whatever the parsed body variable is named in that file).

- [ ] **Step 5: Send `localDate` from the client fetchers**

In each hook/page that posts to those endpoints (`useTransit.ts`, `useDailyPrediction.ts`, `usePanchang.ts` — already done in Task 3 — `DailyForecast.tsx`, `Reports.tsx`, `Compatibility.tsx`), add `localDate: localDateKey(resolveTimezone(profile?.timezone))` to the request body.

- [ ] **Step 6: Confirm nothing was missed**

Run: `grep -rn "toISOString().split" --include="*.ts" --include="*.tsx" src netlify | grep -v __tests__ | grep -v "filename only" | grep -v request-date.ts`
Expected: no output.

- [ ] **Step 7: Run the full suite**

Run: `pnpm run test`
Expected: PASS.

- [ ] **Step 8: Commit**

**Never `git add -A` in this repo.** Stage only the files this task touched, by
explicit path — an unrelated concurrent change in the working tree would
otherwise be swallowed into this commit.

```bash
git add src/lib/local-date.ts netlify/functions/shared/request-date.ts \
  src/hooks/ src/components/sadhana/DailyAltar.tsx \
  src/components/dashboard/FestivalCard.tsx src/lib/atman.ts \
  src/pages/Reports.tsx src/pages/DailyForecast.tsx \
  src/pages/PanchangSeo.tsx src/pages/MuhuratSeo.tsx \
  netlify/functions/kundali.ts netlify/functions/sign-horoscope.ts \
  netlify/functions/daily-prediction.ts netlify/functions/horoscope.ts \
  netlify/functions/transit.ts netlify/functions/compatibility.ts \
  netlify/functions/pdf-report.ts tsconfig.functions-test.json
git commit -m "fix(i18n): compute 'today' in the user's timezone, not UTC"
```

---

# Phase 2 — Zodiac Mode

**Defect:** Charts are sidereal Lahiri everywhere (`zodiac_type: "Sidereal"` in 9 places), but the daily forecast derives its sign from a _tropical_ date table ([useDailyPrediction.ts:11-27](../../../src/hooks/useDailyPrediction.ts)). For a 1990-07-15 birth the sidereal Sun is Gemini 29.5° while the tropical sign is Cancer — the app contradicts itself. A US user who has been "a Cancer" for thirty years sees Gemini and concludes the app is broken.

Also removed here: the dead `country_code` heuristic at `useDailyPrediction.ts:57`, which derives a country code as `pobParts[1].substring(0,2)` — turning "New York, New York, United States" into `NE` (Niger) and London into `GR` (Greece). Verified: upstream resolves `New York` + `NE` to **Niamey, Niger**. It is currently harmless only because `daily-prediction.ts` discards the client's `subject` entirely. It is a live landmine and the adjacent `=== "KA" ? "IN"` patch shows it was only ever fixed for India.

### Task 7: `zodiac-mode` module

**Files:**

- Create: `src/lib/zodiac-mode.ts`
- Test: `netlify/functions/__tests__/zodiac-mode.test.ts`
- Modify: `tsconfig.functions-test.json`

**Interfaces:**

- Produces: `type ZodiacMode = "vedic" | "western"`, `normalizeZodiacMode(value: unknown): ZodiacMode`, `zodiacApiOptions(mode: ZodiacMode): { house_system: string; zodiac_type: string }`, `ZODIAC_MODES: readonly ZodiacModeMeta[]`, `DEFAULT_ZODIAC_MODE: ZodiacMode`

- [ ] **Step 1: Write the failing test**

```ts
// netlify/functions/__tests__/zodiac-mode.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeZodiacMode,
  zodiacApiOptions,
  ZODIAC_MODES,
  DEFAULT_ZODIAC_MODE,
} from "../../../src/lib/zodiac-mode.js";

test("vedic is the default so the Indian market is unchanged", () => {
  assert.equal(DEFAULT_ZODIAC_MODE, "vedic");
  assert.equal(normalizeZodiacMode(undefined), "vedic");
  assert.equal(normalizeZodiacMode(null), "vedic");
  assert.equal(normalizeZodiacMode("nonsense"), "vedic");
  assert.equal(normalizeZodiacMode(7), "vedic");
});

test("normalizeZodiacMode accepts both modes", () => {
  assert.equal(normalizeZodiacMode("vedic"), "vedic");
  assert.equal(normalizeZodiacMode("western"), "western");
});

test("vedic maps to sidereal whole-sign, matching today's behaviour", () => {
  assert.deepEqual(zodiacApiOptions("vedic"), {
    house_system: "W",
    zodiac_type: "Sidereal",
  });
});

test("western maps to tropical Placidus", () => {
  assert.deepEqual(zodiacApiOptions("western"), {
    house_system: "P",
    zodiac_type: "Tropic",
  });
});

test("every mode has UI metadata and a distinct label", () => {
  assert.equal(ZODIAC_MODES.length, 2);
  const labels = new Set(ZODIAC_MODES.map((m) => m.label));
  assert.equal(labels.size, 2);
  for (const mode of ZODIAC_MODES) {
    assert.equal(normalizeZodiacMode(mode.mode), mode.mode);
    assert.ok(mode.label.length > 0);
    assert.ok(mode.description.length > 0);
  }
});
```

- [ ] **Step 2: Register the module**

Add `"src/lib/zodiac-mode.ts"` to `include` in `tsconfig.functions-test.json`.

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm run test:functions`
Expected: FAIL — cannot find module `zodiac-mode.js`.

- [ ] **Step 4: Write the implementation**

```ts
// src/lib/zodiac-mode.ts
/**
 * Which zodiac the app calculates in.
 *
 * Jyotish uses the sidereal zodiac (Lahiri ayanamsa), which currently sits
 * ~24 degrees from the tropical zodiac used by Western astrology. The
 * practical consequence is that most people's Sun sign differs by one sign
 * between the two systems. Indian users expect the sidereal answer;
 * Western users have known their tropical sign their whole life, so
 * showing them the sidereal one without explanation reads as a bug.
 */
export type ZodiacMode = "vedic" | "western";

export const DEFAULT_ZODIAC_MODE: ZodiacMode = "vedic";

export interface ZodiacModeMeta {
  mode: ZodiacMode;
  label: string;
  description: string;
}

export const ZODIAC_MODES: readonly ZodiacModeMeta[] = [
  {
    mode: "vedic",
    label: "Vedic (sidereal)",
    description:
      "Jyotish, aligned to the visible constellations using the Lahiri ayanamsa. Uses whole-sign houses, Nakshatras and Dashas.",
  },
  {
    mode: "western",
    label: "Western (tropical)",
    description:
      "Aligned to the equinoxes with Placidus houses — the system behind the Sun sign you already know.",
  },
];

export function normalizeZodiacMode(value: unknown): ZodiacMode {
  return value === "western" || value === "vedic" ? value : DEFAULT_ZODIAC_MODE;
}

/**
 * The astrology-api.io options pair for a mode. "W" is whole-sign (equal)
 * houses, "P" is Placidus.
 */
export function zodiacApiOptions(mode: ZodiacMode): {
  house_system: string;
  zodiac_type: string;
} {
  return mode === "western"
    ? { house_system: "P", zodiac_type: "Tropic" }
    : { house_system: "W", zodiac_type: "Sidereal" };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm run test:functions`
Expected: PASS — 5 `zodiac-mode` tests.

- [ ] **Step 6: Commit**

```bash
git add src/lib/zodiac-mode.ts netlify/functions/__tests__/zodiac-mode.test.ts tsconfig.functions-test.json
git commit -m "feat(zodiac): add a Vedic/Western zodiac mode module"
```

### Task 8: Thread the mode through `astro-api.ts`

**Files:**

- Modify: `netlify/functions/shared/astro-api.ts:200-215, 495-510, 1130-1250`

**Interfaces:**

- Consumes: `zodiacApiOptions`, `normalizeZodiacMode`, `ZodiacMode` from Task 7
- Produces: every exported chart function takes an optional trailing `mode: ZodiacMode = "vedic"`

- [ ] **Step 1: Import the module**

```ts
import {
  zodiacApiOptions,
  DEFAULT_ZODIAC_MODE,
  type ZodiacMode,
} from "../../../src/lib/zodiac-mode.js";
```

- [ ] **Step 2: Make `parseBirthData` mode-aware**

```ts
/** Chart-request payload with subject + zodiac options. */
function parseBirthData(
  birthData: BirthData,
  mode: ZodiacMode = DEFAULT_ZODIAC_MODE,
) {
  return {
    subject: buildSubject(birthData),
    options: {
      ...zodiacApiOptions(mode),
      active_points: [
        "Sun",
        "Moon",
        "Mercury",
        "Venus",
        "Mars",
        "Jupiter",
        "Saturn",
        "Mean_Node",
        "Mean_South_Node",
        "Ascendant",
      ],
      precision: 2,
    },
  };
}
```

- [ ] **Step 3: Update the remaining 8 hardcoded options blocks**

Run: `grep -n "zodiac_type" netlify/functions/shared/astro-api.ts`

For each of lines ~503, 1134, 1154, 1173, 1190, 1210, 1240, 1245, replace the inline
`options: { house_system: "W", zodiac_type: "Sidereal", precision: 2 }` with
`options: { ...zodiacApiOptions(mode), precision: 2 }` and add `mode: ZodiacMode = DEFAULT_ZODIAC_MODE` as the last parameter of the enclosing exported function. For the two sites that also pass `language: "en"`, keep it: `options: { ...zodiacApiOptions(mode), language: "en" }`.

- [ ] **Step 4: Verify nothing hardcodes the zodiac any more**

Run: `grep -n "\"Sidereal\"\|\"Tropic\"" netlify/functions/shared/astro-api.ts`
Expected: no output — all of them now come from `zodiacApiOptions`.

- [ ] **Step 5: Verify types**

Run: `pnpm run test:types`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add netlify/functions/shared/astro-api.ts
git commit -m "refactor(astro-api): derive zodiac options from the requested mode"
```

### Task 9: Accept the mode at `/api/kundali` and key the cache by it

**Files:**

- Modify: `netlify/functions/kundali.ts`
- Modify: `netlify/functions/__tests__/kundali-cache-identity.test.ts`

**This is the highest-risk task in the phase.** Charts are cached in Firestore per user. If the cache key does not include the mode, a user who switches to Western keeps being served their cached sidereal chart — a silent wrong answer that looks like the toggle is broken.

- [ ] **Step 1: Read the existing cache-identity test**

Read `netlify/functions/__tests__/kundali-cache-identity.test.ts` in full, and the cache-key construction in `netlify/functions/kundali.ts`. Note the existing identity inputs so the new one is added consistently rather than replacing them.

- [ ] **Step 2: Write the failing test**

Add to `netlify/functions/__tests__/kundali-cache-identity.test.ts`, matching the file's existing import and helper style:

```ts
test("zodiac mode is part of the cache identity", () => {
  const vedic = buildCacheIdentity({ ...BASE_INPUT, zodiacMode: "vedic" });
  const western = buildCacheIdentity({ ...BASE_INPUT, zodiacMode: "western" });
  assert.notEqual(
    vedic,
    western,
    "a mode switch must miss the cache, or the user keeps their old chart",
  );
});

test("an absent zodiac mode is identical to an explicit vedic mode", () => {
  assert.equal(
    buildCacheIdentity({ ...BASE_INPUT }),
    buildCacheIdentity({ ...BASE_INPUT, zodiacMode: "vedic" }),
    "existing cached documents must stay valid for the default mode",
  );
});
```

Adapt `buildCacheIdentity` / `BASE_INPUT` to whatever the file already exports and uses.

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm run test:functions`
Expected: FAIL — the two identities are equal.

- [ ] **Step 4: Implement**

In `netlify/functions/kundali.ts`: read `zodiacMode` from the body via `normalizeZodiacMode(body.zodiacMode)`, pass it to each `astro-api` call, and append it to the cache identity — but only when it is not the default, so existing cached documents stay valid:

```ts
const zodiacMode = normalizeZodiacMode(body.zodiacMode);
// Existing cache documents were all sidereal, so the default mode must
// produce the identical key it produced before this change.
const modeSuffix = zodiacMode === DEFAULT_ZODIAC_MODE ? "" : `_${zodiacMode}`;
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm run test:functions`
Expected: PASS, including the pre-existing cache-identity tests.

- [ ] **Step 6: Commit**

```bash
git add netlify/functions/kundali.ts netlify/functions/__tests__/kundali-cache-identity.test.ts
git commit -m "feat(kundali): accept a zodiac mode and include it in the cache identity"
```

### Task 10: Make the daily forecast consistent, and delete the dead heuristic

**Files:**

- Modify: `src/hooks/useDailyPrediction.ts`
- Modify: `netlify/functions/daily-prediction.ts`

- [ ] **Step 1: Delete the dead payload**

In `src/hooks/useDailyPrediction.ts`, delete the entire `subject` and `options` blocks from the request body — including the `countryCode` derivation at line 57 and its `=== "KA" ? "IN"` patch. `daily-prediction.ts` never reads them (it re-casts from `SIGN_ANCHOR_DOB`), so this is dead code that only encodes a bug.

- [ ] **Step 2: Take the sign from the chart, not a date table**

Replace the local `getZodiacSign` fallback with the sign already computed for the active mode. The hook's `userData` carries `sunSign` (written from the chart); pass the mode through and only fall back to the date table in `western` mode, where a tropical date table is actually correct:

```ts
// In vedic mode the sign MUST come from the sidereal chart — the tropical
// date table disagrees with it by roughly one sign, which is what made the
// dashboard and the forecast contradict each other.
const zodiacSign =
  sunSign ||
  (normalizeZodiacMode(zodiacMode) === "western"
    ? getZodiacSign(day, month)
    : null);
if (!zodiacSign) return; // wait for the chart rather than guess
```

- [ ] **Step 3: Add the explainer copy**

In `src/pages/Settings.tsx`, beside the new mode picker (Task 11), render the `description` from `ZODIAC_MODES` plus this note:

> Switching systems changes your Sun sign by about one sign. Both are internally consistent — they measure from different starting points, not different skies.

- [ ] **Step 4: Verify types and run the suite**

Run: `pnpm run test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useDailyPrediction.ts netlify/functions/daily-prediction.ts
git commit -m "fix(forecast): derive the sign from the active zodiac mode's chart"
```

### Task 11: Mode picker in Settings and Onboarding

**Files:**

- Modify: `src/pages/Settings.tsx`
- Modify: `src/pages/Onboarding.tsx`
- Modify: `src/types/user.ts`

- [ ] **Step 1: Add the profile field**

In `src/types/user.ts`, in the Settings block beside `language`:

```ts
    /** Which zodiac to calculate in. Defaults to "vedic". */
    zodiacMode?: ZodiacMode;
```

with `import type { ZodiacMode } from "../lib/zodiac-mode";` at the top.

- [ ] **Step 2: Render the picker in Settings**

Follow the existing language-picker markup in `src/pages/Settings.tsx` (it maps `PLATFORM_LANGUAGES`). Map `ZODIAC_MODES` the same way, writing `zodiacMode` to the profile on select, and render each mode's `description` beneath.

- [ ] **Step 3: Offer the choice during onboarding**

Add the same picker as an optional step in `src/pages/Onboarding.tsx`, defaulting to `vedic`, with copy that does not require prior knowledge: _"Which tradition should we read your chart in?"_

- [ ] **Step 4: Pass the mode from every chart hook**

In `src/hooks/useKundali.ts`, `useTransit.ts` and `useDailyPrediction.ts`, add `zodiacMode: normalizeZodiacMode(profile?.zodiacMode)` to the request body and add it to each effect's dependency array so switching modes refetches.

- [ ] **Step 5: Run the suite**

Run: `pnpm run test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Settings.tsx src/pages/Onboarding.tsx src/types/user.ts src/hooks/
git commit -m "feat(zodiac): let users choose Vedic or Western calculation"
```

---

# Phase 3 — Multi-Currency and Razorpay USD

**Defect:** `currency: "INR"` is pinned at the _type_ level in [razorpay-payments.ts:21,26](../../../netlify/functions/shared/razorpay-payments.ts), prices are hardcoded (`amountInRupees` in `credit-packs.ts`, `monthlyPriceInr` in `entitlements.ts`, ₹199–799 in `remedy-products.ts`), and `₹` is written directly into the UI. A US user cannot pay at all.

**Note on the chosen approach:** USD via Razorpay requires international payments to be activated on the Razorpay account, and Razorpay handles US-domestic cards less well than a US-native processor. This was raised and the decision was to proceed with Razorpay. The currency layer below is therefore kept processor-agnostic — `src/lib/currency.ts` has no Razorpay dependency — so a second processor can be added later without redoing the pricing model.

### Task 12: `currency` module

**Files:**

- Create: `src/lib/currency.ts`
- Test: `netlify/functions/__tests__/currency.test.ts`
- Modify: `tsconfig.functions-test.json`

**Interfaces:**

- Produces: `type Currency = "INR" | "USD"`, `normalizeCurrency(value: unknown): Currency`, `toMinorUnits(amount: number, currency: Currency): number`, `formatMoney(amount: number, currency: Currency, locale?: string): string`, `detectCurrency(locale?: string | null, timezone?: string | null): Currency`, `SUPPORTED_CURRENCIES`, `DEFAULT_CURRENCY`

- [ ] **Step 1: Write the failing test**

```ts
// netlify/functions/__tests__/currency.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeCurrency,
  toMinorUnits,
  formatMoney,
  detectCurrency,
  SUPPORTED_CURRENCIES,
  DEFAULT_CURRENCY,
} from "../../../src/lib/currency.js";

test("INR stays the default currency", () => {
  assert.equal(DEFAULT_CURRENCY, "INR");
  assert.equal(normalizeCurrency(undefined), "INR");
  assert.equal(normalizeCurrency("EUR"), "INR"); // unsupported -> default
  assert.equal(normalizeCurrency(null), "INR");
});

test("normalizeCurrency accepts supported codes case-insensitively", () => {
  assert.equal(normalizeCurrency("USD"), "USD");
  assert.equal(normalizeCurrency("usd"), "USD");
  assert.equal(normalizeCurrency("inr"), "INR");
});

test("both supported currencies use 100 minor units", () => {
  assert.equal(toMinorUnits(499, "INR"), 49900);
  assert.equal(toMinorUnits(9.99, "USD"), 999);
});

test("toMinorUnits rounds rather than truncating float error", () => {
  // 19.99 * 100 is 1998.9999999999998 in IEEE-754.
  assert.equal(toMinorUnits(19.99, "USD"), 1999);
  assert.equal(toMinorUnits(0.1 + 0.2, "USD"), 30);
});

test("toMinorUnits rejects negative and non-finite amounts", () => {
  assert.throws(() => toMinorUnits(-1, "USD"));
  assert.throws(() => toMinorUnits(Number.NaN, "USD"));
  assert.throws(() => toMinorUnits(Number.POSITIVE_INFINITY, "INR"));
});

test("formatMoney emits the right symbol for each currency", () => {
  assert.match(formatMoney(499, "INR", "en-IN"), /₹/);
  assert.match(formatMoney(9.99, "USD", "en-US"), /\$/);
});

test("formatMoney shows no decimals for whole amounts", () => {
  assert.equal(formatMoney(499, "INR", "en-IN").includes(".00"), false);
  assert.equal(formatMoney(10, "USD", "en-US").includes(".00"), false);
});

test("formatMoney keeps cents when they are significant", () => {
  assert.match(formatMoney(9.99, "USD", "en-US"), /9\.99/);
});

test("detectCurrency picks USD for US locales and INR for Indian ones", () => {
  assert.equal(detectCurrency("en-US"), "USD");
  assert.equal(detectCurrency("en-IN"), "INR");
  assert.equal(detectCurrency("hi-IN"), "INR");
});

test("detectCurrency falls back to the timezone when the locale is bare", () => {
  assert.equal(detectCurrency("en", "America/Denver"), "USD");
  assert.equal(detectCurrency("en", "Asia/Kolkata"), "INR");
});

test("detectCurrency defaults to INR for anything unrecognised", () => {
  assert.equal(detectCurrency(null, null), "INR");
  assert.equal(detectCurrency("fr-FR", "Europe/Paris"), "INR");
});

test("every supported currency round-trips through normalizeCurrency", () => {
  for (const code of SUPPORTED_CURRENCIES) {
    assert.equal(normalizeCurrency(code), code);
  }
});
```

- [ ] **Step 2: Register the module**

Add `"src/lib/currency.ts"` to `include` in `tsconfig.functions-test.json`.

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm run test:functions`
Expected: FAIL — cannot find module `currency.js`.

- [ ] **Step 4: Write the implementation**

```ts
// src/lib/currency.ts
/**
 * Currency model. Deliberately free of any payment-processor types so a
 * second processor can be added without touching the pricing model.
 */
export const SUPPORTED_CURRENCIES = ["INR", "USD"] as const;
export type Currency = (typeof SUPPORTED_CURRENCIES)[number];

/** India remains the primary market. */
export const DEFAULT_CURRENCY: Currency = "INR";

export function normalizeCurrency(value: unknown): Currency {
  if (typeof value !== "string") return DEFAULT_CURRENCY;
  const upper = value.toUpperCase();
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(upper)
    ? (upper as Currency)
    : DEFAULT_CURRENCY;
}

/**
 * Both supported currencies have 100 minor units (paise, cents), so one
 * factor covers both. Rounds because float multiplication of a decimal
 * price is not exact: 19.99 * 100 === 1998.9999999999998.
 */
export function toMinorUnits(amount: number, _currency: Currency): number {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error(`Invalid money amount: ${amount}`);
  }
  return Math.round(amount * 100);
}

const LOCALE_FOR: Record<Currency, string> = {
  INR: "en-IN",
  USD: "en-US",
};

export function formatMoney(
  amount: number,
  currency: Currency,
  locale?: string,
): string {
  const isWhole = Number.isInteger(amount);
  return new Intl.NumberFormat(locale || LOCALE_FOR[currency], {
    style: "currency",
    currency,
    minimumFractionDigits: isWhole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Best-effort currency for a new user. Locale region wins; timezone is the
 * tiebreaker for bare locales like "en". Anything unrecognised stays INR
 * rather than guessing — a wrong currency is worse than the default.
 */
export function detectCurrency(
  locale?: string | null,
  timezone?: string | null,
): Currency {
  const region = typeof locale === "string" ? locale.split("-")[1] : undefined;
  if (region) {
    if (region.toUpperCase() === "US") return "USD";
    if (region.toUpperCase() === "IN") return "INR";
  }
  if (typeof timezone === "string" && timezone.startsWith("America/")) {
    return "USD";
  }
  return DEFAULT_CURRENCY;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm run test:functions`
Expected: PASS — 12 `currency` tests.

- [ ] **Step 6: Commit**

```bash
git add src/lib/currency.ts netlify/functions/__tests__/currency.test.ts tsconfig.functions-test.json
git commit -m "feat(billing): add a processor-agnostic currency module"
```

### Task 13: Per-currency prices

**Files:**

- Modify: `src/lib/credit-packs.ts`
- Modify: `netlify/functions/shared/entitlements.ts`
- Modify: `netlify/functions/shared/remedy-products.ts`
- Modify: `netlify/functions/__tests__/pricing-model.test.ts`, `entitlements.test.ts`, `remedy-products.test.ts`

- [ ] **Step 1: Read the existing tests first**

Read `netlify/functions/__tests__/pricing-model.test.ts`, `entitlements.test.ts` and `remedy-products.test.ts`. They assert exact rupee figures (e.g. `assert.equal(gemstoneReview.priceInRupees, 199)`), so they define the compatibility contract: **keep the existing `amountInRupees` / `priceInRupees` / `monthlyPriceInr` fields working** and add per-currency amounts alongside.

- [ ] **Step 2: Write the failing test**

Add to `netlify/functions/__tests__/pricing-model.test.ts`:

```ts
import { SUPPORTED_CURRENCIES } from "../../../src/lib/currency.js";
import { CREDIT_PACKS, getPackAmount } from "../../../src/lib/credit-packs.js";

test("every credit pack is priced in every supported currency", () => {
  for (const pack of CREDIT_PACKS) {
    for (const currency of SUPPORTED_CURRENCIES) {
      const amount = getPackAmount(pack, currency);
      assert.equal(typeof amount, "number");
      assert.ok(amount > 0, `${pack.minutes} has no ${currency} price`);
    }
  }
});

test("the INR amount still matches the legacy rupee field", () => {
  for (const pack of CREDIT_PACKS) {
    assert.equal(getPackAmount(pack, "INR"), pack.amountInRupees);
  }
});

test("USD packs keep the same ordering as INR packs", () => {
  const inr = CREDIT_PACKS.map((p) => getPackAmount(p, "INR"));
  const usd = CREDIT_PACKS.map((p) => getPackAmount(p, "USD"));
  const ascending = (xs: number[]) =>
    xs.every((x, i) => i === 0 || x > xs[i - 1]);
  assert.ok(ascending(inr));
  assert.ok(ascending(usd), "a bigger pack must never cost less");
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm run test:functions`
Expected: FAIL — `getPackAmount` is not exported.

- [ ] **Step 4: Implement per-currency amounts**

In `src/lib/credit-packs.ts`, extend the interface and each entry, and add the accessor. USD prices are set for US willingness-to-pay rather than converted from INR — a straight FX conversion of ₹49 would be $0.55, which reads as valueless in the US market:

```ts
import { DEFAULT_CURRENCY, type Currency } from "./currency.js";

export interface CreditPack {
  minutes: number;
  /** @deprecated Use getPackAmount(pack, "INR"). Kept for existing callers. */
  amountInRupees: number;
  amounts: Record<Currency, number>;
  label: string;
  description: string;
  badge?: string;
  recommended?: boolean;
}

export function getPackAmount(pack: CreditPack, currency: Currency): number {
  return pack.amounts[currency] ?? pack.amounts[DEFAULT_CURRENCY];
}
```

Give each of the four packs an `amounts` object: `{ INR: 49, USD: 2.99 }`, `{ INR: 99, USD: 5.99 }`, `{ INR: 249, USD: 14.99 }`, `{ INR: 499, USD: 29.99 }`, keeping `amountInRupees` equal to the INR figure.

Replace `formatCreditRate` to take a currency and use `formatMoney`.

- [ ] **Step 5: Do the same for tiers and remedies**

In `entitlements.ts`, add `monthlyPrices: Record<Currency, number>` to `TierEntitlements` (`free: {INR:0, USD:0}`, `premium: {INR:499, USD:9.99}`, `pro: {INR:999, USD:19.99}`), keeping `monthlyPriceInr`. In `remedy-products.ts`, add the same `prices` map beside `priceInRupees`.

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm run test:functions`
Expected: PASS, including the pre-existing rupee assertions.

- [ ] **Step 7: Commit**

```bash
git add src/lib/credit-packs.ts netlify/functions/shared/entitlements.ts netlify/functions/shared/remedy-products.ts netlify/functions/__tests__/
git commit -m "feat(billing): price credit packs, tiers and remedies in USD as well as INR"
```

### Task 14: Currency-aware Razorpay orders

**Files:**

- Modify: `netlify/functions/shared/razorpay-payments.ts`
- Modify: `netlify/functions/razorpay-order.ts`
- Modify: `netlify/functions/razorpay-verify.ts`, `subscription-webhook.ts`
- Modify: `netlify/functions/__tests__/razorpay-payments.test.ts`

- [ ] **Step 1: Read the existing payment test**

Read `netlify/functions/__tests__/razorpay-payments.test.ts` in full. It pins the current order-building contract; the new currency parameter must default to INR so every existing assertion still holds.

- [ ] **Step 2: Write the failing test**

```ts
test("a USD order is denominated in cents with currency USD", () => {
  const options = buildTopupOrderOptions({
    uid: "u1",
    minutes: 120,
    currency: "USD",
  });
  assert.equal(options.currency, "USD");
  assert.equal(options.amount, 599); // $5.99 -> cents
});

test("an order with no currency stays INR in paise, as before", () => {
  const options = buildTopupOrderOptions({ uid: "u1", minutes: 120 });
  assert.equal(options.currency, "INR");
  assert.equal(options.amount, 9900);
});

test("an amount confirmation is validated against the same currency", () => {
  assert.throws(() =>
    buildTopupOrderOptions({
      uid: "u1",
      minutes: 120,
      currency: "USD",
      expectedAmount: 99, // the INR figure — must not be accepted as USD
    }),
  );
});

test("international USD orders are refused when the flag is off", () => {
  assert.equal(isCurrencyEnabled("INR", {}), true);
  assert.equal(isCurrencyEnabled("USD", {}), false);
  assert.equal(
    isCurrencyEnabled("USD", { RAZORPAY_INTERNATIONAL_ENABLED: "true" }),
    true,
  );
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm run test:functions`
Expected: FAIL — `currency` is not an accepted option; `isCurrencyEnabled` is not exported.

- [ ] **Step 4: Implement**

In `razorpay-payments.ts`: change `currency: "INR"` to `currency: Currency` throughout and compute `amount: toMinorUnits(getPackAmount(pack, currency), currency)`.

**Rename `expectedAmountInRupees` to `expectedAmount`** on the options input (currently declared at `razorpay-payments.ts:54` and used at lines 60-61), and validate it against `getPackAmount(pack, currency)` rather than `product.amountInRupees` — otherwise a USD order would be checked against the rupee figure. Update the one caller, `razorpay-order.ts:47`, to pass `expectedAmount` instead. Then add:

```ts
/**
 * USD charges require international payments to be activated on the
 * Razorpay account. Until then the option must be refused server-side
 * rather than failing at the gateway with an opaque error.
 */
export function isCurrencyEnabled(
  currency: Currency,
  env: Record<string, string | undefined>,
): boolean {
  if (currency === DEFAULT_CURRENCY) return true;
  return env.RAZORPAY_INTERNATIONAL_ENABLED === "true";
}
```

- [ ] **Step 5: Wire the endpoint**

In `razorpay-order.ts`: read `currency` from the body, `normalizeCurrency` it, reject with 400 and a clear message when `!isCurrencyEnabled(currency, process.env)`, pass it to `buildTopupOrderOptions`, and persist `currency` and `amount` on the `paymentOrders` document alongside the existing `amountInRupees`/`amountInPaise` fields. In `razorpay-verify.ts` and `subscription-webhook.ts`, carry the stored `currency` through to the credit-grant and receipt records rather than assuming INR.

- [ ] **Step 6: Document the env var**

Add to `.env.example`:

```
# Set to "true" only after international payments are activated on the
# Razorpay account. Until then USD checkout is refused server-side.
RAZORPAY_INTERNATIONAL_ENABLED=false
```

- [ ] **Step 7: Run test to verify it passes**

Run: `pnpm run test`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add netlify/functions/shared/razorpay-payments.ts netlify/functions/razorpay-order.ts netlify/functions/razorpay-verify.ts netlify/functions/subscription-webhook.ts netlify/functions/__tests__/razorpay-payments.test.ts .env.example
git commit -m "feat(billing): accept USD Razorpay orders behind an activation flag"
```

### Task 15: Currency in the UI

**Files:**

- Modify: `src/pages/Pricing.tsx:108,166,188,276`
- Modify: `src/pages/Wallet.tsx`, `src/pages/Admin.tsx:775`

- [ ] **Step 1: Pick the display currency once**

First add the profile field to `src/types/user.ts`, beside `zodiacMode`:

```ts
    /** Display/checkout currency override. Defaults to a detected value. */
    currency?: Currency;
```

with `import type { Currency } from "../lib/currency";` at the top.

Then add a hook `src/hooks/useCurrency.ts` that resolves, in order: the explicit `profile.currency` override, then `detectCurrency(navigator.language, profile?.timezone)`. Return `{ currency, setCurrency }`, where `setCurrency` writes `profile.currency`.

- [ ] **Step 2: Replace every hardcoded `₹`**

Run: `grep -rn "₹" src/`

Replace each with `formatMoney(amount, currency)`. For `Admin.tsx`, keep INR explicitly — internal revenue reporting should stay in one currency — and label it `INR` in the heading so it is unambiguous.

- [ ] **Step 3: Offer a currency switch on Pricing**

Render a small INR/USD toggle on `Pricing.tsx`, hidden when `isCurrencyEnabled("USD", …)` is false on the server. Expose that flag via the existing config/readiness endpoint rather than reading env in the client.

- [ ] **Step 4: Verify no bare rupee symbols remain in user-facing pages**

Run: `grep -rn "₹" src/ | grep -v Admin.tsx`
Expected: no output.

- [ ] **Step 5: Run the suite and commit**

```bash
pnpm run test
git add src/hooks/useCurrency.ts src/pages/
git commit -m "feat(billing): render prices in the viewer's currency"
```

---

# Phase 4 — Mainstream US Reframe

**Defect:** The dashboard carries heavy untranslated Sanskrit with no glossary (counted in the dashboard components alone: panchang ×52, yoga ×20, nakshatra ×15, sadhana ×7, tithi ×5, atman ×5, karana ×4, jyotish ×4, rahu kaal ×3, sade sati ×2, dasha ×2). Compatibility is arranged-marriage framing end to end — `maleData`/`femaleData`, groom/bride, _"Highly recommended for marriage"_, Manglik dosha — and its binary male/female structure cannot represent a same-sex couple. Festivals default to `region: "north"`, the North Indian Hindu calendar.

### Task 16: Glossary module and inline definitions

**Files:**

- Create: `src/lib/glossary.ts`
- Create: `src/components/ui/GlossaryTerm.tsx`
- Test: `netlify/functions/__tests__/glossary.test.ts`
- Modify: `tsconfig.functions-test.json`

**Interfaces:**

- Produces: `type GlossaryKey`, `GLOSSARY: Record<GlossaryKey, GlossaryEntry>`, `lookupTerm(key: string): GlossaryEntry | null`, `GlossaryEntry = { term: string; short: string; long: string }`

- [ ] **Step 1: Write the failing test**

```ts
// netlify/functions/__tests__/glossary.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { GLOSSARY, lookupTerm } from "../../../src/lib/glossary.js";

const REQUIRED_TERMS = [
  "panchang",
  "tithi",
  "nakshatra",
  "yoga",
  "karana",
  "vara",
  "rahu-kaal",
  "dasha",
  "mahadasha",
  "antardasha",
  "rashi",
  "lagna",
  "kundali",
  "jyotish",
  "atman",
  "prana",
  "dharma",
  "sadhana",
  "guna-milan",
  "manglik",
  "sade-sati",
  "navamsa",
  "ayanamsa",
  "muhurat",
  "graha",
];

test("every term the dashboard surfaces has an entry", () => {
  for (const key of REQUIRED_TERMS) {
    assert.ok(GLOSSARY[key as keyof typeof GLOSSARY], `missing: ${key}`);
  }
});

test("short definitions fit a tooltip and long ones add real detail", () => {
  for (const [key, entry] of Object.entries(GLOSSARY)) {
    assert.ok(entry.term.length > 0, `${key} has no display term`);
    assert.ok(entry.short.length > 0, `${key} has no short definition`);
    assert.ok(
      entry.short.length <= 120,
      `${key} short definition is too long for a tooltip (${entry.short.length})`,
    );
    assert.ok(
      entry.long.length > entry.short.length,
      `${key} long definition adds nothing`,
    );
  }
});

test("definitions do not explain a Sanskrit term with more Sanskrit", () => {
  // A definition that leans on another untranslated term is not a
  // definition for someone with no background.
  assert.equal(/\bnakshatra\b/i.test(GLOSSARY["tithi"].short), false);
});

test("lookupTerm is case- and whitespace-insensitive", () => {
  assert.equal(lookupTerm("Nakshatra")?.term, GLOSSARY["nakshatra"].term);
  assert.equal(lookupTerm("  rahu-kaal  ")?.term, GLOSSARY["rahu-kaal"].term);
});

test("lookupTerm returns null for an unknown key", () => {
  assert.equal(lookupTerm("not-a-term"), null);
});
```

- [ ] **Step 2: Register the module**

Add `"src/lib/glossary.ts"` to `include` in `tsconfig.functions-test.json`.

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm run test:functions`
Expected: FAIL — cannot find module `glossary.js`.

- [ ] **Step 4: Write the implementation**

Create `src/lib/glossary.ts` with an entry per required term. Write every `short` as plain English under 120 characters that assumes zero background, and never define a Sanskrit term using another one. Two examples to set the register:

```ts
export interface GlossaryEntry {
  term: string;
  short: string;
  long: string;
}

export const GLOSSARY = {
  tithi: {
    term: "Tithi",
    short:
      "The lunar day — one of 30 steps in the Moon's cycle from new to full and back.",
    long: "A tithi is the time the Moon takes to gain 12 degrees on the Sun. Because that speed varies, a tithi runs a little shorter or longer than a 24-hour day, which is why it shifts against the calendar date.",
  },
  "rahu-kaal": {
    term: "Rahu Kaal",
    short:
      "A roughly 90-minute window each day traditionally avoided for starting something new.",
    long: "Rahu Kaal is calculated by splitting the time between sunrise and sunset into eight parts and assigning one to Rahu; which part depends on the weekday. Because it derives from local sunrise, it is different for every city.",
  },
  // ...one entry per key in REQUIRED_TERMS
} as const;

export type GlossaryKey = keyof typeof GLOSSARY;

export function lookupTerm(key: string): GlossaryEntry | null {
  const normalized = key.trim().toLowerCase();
  return (GLOSSARY as Record<string, GlossaryEntry>)[normalized] ?? null;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm run test:functions`
Expected: PASS — 5 `glossary` tests.

- [ ] **Step 6: Build the accessible term component**

Create `src/components/ui/GlossaryTerm.tsx` with this exact props contract, so Task 17 and the dashboard cards agree on it:

```ts
import type { GlossaryKey } from "../../lib/glossary";

interface GlossaryTermProps {
  /** Glossary key, e.g. "tithi". Typed so a typo is a compile error. */
  k: GlossaryKey;
  /** Visible label. Defaults to the glossary entry's `term`. */
  children?: React.ReactNode;
}
```

Requirements, because a tooltip is the most commonly broken accessibility pattern:

- Render a `<button type="button">` — not a `<span>` — so it is keyboard reachable.
- The definition popover is linked with `aria-describedby`, shown on hover, focus **and** click (touch has no hover).
- `Escape` closes it; focus stays on the trigger.
- The trigger is styled with a dotted underline, `text-white/80`, and `focus-visible:ring-1 ring-gold/50` per the design system.
- Follow the existing portal pattern in `src/components/LocationInput.tsx:246-285` so the popover is not clipped by a card's `overflow`.

- [ ] **Step 7: Wrap the terms in the dashboard**

In `PanchangCard.tsx`, `NakshatraCard.tsx`, `YogaCard.tsx`, `SadeSatiCard.tsx` and `RemediesCard.tsx`, wrap each Sanskrit label in `<GlossaryTerm k="tithi">Tithi</GlossaryTerm>`. Wrap the **label**, never the value.

- [ ] **Step 8: Run the suite and commit**

```bash
pnpm run test
git add src/lib/glossary.ts src/components/ui/GlossaryTerm.tsx netlify/functions/__tests__/glossary.test.ts tsconfig.functions-test.json src/components/dashboard/
git commit -m "feat(a11y): define every Sanskrit term inline with an accessible glossary"
```

### Task 17: Reframe compatibility as a relationship, not a marriage

**Files:**

- Modify: `netlify/functions/compatibility.ts`
- Modify: `src/pages/Compatibility.tsx`
- Test: `netlify/functions/__tests__/compatibility-payload.test.ts`

**Interfaces:**

- Produces: `normalizeMatchPayload(body: unknown): { personA: BirthData; personB: BirthData }`

The upstream `/vedic/kundli-matching` endpoint requires `groom` and `bride` keys, so that mapping must survive — but it belongs at the `astro-api.ts` boundary only, not in our own API or UI.

- [ ] **Step 1: Write the failing test**

```ts
// netlify/functions/__tests__/compatibility-payload.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { normalizeMatchPayload } from "../shared/compatibility-payload.js";

const A = { dob: "1990-07-15", tob: "20:30", pob: "Austin, Texas, US" };
const B = { dob: "1992-03-02", tob: "06:10", pob: "Denver, Colorado, US" };

test("accepts the new non-gendered shape", () => {
  const out = normalizeMatchPayload({ personA: A, personB: B });
  assert.deepEqual(out.personA, A);
  assert.deepEqual(out.personB, B);
});

test("still accepts the legacy gendered shape so old clients keep working", () => {
  const out = normalizeMatchPayload({ maleData: A, femaleData: B });
  assert.deepEqual(out.personA, A);
  assert.deepEqual(out.personB, B);
});

test("prefers the new shape when both are present", () => {
  const out = normalizeMatchPayload({
    personA: A,
    personB: B,
    maleData: B,
    femaleData: A,
  });
  assert.deepEqual(out.personA, A);
});

test("throws when either chart is missing", () => {
  assert.throws(() => normalizeMatchPayload({ personA: A }));
  assert.throws(() => normalizeMatchPayload({}));
  assert.throws(() => normalizeMatchPayload(null));
});
```

- [ ] **Step 2: Register and run to verify failure**

Add `"netlify/functions/shared/compatibility-payload.ts"` to `tsconfig.functions-test.json`.
Run: `pnpm run test:functions` → FAIL, module not found.

- [ ] **Step 3: Implement the normalizer**

```ts
// netlify/functions/shared/compatibility-payload.ts
import type { BirthData } from "./astro-api.js";

/**
 * Compatibility used to take `maleData`/`femaleData`, which cannot express
 * a same-sex couple and framed the feature as marriage vetting. The public
 * shape is now `personA`/`personB`; the gendered keys are still accepted so
 * clients mid-deploy keep working. The groom/bride mapping that the
 * upstream Vedic endpoint requires lives in astro-api.ts, not here.
 */
export function normalizeMatchPayload(body: unknown): {
  personA: BirthData;
  personB: BirthData;
} {
  const b = (body ?? {}) as Record<string, BirthData | undefined>;
  const personA = b.personA ?? b.maleData;
  const personB = b.personB ?? b.femaleData;
  if (!personA || !personB) {
    throw new Error("Two birth charts are required for a compatibility match");
  }
  return { personA, personB };
}
```

- [ ] **Step 4: Use it in the endpoint**

In `netlify/functions/compatibility.ts`, replace the `const { maleData, femaleData, ... }` destructure and the `if (!maleData || !femaleData)` guard with `normalizeMatchPayload`, and rename the downstream variables to `personA` / `personB`. Update the `stableChargeKey` call to use the new names — the key's _inputs_ are unchanged, so existing per-day charges still dedupe.

- [ ] **Step 5: Rework the UI copy and inputs**

In `src/pages/Compatibility.tsx`:

- Post `personA` / `personB`.
- Replace the gendered partner form with a neutral one. Keep an **optional** `gender` field per person, labelled as only affecting traditional Vedic scores, since Guna Milan and Manglik are defined with gendered roles.
- Change `"Highly recommended for marriage"` to `"Strong long-term compatibility"`, and the other bands likewise.
- Retitle the section to `"Vedic compatibility (Guna Milan)"` and add one line: _"A traditional 36-point Vedic score. It was designed for marriage matching and assigns the two charts traditional roles, so read it as one lens among several."_
- Wrap `Guna Milan`, `Manglik` and `dosha` in `GlossaryTerm` from Task 16.

- [ ] **Step 6: Run the suite and commit**

```bash
pnpm run test
git add netlify/functions/shared/compatibility-payload.ts netlify/functions/compatibility.ts src/pages/Compatibility.tsx netlify/functions/__tests__/compatibility-payload.test.ts tsconfig.functions-test.json
git commit -m "feat(compatibility): non-gendered charts and relationship framing"
```

### Task 18: Region-aware festivals

**Files:**

- Modify: `netlify/functions/shared/astro-api.ts:667-682`
- Modify: `netlify/functions/kundali.ts:258-261`
- Modify: `src/components/dashboard/FestivalCard.tsx`
- Modify: `src/types/user.ts`, `src/pages/Settings.tsx`

`getFestivalCalendar` hardcodes `region: "north"`. For a non-Indian user the card is noise; for a South Indian user it is wrong.

- [ ] **Step 1: Add the profile field**

In `src/types/user.ts`, beside `zodiacMode`:

```ts
    /**
     * Which festival calendar to show, or "off" to hide the card. Defaults
     * to "north" to preserve existing behaviour.
     */
    festivalRegion?: "north" | "south" | "east" | "west" | "off";
```

- [ ] **Step 2: Pass it through**

In `kundali.ts`, read `region` from the body (validating it against that union, defaulting to `"north"`) and pass it to `getFestivalCalendar`. Return `{ data: [] }` without calling the paid API when the region is `"off"`.

- [ ] **Step 3: Send it and hide the card**

In `FestivalCard.tsx`, accept a `region` prop, include it in the request body, and render `null` when it is `"off"`. In `Dashboard.tsx`, pass `profile?.festivalRegion ?? "north"`.

- [ ] **Step 4: Expose the setting**

Add a festival-region picker to `src/pages/Settings.tsx` following the language-picker markup, including the `Off` option described as _"Hide the festival calendar."_

- [ ] **Step 5: Run the suite and commit**

```bash
pnpm run test
git add netlify/functions/shared/astro-api.ts netlify/functions/kundali.ts src/components/dashboard/FestivalCard.tsx src/pages/Dashboard.tsx src/types/user.ts src/pages/Settings.tsx
git commit -m "feat(festivals): make the calendar region a user setting"
```

---

## Out of Scope

Recorded so it is a decision rather than an omission:

- **Full UI translation (i18n).** `profile.language` offers en/hi/ta/te/bn/mr, but no translation layer exists — all copy is hardcoded English. The astrology API supports 16 languages via a `language` option. This is a separate project.
- **A US-native payment processor.** Razorpay international was chosen deliberately; `src/lib/currency.ts` is processor-agnostic so Stripe can be added without redoing pricing.
- **Remedy fulfilment outside India.** `remedy-products.ts` sells gemstones and puja services. Whether those can ship to or be delivered for US customers is an operations question, not a code one.
- **Region-aware SEO pages.** `PanchangSeo.tsx` / `MuhuratSeo.tsx` default to New Delhi, which is correct for the Indian keywords they target.
