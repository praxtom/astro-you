import test from "node:test";
import assert from "node:assert/strict";
import {
  HOROSCOPE_PERIODS,
  ZODIAC_SIGNS,
  getSignHoroscopeContent,
} from "../../../src/lib/sign-horoscope-content.js";

test("sign horoscope content covers every zodiac sign and period", () => {
  assert.equal(ZODIAC_SIGNS.length, 12);
  assert.equal(HOROSCOPE_PERIODS.length, 4);

  const paths = ZODIAC_SIGNS.flatMap((sign) =>
    HOROSCOPE_PERIODS.map((period) => getSignHoroscopeContent(sign.slug, period.slug).path),
  );

  assert.equal(paths.length, 48);
  assert.equal(new Set(paths).size, 48);
});

test("sign horoscope fallback guidance is sign-specific", () => {
  const aries = getSignHoroscopeContent("aries", "daily");
  const taurus = getSignHoroscopeContent("taurus", "daily");

  assert.match(aries.forecast, /Aries/);
  assert.match(taurus.forecast, /Taurus/);
  assert.notEqual(aries.forecast, taurus.forecast);
  assert.equal(aries.focusAreas.length, 3);
  assert.ok(aries.focusAreas.every((item) => item.title && item.body));
});

test("invalid sign and period safely fall back to Aries daily", () => {
  const content = getSignHoroscopeContent("unknown", "decade");

  assert.equal(content.sign.slug, "aries");
  assert.equal(content.period.slug, "daily");
  assert.equal(content.path, "/horoscope/aries/daily");
});
