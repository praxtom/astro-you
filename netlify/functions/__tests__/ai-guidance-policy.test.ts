import test from "node:test";
import assert from "node:assert/strict";
import {
  buildGuidancePolicyPrompt,
  applyGuidancePolicyToPersona,
} from "../shared/ai-guidance-policy.js";

test("buildGuidancePolicyPrompt contains hard safety rules", () => {
  const policy = buildGuidancePolicyPrompt();

  assert.match(policy, /no fear-based predictions/i);
  assert.match(policy, /no fatalism/i);
  assert.match(policy, /no medical diagnosis/i);
  assert.match(policy, /no guaranteed financial claims/i);
  assert.match(policy, /self-harm/i);
  assert.match(policy, /abuse/i);
  assert.match(policy, /medical emergency/i);
});

test("applyGuidancePolicyToPersona makes persona prompts inherit policy first", () => {
  const wrapped = applyGuidancePolicyToPersona("Give sharp career timing.");

  assert.match(wrapped, /SHARED ASTROYOU GUIDANCE POLICY/);
  assert.match(wrapped, /PERSONA STYLE/);
  assert.ok(wrapped.indexOf("SHARED ASTROYOU GUIDANCE POLICY") < wrapped.indexOf("PERSONA STYLE"));
  assert.match(wrapped, /Give sharp career timing\./);
});
