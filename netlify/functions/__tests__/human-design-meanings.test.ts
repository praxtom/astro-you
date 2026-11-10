import test from "node:test";
import assert from "node:assert/strict";
import {
  humanDesignAuthorityMeaning,
  humanDesignCenterLabel,
  humanDesignCenterMeaning,
  humanDesignProfileMeaning,
  humanDesignStrategyMeaning,
  humanDesignTypeLabel,
  humanDesignTypeMeaning,
} from "../../../src/lib/human-design-meanings.js";

// Copy the owner never wants in front of users.
const BANNED = /\b(ai|software|flaw|weak|bad|danger|warning|curse|unlucky)\b/i;

test("type: spelling variants resolve to the same meaning and label", () => {
  const mg = humanDesignTypeMeaning("Manifesting Generator");
  assert.ok(mg);
  for (const v of [
    "manifesting_generator",
    "manifesting-generator",
    "  MANIFESTING   generator ",
    "MG",
  ]) {
    assert.equal(humanDesignTypeMeaning(v), mg, v);
    assert.equal(humanDesignTypeLabel(v), "Manifesting Generator", v);
  }
  for (const v of ["Generator", "Projector", "Manifestor", "Reflector"]) {
    assert.ok(humanDesignTypeMeaning(v), v);
    assert.ok(humanDesignTypeMeaning(v.toLowerCase()), v);
  }
  assert.notEqual(
    humanDesignTypeMeaning("Generator"),
    humanDesignTypeMeaning("Manifesting Generator"),
  );
});

test("strategy: API phrasings with filler words resolve", () => {
  const respond = humanDesignStrategyMeaning("Wait to Respond");
  assert.ok(respond);
  assert.equal(humanDesignStrategyMeaning("To Respond"), respond);
  assert.equal(humanDesignStrategyMeaning("respond"), respond);
  assert.ok(humanDesignStrategyMeaning("Wait to Respond, then Inform"));
  assert.notEqual(
    humanDesignStrategyMeaning("Wait to Respond, then Inform"),
    respond,
  );
  assert.equal(
    humanDesignStrategyMeaning("Inform before Acting"),
    humanDesignStrategyMeaning("To Inform"),
  );
  assert.equal(
    humanDesignStrategyMeaning("Wait for Invitation"),
    humanDesignStrategyMeaning("wait_for_the_invitation"),
  );
  assert.equal(
    humanDesignStrategyMeaning("Wait a Lunar Cycle"),
    humanDesignStrategyMeaning("Wait 28 days"),
  );
});

test("authority: suffixes and alternative names resolve", () => {
  const sacral = humanDesignAuthorityMeaning("sacral");
  assert.ok(sacral);
  assert.equal(humanDesignAuthorityMeaning("Sacral Authority"), sacral);
  assert.equal(humanDesignAuthorityMeaning("SACRAL_AUTHORITY"), sacral);

  const emotional = humanDesignAuthorityMeaning("Emotional");
  assert.ok(emotional);
  for (const v of [
    "Emotional Authority",
    "Solar Plexus",
    "emotional_solar_plexus",
    "Emotional - Solar Plexus",
  ]) {
    assert.equal(humanDesignAuthorityMeaning(v), emotional, v);
  }

  assert.equal(
    humanDesignAuthorityMeaning("Splenic"),
    humanDesignAuthorityMeaning("spleen"),
  );
  assert.equal(
    humanDesignAuthorityMeaning("Ego"),
    humanDesignAuthorityMeaning("Ego Manifested"),
  );
  assert.equal(
    humanDesignAuthorityMeaning("Self-Projected"),
    humanDesignAuthorityMeaning("self_projected"),
  );
  assert.equal(
    humanDesignAuthorityMeaning("Mental/Environmental"),
    humanDesignAuthorityMeaning("environmental"),
  );
  assert.ok(humanDesignAuthorityMeaning("Lunar"));
});

test("profile: 1/3, 1-3, 1 / 3 and labelled forms all resolve", () => {
  const p13 = humanDesignProfileMeaning("1/3");
  assert.ok(p13);
  for (const v of ["1-3", "1 / 3", "1_3", "1/3 Investigator/Martyr"]) {
    assert.equal(humanDesignProfileMeaning(v), p13, v);
  }
  for (const v of [
    "1/4",
    "2/4",
    "2/5",
    "3/5",
    "3/6",
    "4/6",
    "4/1",
    "5/1",
    "5/2",
    "6/2",
    "6/3",
  ]) {
    assert.ok(humanDesignProfileMeaning(v), v);
  }
  // Not a real profile line pair.
  assert.equal(humanDesignProfileMeaning("1/2"), null);
});

test("centers: aliases, labels, and defined vs open lines", () => {
  const gOpen = humanDesignCenterMeaning("g_center", false);
  assert.ok(gOpen);
  for (const v of ["G Center", "G", "Identity", "g-centre"]) {
    assert.equal(humanDesignCenterMeaning(v, false), gOpen, v);
    assert.equal(humanDesignCenterLabel(v), "G Center (Identity)", v);
  }
  assert.equal(
    humanDesignCenterMeaning("Heart/Ego/Will", true),
    humanDesignCenterMeaning("heart", true),
  );
  assert.equal(
    humanDesignCenterMeaning("solar_plexus", false),
    humanDesignCenterMeaning("Solar Plexus Center", false),
  );
  for (const c of [
    "head",
    "ajna",
    "throat",
    "g_center",
    "heart",
    "sacral",
    "solar_plexus",
    "spleen",
    "root",
  ]) {
    const defined = humanDesignCenterMeaning(c, true);
    const open = humanDesignCenterMeaning(c, false);
    assert.ok(defined && open, c);
    assert.notEqual(defined, open, c);
    assert.ok(humanDesignCenterLabel(c), c);
    // Open centres are not flaws; nothing fear-based in either state.
    assert.doesNotMatch(open!, BANNED, c);
    assert.doesNotMatch(defined!, BANNED, c);
  }
});

test("unknown or empty values return null (no placeholder text)", () => {
  for (const v of ["Wizard", "", "   ", null, undefined, 42, {}, []]) {
    assert.equal(humanDesignTypeMeaning(v), null);
    assert.equal(humanDesignTypeLabel(v), null);
    assert.equal(humanDesignStrategyMeaning(v), null);
    assert.equal(humanDesignAuthorityMeaning(v), null);
    assert.equal(humanDesignProfileMeaning(v), null);
    assert.equal(humanDesignCenterMeaning(v, true), null);
    assert.equal(humanDesignCenterLabel(v), null);
  }
});

test("all copy stays neutral", () => {
  const all = [
    ...["Generator", "Manifesting Generator", "Projector", "Manifestor", "Reflector"].map(humanDesignTypeMeaning),
    ...["respond", "respond inform", "inform", "initiate", "invitation", "lunar"].map(humanDesignStrategyMeaning),
    ...["emotional", "sacral", "splenic", "ego", "self projected", "environmental", "lunar"].map(humanDesignAuthorityMeaning),
  ];
  for (const line of all) {
    assert.ok(line);
    assert.doesNotMatch(line, BANNED);
  }
});
