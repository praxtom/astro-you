import test from "node:test";
import assert from "node:assert/strict";
import {
  astroLineMeaning,
  astroZoneMeaning,
  formatZoneScore,
} from "../../../src/lib/astromap-meanings.js";

const BANNED = /\b(ai|software|danger|dangerous|warning|avoid|bad|curse|unlucky|malefic)\b/i;

test("line: planet theme x angle area", () => {
  const venusMc = astroLineMeaning("Venus", "MC");
  assert.equal(
    venusMc,
    "Near this line, charm, beauty and ease show up in your work and reputation.",
  );
  assert.match(astroLineMeaning("Saturn", "AC")!, /patience/);
  assert.match(astroLineMeaning("Mars", "DS")!, /relationships/);
  assert.match(astroLineMeaning("Moon", "IC")!, /home/);
});

test("line: case, spacing and long angle names normalise", () => {
  const venusMc = astroLineMeaning("Venus", "MC");
  for (const [p, a] of [
    ["venus", "mc"],
    ["  VENUS ", "Midheaven"],
    ["Shukra", "MC line"],
  ]) {
    assert.equal(astroLineMeaning(p, a), venusMc, `${p} ${a}`);
  }
  const sunAc = astroLineMeaning("Sun", "AC");
  assert.equal(astroLineMeaning("sun", "ASC"), sunAc);
  assert.equal(astroLineMeaning("Sun", "Ascendant"), sunAc);
  assert.equal(
    astroLineMeaning("Jupiter", "DSC"),
    astroLineMeaning("jupiter", "descendant"),
  );
  assert.equal(
    astroLineMeaning("Mercury", "Imum Coeli"),
    astroLineMeaning("Mercury", "IC"),
  );
  assert.equal(
    astroLineMeaning("North Node", "MC"),
    astroLineMeaning("rahu", "MC"),
  );
  assert.equal(
    astroLineMeaning("south_node", "IC"),
    astroLineMeaning("Ketu", "IC"),
  );
});

test("line: every planet x angle produces neutral copy", () => {
  const planets = [
    "Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn",
    "Uranus", "Neptune", "Pluto", "Rahu", "Ketu", "Chiron",
  ];
  for (const p of planets) {
    for (const a of ["AC", "MC", "DS", "IC"]) {
      const line = astroLineMeaning(p, a);
      assert.ok(line, `${p} ${a}`);
      assert.doesNotMatch(line, BANNED, `${p} ${a}`);
    }
  }
});

test("line: unknown planet or angle returns null", () => {
  assert.equal(astroLineMeaning("Vulcan", "MC"), null);
  assert.equal(astroLineMeaning("Venus", "XY"), null);
  assert.equal(astroLineMeaning("", ""), null);
  assert.equal(astroLineMeaning(undefined, null), null);
  assert.equal(astroLineMeaning({}, []), null);
});

test("zone: built from dominant planets or line intersections", () => {
  assert.equal(
    astroZoneMeaning({ dominant_planets: ["Jupiter", "Venus"] }),
    "Your Jupiter and Venus lines meet here, a good fit for growth and love.",
  );
  assert.equal(
    astroZoneMeaning({ line_intersections: ["Sun AC", "jupiter_IC"] }),
    "Your Sun and Jupiter lines meet here, a good fit for confidence and growth.",
  );
  // Duplicates across both fields collapse; single planet reads naturally.
  assert.equal(
    astroZoneMeaning({
      dominant_planets: ["Venus"],
      line_intersections: ["Venus MC", "Venus DS"],
    }),
    "Your Venus line runs through here, a good fit for love.",
  );
  assert.equal(
    astroZoneMeaning({ dominant_planets: ["Sun", "Moon", "Mars", "Venus"] }),
    "Your Sun, Moon and Mars lines meet here, a good fit for confidence, belonging and drive.",
  );
});

test("zone: nothing recognisable returns null", () => {
  assert.equal(astroZoneMeaning({}), null);
  assert.equal(astroZoneMeaning({ dominant_planets: ["Vulcan"] }), null);
  assert.equal(astroZoneMeaning({ line_intersections: "Venus MC" }), null);
});

test("zone score: 0-1, 0-10 and 0-100 scales become a percentage", () => {
  assert.equal(formatZoneScore(9.1), "91%");
  assert.equal(formatZoneScore(0.82), "82%");
  assert.equal(formatZoneScore(76), "76%");
  assert.equal(formatZoneScore("8.7"), "87%");
  assert.equal(formatZoneScore("64%"), "64%");
  assert.equal(formatZoneScore(140), "100%");
  assert.equal(formatZoneScore(""), null);
  assert.equal(formatZoneScore("high"), null);
  assert.equal(formatZoneScore(undefined), null);
  assert.equal(formatZoneScore(-3), null);
});
