import test from "node:test";
import assert from "node:assert/strict";
import {
  FORECAST_UNAVAILABLE_MESSAGE,
  forecastUnavailableResponse,
  isEmptyForecast,
} from "../shared/forecast-delivery.js";

test("null/empty upstream forecasts count as empty", () => {
  assert.equal(isEmptyForecast(null), true);
  assert.equal(isEmptyForecast(undefined), true);
  assert.equal(isEmptyForecast(""), true);
  assert.equal(isEmptyForecast("   "), true);
  assert.equal(isEmptyForecast([]), true);
  assert.equal(isEmptyForecast({}), true);
});

test("real forecast payloads are not empty", () => {
  assert.equal(isEmptyForecast({ overview: "A week of steady growth" }), false);
  assert.equal(isEmptyForecast("Some text"), false);
  assert.equal(isEmptyForecast([{ day: "Mon" }]), false);
});

test("a null weekly/monthly/yearly result refunds the reserved credits and returns 503", async () => {
  let refunds = 0;
  const charge = {
    charged: true,
    refund: async () => {
      refunds += 1;
    },
  };
  const res = await forecastUnavailableResponse(charge, "weekly");
  assert.equal(refunds, 1, "reserved credits must be refunded");
  assert.equal(res.status, 503);
  assert.equal(res.headers.get("Content-Type"), "application/json");
  const body = await res.json();
  assert.equal(body.code, "forecast_unavailable");
  assert.equal(body.period, "weekly");
  assert.equal(body.refunded, true);
  assert.equal(body.error, FORECAST_UNAVAILABLE_MESSAGE);
});

test("refund is awaited before the response is returned", async () => {
  const order: string[] = [];
  const charge = {
    charged: true,
    refund: async () => {
      await new Promise((r) => setTimeout(r, 5));
      order.push("refunded");
    },
  };
  await forecastUnavailableResponse(charge, "yearly");
  order.push("responded");
  assert.deepEqual(order, ["refunded", "responded"]);
});

test("no charge (daily / already-paid window) still yields a clean 503", async () => {
  const none = await forecastUnavailableResponse(null, "monthly");
  assert.equal(none.status, 503);
  assert.equal((await none.json()).refunded, false);

  let called = 0;
  const deduped = await forecastUnavailableResponse(
    { charged: false, refund: async () => void called++ },
    "monthly",
  );
  assert.equal(deduped.status, 503);
  assert.equal((await deduped.json()).refunded, false);
});
