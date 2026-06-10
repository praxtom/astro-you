import test from "node:test";
import assert from "node:assert/strict";
import {
  buildResponseLanguageInstruction,
  getPlatformLanguage,
  normalizePlatformLanguage,
} from "../shared/languages.js";

test("normalizePlatformLanguage accepts only supported language codes", () => {
  assert.equal(normalizePlatformLanguage("hi"), "hi");
  assert.equal(normalizePlatformLanguage("mr"), "mr");
  assert.equal(normalizePlatformLanguage("xx"), "en");
  assert.equal(normalizePlatformLanguage(undefined), "en");
});

test("getPlatformLanguage returns display metadata", () => {
  const language = getPlatformLanguage("te");
  assert.equal(language.code, "te");
  assert.equal(language.label, "Telugu");
  assert.match(language.responseInstruction, /Telugu/);
});

test("buildResponseLanguageInstruction keeps English as the default", () => {
  assert.match(buildResponseLanguageInstruction("en"), /English/);
  assert.match(buildResponseLanguageInstruction("bn"), /Bengali/);
});
