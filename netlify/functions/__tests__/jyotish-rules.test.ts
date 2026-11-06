import test from "node:test";
import assert from "node:assert/strict";
import {
  NAKSHATRA_YONI,
  VASHYA_TABLE,
  YONI_TABLE,
  ashtakoot,
  biorhythm,
  buildChart,
  chaldeanNameNumber,
  createFixedEphemeris,
  destinyNumber,
  grahaMaitriPoints,
  julianDayFromStrings,
  kaalSarpaAnalysis,
  lifePathNumber,
  manglikAnalysis,
  nadiOf,
  numerologyProfile,
  personalityNumber,
  reduceNumber,
  siderealFrame,
  soulUrgeNumber,
} from "../../../src/lib/jyotish/index.js";
import type { EphemerisBody } from "../../../src/lib/jyotish/index.js";

const INPUT = {
  date: "1995-08-14",
  time: "06:30",
  utcOffsetHours: 5.5,
  lat: 26.85,
  lng: 80.95,
};

/** Chart whose sidereal longitudes are exactly the given values. */
function chartFromSidereal(sidereal: Partial<Record<EphemerisBody, number>>) {
  const jdUT = julianDayFromStrings(
    INPUT.date,
    INPUT.time,
    INPUT.utcOffsetHours,
  );
  const ayanamsa = siderealFrame(createFixedEphemeris({}), jdUT).ayanamsa;
  const positions: Partial<
    Record<EphemerisBody, { longitude: number; speed: number }>
  > = {};
  for (const [body, lon] of Object.entries(sidereal) as Array<
    [EphemerisBody, number]
  >) {
    positions[body] = {
      longitude: lon + ayanamsa,
      speed: body === "MeanNode" ? -0.05 : 1,
    };
  }
  return buildChart(INPUT, createFixedEphemeris(positions));
}

// Reference chart sidereal longitudes (Lagna Leo 7.7°).
const REFERENCE = {
  Sun: 117.0,
  Moon: 339.72,
  Mars: 170.59,
  Mercury: 133.29,
  Jupiter: 221.93,
  Venus: 115.08,
  Saturn: 329.77,
  MeanNode: 186.05,
};

test("manglik: reference chart lists factors and mitigations, no verdict language", () => {
  const r = manglikAnalysis(chartFromSidereal(REFERENCE));
  assert.deepEqual(
    r.references.map((x) => [x.reference, x.house, x.inManglikHouse]),
    [
      ["lagna", 2, true],
      ["moon", 7, true],
      ["venus", 3, false],
    ],
  );
  assert.equal(r.factorCount, 2);
  assert.equal(r.status, "present-with-mitigations");
  assert.ok(r.mitigations.some((m) => m.code === "house-sign-exception")); // 2nd house in Virgo
  assert.ok(!/doom|curse|danger|bad luck/i.test(r.summary));
});

test("manglik: absent and own-sign cases", () => {
  // Mars in Leo with Leo lagna → house 1; own-sign? no. Put Mars in Aries with lagna Leo → 9th: absent from lagna.
  const absent = manglikAnalysis({
    lagna: {
      longitude: 127.7,
      sign: 4,
      degreeInSign: 7.7,
      nakshatra: 9,
      pada: 3,
    },
    grahas: {
      ...chartFromSidereal(REFERENCE).grahas,
      Mars: { ...chartFromSidereal(REFERENCE).grahas.Mars, sign: 0 },
      Moon: { ...chartFromSidereal(REFERENCE).grahas.Moon, sign: 4 },
      Venus: { ...chartFromSidereal(REFERENCE).grahas.Venus, sign: 4 },
    },
  });
  assert.equal(absent.status, "absent");
  assert.equal(absent.factorCount, 0);
  const ownSign = manglikAnalysis({
    lagna: { longitude: 0, sign: 6, degreeInSign: 0, nakshatra: 13, pada: 3 },
    grahas: {
      ...chartFromSidereal(REFERENCE).grahas,
      Mars: { ...chartFromSidereal(REFERENCE).grahas.Mars, sign: 7 },
    },
  });
  assert.equal(ownSign.references[0].house, 2);
  assert.ok(ownSign.mitigations.some((m) => m.code === "own-or-exalted"));
});

