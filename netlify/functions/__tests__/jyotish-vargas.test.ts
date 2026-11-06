import test from "node:test";
import assert from "node:assert/strict";
import { VARGA_KEYS, vargaPosition } from "../../../src/lib/jyotish/index.js";
import type { VargaKey } from "../../../src/lib/jyotish/index.js";

// Sign indices: 0 Aries 1 Taurus 2 Gemini 3 Cancer 4 Leo 5 Virgo 6 Libra 7 Scorpio 8 Sagittarius 9 Capricorn 10 Aquarius 11 Pisces
const at = (signIndex: number, deg: number) => signIndex * 30 + deg;
const sign = (lon: number, v: VargaKey) => vargaPosition(lon, v).sign;

test("D9 navamsha: element-based starts and 3°20′ steps", () => {
  assert.equal(sign(at(0, 0), "D9"), 0); // 0° Aries → Aries
  assert.equal(sign(at(0, 3 + 1 / 3), "D9"), 1); // 3°20′ Aries → Taurus
  assert.equal(sign(at(0, 29.9), "D9"), 8); // end of Aries → Sagittarius
  assert.equal(sign(at(1, 0), "D9"), 9); // earth starts Capricorn
  assert.equal(sign(at(2, 0), "D9"), 6); // air starts Libra
  assert.equal(sign(at(3, 0), "D9"), 3); // water starts Cancer
  assert.equal(sign(at(11, 29.99), "D9"), 11); // last navamsha of Pisces → Pisces
  assert.ok(
    Math.abs(vargaPosition(at(0, 5 / 3), "D9").degreeInSign - 15) < 1e-9,
  );
});

test("D10 dashamsha: odd from the sign, even from the 9th", () => {
  assert.equal(sign(at(0, 0), "D10"), 0);
  assert.equal(sign(at(0, 29), "D10"), 9);
  assert.equal(sign(at(1, 0), "D10"), 9); // Taurus → Capricorn
  assert.equal(sign(at(1, 3.5), "D10"), 10);
});

test("D30 trimshamsha: unequal Parashari divisions", () => {
  const odd = [
    [4, 0],
    [7, 10],
    [12, 8],
    [20, 2],
    [27, 6],
  ];
  for (const [deg, expected] of odd)
    assert.equal(sign(at(0, deg), "D30"), expected, `Aries ${deg}`);
  const even = [
    [4, 1],
    [8, 5],
    [15, 11],
    [22, 9],
    [28, 7],
  ];
  for (const [deg, expected] of even)
    assert.equal(sign(at(1, deg), "D30"), expected, `Taurus ${deg}`);
  assert.ok(
    Math.abs(vargaPosition(at(0, 2.5), "D30").degreeInSign - 15) < 1e-9,
  );
});

test("other Parashari vargas", () => {
  assert.equal(sign(at(0, 10), "D2"), 4); // odd: Sun's hora (Leo) first
  assert.equal(sign(at(0, 20), "D2"), 3);
  assert.equal(sign(at(1, 10), "D2"), 3); // even: Moon's hora (Cancer) first
  assert.equal(sign(at(1, 20), "D2"), 4);
  assert.equal(sign(at(0, 15), "D3"), 4); // 5th
  assert.equal(sign(at(0, 25), "D3"), 8); // 9th
  assert.equal(sign(at(0, 8), "D4"), 3); // 4th
  assert.equal(sign(at(1, 0), "D7"), 7); // even: from the 7th
  assert.equal(sign(at(0, 2.5), "D12"), 1);
  assert.equal(sign(at(1, 0), "D16"), 4); // fixed → Leo
  assert.equal(sign(at(2, 0), "D16"), 8); // dual → Sagittarius
  assert.equal(sign(at(1, 0), "D20"), 8); // fixed → Sagittarius
  assert.equal(sign(at(2, 0), "D20"), 4); // dual → Leo
  assert.equal(sign(at(0, 0), "D24"), 4); // odd → Leo
  assert.equal(sign(at(1, 0), "D24"), 3); // even → Cancer
  assert.equal(sign(at(1, 0), "D27"), 3); // earth → Cancer
  assert.equal(sign(at(3, 0), "D27"), 9); // water → Capricorn
  assert.equal(sign(at(1, 0), "D40"), 6); // even → Libra
  assert.equal(sign(at(2, 0), "D45"), 8); // dual → Sagittarius
  assert.equal(sign(at(0, 0.6), "D60"), 1);
  assert.equal(sign(at(5, 17), "D1"), 5);
});

test("every varga returns a valid sign for every longitude", () => {
  for (let lon = 0; lon < 360; lon += 0.37) {
    for (const v of VARGA_KEYS) {
      const p = vargaPosition(lon, v);
      assert.ok(p.sign >= 0 && p.sign < 12 && Number.isInteger(p.sign));
      assert.ok(p.degreeInSign >= 0 && p.degreeInSign <= 30);
    }
  }
});
