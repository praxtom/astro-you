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
                    // Owner-writable — must never be used as a recipient.
                    email: "victim@example.com",
                    profile: {
                      email: "victim2@example.com",
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
    unsubscribeUrlFor: (uid) => `https://astroyou.app/api/unsubscribe?uid=${uid}&token=t`,
    async lookupVerifiedEmail(uid) {
      assert.equal(uid, "user_123");
      return "kavan@example.com";
    },
    async sendEmail(email) {
      // The claim must already be on disk before anything is delivered.
      assert.equal(writes.length, 2);
      assert.ok(email.unsubscribeUrl);
      emails.push({ to: email.to, subject: email.subject });
    },
  };

  const result = await runProactiveBrainForUser(deps, {
    uid: "user_123",
    sendEmail: true,
  });

  assert.equal(result.sent, true);
  assert.equal(result.emailSent, true);
  assert.equal(writes.length, 3);
  // 1. Claim doc first.
  assert.match(writes[0].path, /users\/user_123\/brainNudges\/2026-05-29_emotional_stabilization/);
  assert.equal(writes[0].data.deliveryStatus, "claimed");
  // 2. Field-level Atman append — never the whole memory.
  assert.equal(writes[1].path, "users/user_123");
  const atmanPatch = writes[1].data.atman as Partial<AtmanData>;
  assert.equal(atmanPatch.nudgeHistory?.[0].triggerType, "emotional_stabilization");
  assert.deepEqual(
    Object.keys(atmanPatch).sort(),
    ["memory", "memoryLedger", "nudgeHistory", "schemaVersion"],
  );
  assert.deepEqual(Object.keys(atmanPatch.memory || {}), ["nudgeHistory"]);
  // 3. Delivery outcome on the claim doc.
  assert.match(writes[2].path, /brainNudges\/2026-05-29_emotional_stabilization/);
  assert.equal(writes[2].data.emailSent, true);
  assert.equal(writes[2].data.deliveryStatus, "delivered");
  assert.equal(emails[0].to, "kavan@example.com");
});

test("runProactiveBrainForUser refuses nudge email without an unsubscribe link but still pushes", async () => {
  const atman = baseAtman();
  atman.emotionalState = "chaotic";
  const emails: string[] = [];
  const pushes: string[] = [];
  const result = await runProactiveBrainForUser(
    {
      db: singleUserDb({
        profile: {
          name: "Kavan",
          timezone: "Asia/Kolkata",
          notificationPrefs: { enabled: true, emailDigest: true },
        },
        atman,
      }),
      now: () => NOW,
      unsubscribeUrlFor: () => undefined,
      async lookupVerifiedEmail() {
        return "kavan@example.com";
      },
      async sendEmail(email) {
        emails.push(email.to);
      },
      async loadPushTokens() {
        return ["push_token_1"];
      },
      async sendPush(push) {
        pushes.push(push.token);
      },
    },
    { uid: "user_123", sendEmail: true },
  );
  assert.equal(result.sent, true);
  assert.equal(result.emailSent, false);
  assert.equal(result.pushSent, true);
  assert.deepEqual(emails, []);
  assert.deepEqual(pushes, ["push_token_1"]);
});

test("runProactiveBrainForUser never resends a nudge that was already claimed", async () => {
  const atman = baseAtman();
  atman.emotionalState = "chaotic";
  const sets: string[] = [];
  const pushes: string[] = [];
  const db = {
    collection() {
      return {
        doc() {
          return {
            collection() {
              return {
                doc(docId: string) {
                  return {
                    async get() {
                      return { exists: true, data: () => ({ deliveryStatus: "claimed" }) };
                    },
                    async set() {
                      sets.push(`nudge:${docId}`);
                    },
                  };
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
                    notificationPrefs: { enabled: true },
                  },
                  atman,
                }),
              };
            },
            async set() {
              sets.push("user");
            },
          };
        },
      };
    },
  } as unknown as ProactiveBrainDeps["db"];
  const result = await runProactiveBrainForUser(
    {
      db,
      now: () => NOW,
      async loadPushTokens() {
        return ["push_token_1"];
      },
      async sendPush(push) {
        pushes.push(push.token);
      },
    },
    { uid: "user_123", sendEmail: true },
  );
  assert.equal(result.sent, false);
  assert.equal(result.skippedReason, "already_claimed");
  assert.deepEqual(pushes, []);
  assert.deepEqual(sets, []);
});

