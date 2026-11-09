import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  FEATURE_CREDIT_COST as CLIENT_COST,
  FORECAST_PERIOD_FEATURE,
  chargeWindowKey,
  creditLabel,
  isoWeekKey,
} from "../../../src/lib/feature-pricing.js";

// The server table cannot be imported here: feature-credits.ts pulls in the
// Firebase Admin singleton, which throws without a service account. Read the
// literal from source instead — it is a flat `key: number` object.
function serverCostTable(): Record<string, number> {
  const source = readFileSync(
    "netlify/functions/shared/feature-credits.ts",
    "utf8",
  );
  const block = source.match(
    /export const FEATURE_CREDIT_COST\s*=\s*\{([\s\S]*?)\}\s*as const/,
  );
  assert.ok(
    block,
    "FEATURE_CREDIT_COST literal not found in feature-credits.ts",
  );
  const table: Record<string, number> = {};
  for (const m of block[1].matchAll(/([a-z_]+)\s*:\s*(\d+)/g)) {
    table[m[1]] = Number(m[2]);
  }
  return table;
}

// The client copy is what Forecast/Transit tabs advertise before charging;
// the server copy is what is actually deducted. Drift = an undisclosed price.
test("client feature prices equal the server's FEATURE_CREDIT_COST", () => {
  assert.deepEqual({ ...CLIENT_COST }, serverCostTable());
});

test("forecast periods map to the server's metered features", () => {
  assert.equal(FORECAST_PERIOD_FEATURE.daily, null);
  assert.equal(FORECAST_PERIOD_FEATURE.weekly, "horoscope_weekly");
  assert.equal(FORECAST_PERIOD_FEATURE.monthly, "horoscope_monthly");
  assert.equal(FORECAST_PERIOD_FEATURE.yearly, "horoscope_yearly");
});

test("billing windows follow the server's week/month/year/day keys", () => {
  assert.equal(isoWeekKey("2026-01-01"), "2026-W01");
  assert.equal(isoWeekKey("2027-01-01"), "2026-W53");
  assert.equal(isoWeekKey("2024-12-30"), "2025-W01");
  assert.equal(chargeWindowKey("horoscope_weekly", "2026-11-10"), "2026-W46");
  assert.equal(chargeWindowKey("horoscope_monthly", "2026-11-10"), "2026-11");
  assert.equal(chargeWindowKey("horoscope_yearly", "2026-11-10"), "2026");
  assert.equal(chargeWindowKey("transit", "2026-11-10"), "2026-11-10");
});

test("credit labels pluralise", () => {
  assert.equal(creditLabel(1), "1 credit");
  assert.equal(creditLabel(3), "3 credits");
});
