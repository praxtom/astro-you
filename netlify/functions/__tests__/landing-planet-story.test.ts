import test from "node:test";
import assert from "node:assert/strict";
import {
  getFocusedPlanetNames,
  getPlanetStoryState,
  PLANET_STORY_CHAPTERS,
} from "../../../src/lib/landing-planet-story.js";

test("planet story maps the scroll to seven ordered narrative chapters", () => {
  assert.equal(PLANET_STORY_CHAPTERS.length, 7);
  assert.equal(getPlanetStoryState(-1).activeChapter.id, "moving-sky");
  assert.equal(getPlanetStoryState(1 / 6).activeChapter.id, "self-inner-world");
  assert.equal(getPlanetStoryState(2 / 6).activeChapter.id, "will-intelligence");
  assert.equal(getPlanetStoryState(3 / 6).activeChapter.id, "wisdom-desire");
  assert.equal(getPlanetStoryState(4 / 6).activeChapter.id, "time-mastery");
  assert.equal(getPlanetStoryState(5 / 6).activeChapter.id, "karmic-axis");
  assert.equal(getPlanetStoryState(2).activeChapter.id, "synthesis");
});

test("the focused chapters cover every Navagraha exactly once", () => {
  const chapterMidpoints = [1, 2, 3, 4, 5].map((index) => index / 6);
  const focusedForces = chapterMidpoints.flatMap((progress) => [
    ...getFocusedPlanetNames(progress),
  ]);

  assert.deepEqual(focusedForces, [
    "Sun",
    "Moon",
    "Mars",
    "Mercury",
    "Jupiter",
    "Venus",
    "Saturn",
    "Rahu",
    "Ketu",
  ]);
});

test("opening and synthesis scenes reunite all nine forces", () => {
  assert.equal(getFocusedPlanetNames(0).length, 9);
  assert.equal(getFocusedPlanetNames(1).length, 9);
});