test("runProactiveBrainForUser claims inside a transaction on fresh memory", async () => {
  const stale = baseAtman();
  stale.emotionalState = "chaotic";
  stale.knownPatterns = [
    {
      id: "p1",
      pattern: "Deleted by the user meanwhile",
      frequency: 1,
      weightScore: 1,
      lastMentioned: NOW,
      verified: false,
    },
  ];
  const fresh = { ...baseAtman(), emotionalState: "chaotic" as const };
  const txSets: Array<{ ref: string; data: Record<string, unknown> }> = [];
  const userRef: any = {
    id: "user",
    async get() {
      return {
        exists: true,
        data: () => ({
          profile: { name: "Kavan", timezone: "Asia/Kolkata", notificationPrefs: { enabled: true } },
          atman: stale,
        }),
      };
    },
    async set() {
      throw new Error("must write through the transaction");
    },
    collection() {
      return {
        doc() {
          return {
            id: "nudge",
            async set() {},
          };
        },
      };
    },
  };
  const db = {
    collection: () => ({ doc: () => userRef }),
    async runTransaction(fn: (tx: any) => Promise<unknown>) {
      return fn({
        async get(ref: any) {
          if (ref.id === "nudge") return { exists: false, data: () => undefined };
          return { exists: true, data: () => ({ atman: fresh }) };
        },
        set(ref: any, data: Record<string, unknown>) {
          txSets.push({ ref: ref.id, data });
        },
      });
    },
  } as unknown as ProactiveBrainDeps["db"];
  const result = await runProactiveBrainForUser(
    { db, now: () => NOW },
    { uid: "user_123", sendEmail: false },
  );
  assert.equal(result.sent, true);
  assert.deepEqual(
    txSets.map((s) => s.ref),
    ["nudge", "user"],
  );
  const patch = txSets[1].data.atman as Record<string, unknown>;
  assert.equal("knownPatterns" in patch, false);
  assert.equal(JSON.stringify(patch).includes("Deleted by the user"), false);
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
                      notificationPrefs: {
                        enabled: true,
                        emailDigest: false,
                        whatsappDigest: true,
                      },
                    },
                    verifiedContacts: {
                      whatsappE164: "+919999999999",
                      whatsappVerifiedAt: NOW,
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

function singleUserDb(data: Record<string, unknown>): ProactiveBrainDeps["db"] {
  return {
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
              return { exists: true, data: () => data };
            },
            async set() {},
          };
        },
      };
    },
  } as unknown as ProactiveBrainDeps["db"];
}

test("runProactiveBrainForUser never emails or WhatsApps contact points from the owner-writable doc", async () => {
  const atman = baseAtman();
  atman.emotionalState = "chaotic";
  const emails: string[] = [];
  const whatsapp: string[] = [];
  const result = await runProactiveBrainForUser(
    {
      db: singleUserDb({
        email: "victim@example.com",
        phoneE164: "+15550000001",
        whatsappNumber: "+15550000002",
        profile: {
          name: "Mallory",
          email: "victim2@example.com",
          phone: "+15550000003",
          phoneE164: "+15550000004",
          whatsappNumber: "+15550000005",
          timezone: "Asia/Kolkata",
          notificationPrefs: {
            enabled: true,
            emailDigest: true,
            whatsappDigest: true,
          },
        },
        // Unverified (no marker) — still ignored.
        verifiedContacts: { whatsappE164: "+15550000006" },
        atman,
      }),
      now: () => NOW,
      // Auth record has no verified email.
      async lookupVerifiedEmail() {
        return null;
      },
      async sendEmail(email) {
        emails.push(email.to);
      },
      async sendWhatsApp(message) {
        whatsapp.push(message.to);
      },
    },
    { uid: "user_123", sendEmail: true },
  );

  assert.equal(result.sent, true);
  assert.equal(result.emailSent, false);
  assert.equal(result.whatsappSent, false);
  assert.deepEqual(emails, []);
  assert.deepEqual(whatsapp, []);
});

test("runProactiveBrainForUser sends no email when no verified-email lookup is wired", async () => {
  const atman = baseAtman();
  atman.emotionalState = "chaotic";
  const emails: string[] = [];
  const result = await runProactiveBrainForUser(
    {
      db: singleUserDb({
        email: "victim@example.com",
        profile: {
          name: "Mallory",
          timezone: "Asia/Kolkata",
          notificationPrefs: { enabled: true, emailDigest: true },
        },
        atman,
      }),
      now: () => NOW,
      async sendEmail(email) {
        emails.push(email.to);
      },
    },
    { uid: "user_123", sendEmail: true },
  );
  assert.equal(result.emailSent, false);
  assert.deepEqual(emails, []);
});
