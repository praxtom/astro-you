import test from "node:test";
import assert from "node:assert/strict";
import {
  buildBrainNudgeCandidates,
  runProactiveBrainForUser,
  type ProactiveBrainDeps,
} from "../shared/brain-nudges.js";
import type { AtmanData } from "../../../src/types/user.js";

const NOW = new Date("2026-05-29T05:00:00.000Z");

function baseAtman(): AtmanData {
  return {
    schemaVersion: 1,
    emotionalState: "stable",
    lastEmotionalUpdate: NOW,
    emotionalHistory: [],
    knownPatterns: [],
    activeEvents: [],
    lifeEvents: [],
    meditationStreak: 0,
    mantraAffinity: [],
    preferredPractice: "breathwork",
    keyRelationships: [],
    routines: [],
    savedAdvice: [],
    nudgeHistory: [],
    memoryLedger: [],
    transient: {
      emotionalState: "stable",
      lastEmotionalUpdate: NOW,
      emotionalHistory: [],
    },
    memory: {
      knownPatterns: [],
      lifeEvents: [],
      keyRelationships: [],
      routines: [],
      savedAdvice: [],
      nudgeHistory: [],
    },
  };
}

test("buildBrainNudgeCandidates creates high-priority emotional support", () => {
  const atman = baseAtman();
  atman.emotionalState = "chaotic";

  const nudges = buildBrainNudgeCandidates({
    atman,
    profile: { name: "Kavan", notificationPrefs: { enabled: true } },
    now: NOW,
    timezone: "Asia/Kolkata",
  });

  assert.equal(nudges[0].triggerType, "emotional_stabilization");
  assert.equal(nudges[0].priority, "high");
  assert.match(nudges[0].message, /ground/i);
});

test("buildBrainNudgeCandidates skips duplicate nudges for the same local day", () => {
  const atman = baseAtman();
  atman.emotionalState = "chaotic";
  atman.nudgeHistory = [
    {
      title: "A Moment of Peace",
      message: "Already sent",
      triggerType: "emotional_stabilization",
      date: NOW.toISOString(),
    },
  ];

  const nudges = buildBrainNudgeCandidates({
    atman,
    profile: { name: "Kavan", notificationPrefs: { enabled: true } },
    now: NOW,
    timezone: "Asia/Kolkata",
  });

  assert.equal(
    nudges.some((nudge) => nudge.triggerType === "emotional_stabilization"),
    false,
  );
});

test("runProactiveBrainForUser persists a nudge and updates Atman history", async () => {
  const writes: Array<{ path: string; data: Record<string, unknown> }> = [];
  const emails: Array<{ to: string; subject: string }> = [];
  const atman = baseAtman();
  atman.emotionalState = "chaotic";

  const deps: ProactiveBrainDeps = {
    db: {
      collection(name: string) {
        assert.equal(name, "users");
        return {
          doc(id: string) {
            assert.equal(id, "user_123");
            return {
              collection(subcollection: string) {
                return {
                  doc(docId: string) {
                    return {
                      async set(data: Record<string, unknown>) {
                        writes.push({
                          path: `users/${id}/${subcollection}/${docId}`,
                          data,
                        });
                      },
                    };
                  },
                };
              },
              async get() {
                return {
                  exists: true,
                  data: () => ({
                    email: "kavan@example.com",
                    profile: {
                      name: "Kavan",
                      timezone: "Asia/Kolkata",
                      notificationPrefs: { enabled: true, emailDigest: true },
                    },
                    atman,
                  }),
                };
              },
              async set(data: Record<string, unknown>) {
                writes.push({ path: `users/${id}`, data });
              },
            };
          },
        };
      },
    },
    now: () => NOW,
    async sendEmail(email) {
      emails.push({ to: email.to, subject: email.subject });
    },
  };

  const result = await runProactiveBrainForUser(deps, {
    uid: "user_123",
    sendEmail: true,
  });

  assert.equal(result.sent, true);
  assert.equal(result.emailSent, true);
  assert.equal(writes.length, 2);
  assert.equal(writes[0].path, "users/user_123");
  assert.equal((writes[0].data.atman as AtmanData).nudgeHistory?.[0].triggerType, "emotional_stabilization");
  assert.match(writes[1].path, /users\/user_123\/brainNudges\/2026-05-29_emotional_stabilization/);
  assert.equal(emails[0].to, "kavan@example.com");
});

test("runProactiveBrainForUser sends browser push when a user has active push tokens", async () => {
  const pushes: Array<{ token: string; title: string; triggerType: string }> = [];
  const atman = baseAtman();
  atman.routines = [
    {
      id: "routine_1",
      title: "Morning mantra",
      description: "A short practice for steady focus.",
      steps: ["Sit", "Breathe", "Chant"],
      type: "morning",
      durationMinutes: 5,
      frequency: "daily",
      status: "active",
      streak: 0,
      createdAt: NOW,
    },
  ];

  const deps: ProactiveBrainDeps = {
    db: {
      collection() {
        return {
          doc(_id: string) {
            return {
              collection() {
                return {
                  doc() {
                    return { async set() {} };
                  },
                };
              },
              async get() {
                return {
                  exists: true,
                  data: () => ({
                    profile: {
                      name: "Kavan",
                      timezone: "Asia/Kolkata",
                      notificationPrefs: { enabled: true, pushBrainNudges: true },
                    },
                    atman,
                  }),
                };
              },
              async set() {},
            };
          },
        };
      },
    },
    now: () => NOW,
    async loadPushTokens(uid) {
      assert.equal(uid, "user_123");
      return ["push_token_1", "push_token_2"];
    },
    async sendPush(push) {
      pushes.push({
        token: push.token,
        title: push.title,
        triggerType: push.triggerType,
      });
    },
  };

  const result = await runProactiveBrainForUser(deps, {
    uid: "user_123",
    sendEmail: false,
  });

  assert.equal(result.sent, true);
  assert.equal(result.pushSent, true);
  assert.equal(pushes.length, 2);
  assert.equal(pushes[0].triggerType, "morning_routine");
});

test("runProactiveBrainForUser only sends WhatsApp after explicit opt-in and phone capture", async () => {
  const whatsapp: Array<{ to: string; body: string }> = [];
  const atman = baseAtman();
  atman.emotionalState = "chaotic";

  const deps: ProactiveBrainDeps = {
    db: {
      collection() {
        return {
          doc() {
            return {
              collection() {
                return {
                  doc() {
                    return { async set() {} };
                  },
                };
              },
              async get() {
                return {
                  exists: true,
                  data: () => ({
                    profile: {
                      name: "Kavan",
                      timezone: "Asia/Kolkata",
                      whatsappNumber: "+919999999999",
                      notificationPrefs: {
                        enabled: true,
                        emailDigest: false,
                        whatsappDigest: true,
                      },
                    },
                    atman,
                  }),
                };
              },
              async set() {},
            };
          },
        };
      },
    },
    now: () => NOW,
    async sendWhatsApp(message) {
      whatsapp.push({ to: message.to, body: message.body });
    },
  };

  const result = await runProactiveBrainForUser(deps, {
    uid: "user_123",
    sendEmail: true,
  });

  assert.equal(result.sent, true);
  assert.equal(result.emailSent, false);
  assert.equal(result.whatsappSent, true);
  assert.equal(whatsapp[0].to, "+919999999999");
  assert.match(whatsapp[0].body, /grounding breath/i);
});
