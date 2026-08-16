import test from "node:test";
import assert from "node:assert/strict";
import { PERSONAS } from "../../../src/lib/personas.js";
import {
  getConsultPersona,
  CONSULT_PERSONAS,
} from "../shared/consult-session.js";

test("every client persona is startable on the server with the same price", () => {
  for (const p of PERSONAS) {
    const server = getConsultPersona(p.id);
    assert.ok(server, `server registry is missing ${p.id}`);
    assert.equal(server.pricePerMin, p.pricePerMin, `price drift for ${p.id}`);
    assert.equal(server.name, p.name);
    assert.ok(
      server.promptModifier.length > 20,
      `promptModifier missing for ${p.id}`,
    );
  }
  assert.equal(Object.keys(CONSULT_PERSONAS).length, PERSONAS.length);
});
