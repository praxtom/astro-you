import test from "node:test";
import assert from "node:assert/strict";
import {
  INSTALL_DISMISSED_KEY,
  INSTALL_VISITS_KEY,
  recordInstallPromptVisit,
  shouldShowInstallPrompt,
} from "../../../src/lib/pwa-install.js";

function createStorage(seed: Record<string, string> = {}) {
  const values = new Map(Object.entries(seed));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

test("recordInstallPromptVisit increments stored visits safely", () => {
  const storage = createStorage({ [INSTALL_VISITS_KEY]: "1" });

  assert.equal(recordInstallPromptVisit(storage), 2);
  assert.equal(storage.getItem(INSTALL_VISITS_KEY), "2");
});

test("shouldShowInstallPrompt waits for repeat visit and respects dismissal", () => {
  const storage = createStorage();

  assert.equal(shouldShowInstallPrompt(storage, 1, false), false);
  assert.equal(shouldShowInstallPrompt(storage, 2, false), true);

  storage.setItem(INSTALL_DISMISSED_KEY, "true");
  assert.equal(shouldShowInstallPrompt(storage, 3, false), false);
  assert.equal(shouldShowInstallPrompt(createStorage(), 3, true), false);
});
