import test from "node:test";
import assert from "node:assert/strict";
import { PERSONAS, getPersonaById } from "../../../src/lib/personas.js";

test("persona catalogue has production-ready listing data", () => {
  assert.equal(PERSONAS.length >= 8, true);

  for (const persona of PERSONAS) {
    assert.equal(Boolean(persona.id), true);
    assert.equal(Boolean(persona.name), true);
    assert.equal(Boolean(persona.title), true);
    assert.equal(Boolean(persona.specialty), true);
    assert.equal(Boolean(persona.profileIntro), true);
    assert.equal([5, 8, 10].includes(persona.pricePerMin), true);
    assert.equal(persona.languages.length >= 2, true);
    assert.equal(persona.methods.length >= 3, true);
    assert.equal(persona.bestFor.length >= 3, true);
    assert.equal(persona.sampleQuestions.length >= 3, true);
  }
});

test("persona ids are unique and resolvable", () => {
  const ids = PERSONAS.map((persona) => persona.id);
  assert.equal(new Set(ids).size, ids.length);

  for (const id of ids) {
    assert.equal(getPersonaById(id)?.id, id);
  }
});
