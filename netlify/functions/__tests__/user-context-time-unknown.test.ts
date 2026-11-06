import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";

// user-context.ts imports shared/firebase-admin.js, which initializes the Admin
// SDK at import time — give it a throwaway service account first. All loaders
// are injected; nothing touches Firestore, the astrology API or Gemini.
if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  const { privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify({
    project_id: "astroyou-test",
    client_email: "test@astroyou-test.iam.gserviceaccount.com",
    private_key: privateKey,
  });
}

const { buildUserContext } = await import("../shared/user-context.js");
const { buildJyotishPrompt, buildTransitSummaryPrompt } = await import(
  "../shared/gemini.js"
);

function deps(profile: Record<string, unknown>) {
  return {
    async loadUserDoc() {
      return {
        profile,
        kundaliData: {
          planetary_positions: [
            { name: "Moon", sign: "Tau", house: 10 },
            { name: "Saturn", sign: "Cap", house: 6 },
          ],
          ascendant: { sign: "Leo", degree: 5 },
        },
      };
    },
    async loadRecentSummaries() {
      return [];
    },
    async loadWeeklyContext() {
      return {
        dashaInfo: {
          currentMahadasha: "Venus",
          currentAntardasha: "Moon",
          mahadashaEnd: "2030-05-11",
        },
      };
    },
    async loadDailyPanchang() {
      return undefined;
    },
  };
}

const PROFILE = {
  name: "Asha",
  dob: "1992-04-10",
  tob: "12:00",
  pob: "Pune",
  moonSign: "Taurus",
  moonNakshatra: "Rohini",
  ascendant: "Leo",
};

test("birth time unknown: no Lagna, Moon-relative houses, approximate dashas", async () => {
  const { userContext, kundaliSummary } = await buildUserContext(
    { uid: "u1" },
    deps({ ...PROFILE, birthTimeUnknown: true }),
  );
  assert.equal(userContext.birthTimeUnknown, true);
  assert.equal(userContext.ascendant, undefined);
  assert.equal(userContext.moonNakshatra, "Rohini");
  assert.equal(userContext.dashaInfo?.approximate, true);
  assert.match(kundaliSummary, /from the Moon/);
  assert.doesNotMatch(kundaliSummary, /House/);

  const prompt = buildJyotishPrompt(userContext, kundaliSummary);
  assert.match(prompt, /BIRTH TIME UNKNOWN/);
  assert.match(prompt, /Do NOT state or guess their Lagna/);
  assert.match(prompt, /Chandra Lagna/);
  assert.match(prompt, /Timing is approximate/);
  assert.match(prompt, /Janma Nakshatra \(Moon's star\):\*\* Rohini/);
  assert.doesNotMatch(prompt, /Ascendant \(Lagna\):\*\* Leo/);

  const transit = buildTransitSummaryPrompt(userContext, []);
  assert.doesNotMatch(transit, /Ascendant: Leo/);
  assert.match(transit, /do not mention the rising sign/);
});

test("known birth time keeps the Lagna and exact dasha dates", async () => {
  const { userContext, kundaliSummary } = await buildUserContext(
    { uid: "u1" },
    deps(PROFILE),
  );
  assert.equal(userContext.ascendant, "Leo");
  assert.equal(userContext.dashaInfo?.approximate, undefined);
  const prompt = buildJyotishPrompt(userContext, kundaliSummary);
  assert.match(prompt, /Ascendant \(Lagna\):\*\* Leo/);
  assert.doesNotMatch(prompt, /BIRTH TIME UNKNOWN/);
  assert.doesNotMatch(prompt, /Timing is approximate/);
  assert.match(kundaliSummary, /10th House/);
});