test("kaal sarpa: reference chart is not hemmed; constructed charts are", () => {
  assert.equal(kaalSarpaAnalysis(chartFromSidereal(REFERENCE)).status, "none");
  // Rahu 10° Aries, all planets between 20° and 170°
  const full = kaalSarpaAnalysis(
    chartFromSidereal({
      MeanNode: 10,
      Sun: 20,
      Moon: 40,
      Mars: 60,
      Mercury: 80,
      Jupiter: 100,
      Venus: 120,
      Saturn: 170,
    }),
  );
  assert.equal(full.status, "full");
  assert.equal(full.side, "rahu-to-ketu");
  assert.equal(full.outside.length, 0);
  // Reference lagna Leo, Rahu in Aries → 9th house → Shankhachud
  assert.equal(full.rahuHouse, 9);
  assert.equal(full.name, "Shankhachud");
  const partial = kaalSarpaAnalysis(
    chartFromSidereal({
      MeanNode: 10,
      Sun: 20,
      Moon: 250,
      Mars: 60,
      Mercury: 80,
      Jupiter: 100,
      Venus: 120,
      Saturn: 170,
    }),
  );
  assert.equal(partial.status, "partial");
  assert.deepEqual(partial.outside, ["Moon"]);
  const reverse = kaalSarpaAnalysis(
    chartFromSidereal({
      MeanNode: 10,
      Sun: 200,
      Moon: 220,
      Mars: 240,
      Mercury: 260,
      Jupiter: 280,
      Venus: 300,
      Saturn: 350,
    }),
  );
  assert.equal(reverse.side, "ketu-to-rahu");
});

test("ashtakoot: published illustrative example (bride Rohini/Taurus, groom Pushya/Cancer)", () => {
  // hindutone.com "Kundli Matching Explained: Ashtakoota Guna Milan" worked example:
  // Varna 1/1, Tara 1.5/3, Graha Maitri 0.5/5, Bhakoot 7/7 (3/11), Nadi 8/8 (Antya vs Madhya).
  const r = ashtakoot(
    { moonNakshatra: 3, moonSign: 1 },
    { moonNakshatra: 7, moonSign: 3 },
  );
  const pts = Object.fromEntries(r.kootas.map((k) => [k.name, k.points]));
  assert.equal(pts["Varna"], 1);
  assert.equal(pts["Tara"], 1.5);
  assert.equal(pts["Graha Maitri"], 0.5);
  assert.equal(pts["Bhakoot"], 7);
  assert.equal(pts["Nadi"], 8);
  // Remaining kootas from the cited tables: Vashya Chatushpada(bride) × Jalachara(groom) = 1,
  // Yoni Serpent × Sheep = 2, Gana Manushya(bride) × Deva(groom) = 6.
  assert.equal(pts["Vashya"], 1);
  assert.equal(pts["Yoni"], 2);
  assert.equal(pts["Gana"], 6);
  assert.equal(r.total, 27);
  assert.equal(r.max, 36);
  assert.deepEqual(r.doshas, []);
});

test("ashtakoot: tables and doshas", () => {
  // Same nakshatra: Nadi dosha, everything else maximal
  const same = ashtakoot(
    { moonNakshatra: 0, moonSign: 0 },
    { moonNakshatra: 0, moonSign: 0 },
  );
  assert.equal(same.total, 28);
  assert.deepEqual(same.doshas, ["nadi"]);
  // 6/8 Bhakoot: Aries bride, Virgo groom
  const sixEight = ashtakoot(
    { moonNakshatra: 1, moonSign: 0 },
    { moonNakshatra: 12, moonSign: 5 },
  );
  assert.equal(sixEight.kootas.find((k) => k.name === "Bhakoot")?.points, 0);
  assert.ok(sixEight.doshas.includes("bhakoot"));
  // Yoni matrix is symmetric with 4 on the diagonal and 0 for the 7 Mahavaira pairs
  for (let i = 0; i < 14; i++) {
    assert.equal(YONI_TABLE[i][i], 4);
    for (let j = 0; j < 14; j++)
      assert.equal(YONI_TABLE[i][j], YONI_TABLE[j][i]);
  }
  for (const [a, b] of [
    [0, 8],
    [1, 13],
    [2, 11],
    [3, 12],
    [4, 10],
    [5, 6],
    [7, 9],
  ])
    assert.equal(YONI_TABLE[a][b], 0);
  assert.equal(NAKSHATRA_YONI.length, 27);
  // Vashya table as published (rows bride, columns groom)
  assert.deepEqual(VASHYA_TABLE[1], [1, 2, 0.5, 0, 1]);
  // Nadi groups
  assert.deepEqual(
    [0, 5, 6, 11, 12, 17, 18, 23, 24].map(nadiOf),
    Array(9).fill(0),
  );
  assert.deepEqual(
    [2, 3, 8, 9, 14, 15, 20, 21, 26].map(nadiOf),
    Array(9).fill(2),
  );
  // Graha maitri grades
  assert.equal(grahaMaitriPoints("Sun", "Moon"), 5);
  assert.equal(grahaMaitriPoints("Sun", "Saturn"), 0);
  assert.equal(grahaMaitriPoints("Moon", "Venus"), 0.5);
  assert.equal(grahaMaitriPoints("Moon", "Jupiter"), 4);
  // Sagittarius halves for Vashya
  const sagEarly = ashtakoot(
    { moonNakshatra: 18, moonSign: 8, moonLongitude: 245 },
    { moonNakshatra: 18, moonSign: 8, moonLongitude: 245 },
  );
  assert.equal(
    sagEarly.kootas.find((k) => k.name === "Vashya")?.bride,
    "Manava",
  );
  const sagLate = ashtakoot(
    { moonNakshatra: 19, moonSign: 8, moonLongitude: 260 },
    { moonNakshatra: 19, moonSign: 8 },
  );
  assert.equal(
    sagLate.kootas.find((k) => k.name === "Vashya")?.bride,
    "Chatushpada",
  );
  for (const r of [same, sixEight, sagEarly, sagLate])
    assert.ok(r.total >= 0 && r.total <= 36);
});

test("numerology: Pythagorean and Chaldean core numbers", () => {
  assert.equal(reduceNumber(29), 11);
  assert.equal(reduceNumber(38), 11);
  assert.equal(reduceNumber(22), 22);
  assert.equal(reduceNumber(11, false), 2);
  assert.equal(reduceNumber(1990), 1);
  assert.equal(lifePathNumber(1990, 7, 4), 3);
  assert.equal(lifePathNumber(1995, 8, 14), 1); // 1995→24→6, 8, 14→5 → 19 → 1
  assert.equal(destinyNumber("John Smith"), 8); // JOHN 20→2, SMITH 24→6
  assert.equal(soulUrgeNumber("John Smith"), 6); // O 6 + I 9 = 15
  assert.equal(personalityNumber("John Smith"), 11); // 14→5 + 15→6 = 11 (master)
  assert.deepEqual(chaldeanNameNumber("John Smith"), {
    compound: 35,
    reduced: 8,
  });
  const p = numerologyProfile("John Smith", "1990-07-04");
  assert.equal(p.birthday, 4);
  assert.deepEqual(p.masterNumbers, [11]);
  assert.equal(destinyNumber("José"), destinyNumber("Jose"));
});

test("biorhythm: 23/28/33-day sine cycles", () => {
  const zero = biorhythm("2000-01-01", "2000-01-01");
  assert.equal(zero.daysSinceBirth, 0);
  assert.equal(zero.physical.value, 0);
  assert.equal(zero.physical.critical, true);
  const r = biorhythm("2000-01-01", "2000-01-08");
  assert.equal(r.daysSinceBirth, 7);
  assert.ok(
    Math.abs(r.physical.value - Math.sin((2 * Math.PI * 7) / 23)) < 1e-12,
  );
  assert.ok(Math.abs(r.emotional.value - 1) < 1e-12); // day 7 of 28 = peak
  assert.equal(biorhythm("2000-01-01", "2000-01-24").physical.value, 0);
  assert.equal(biorhythm("1995-08-14", "2026-11-07").daysSinceBirth, 11408);
});
