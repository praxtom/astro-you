import {
  ATMAN_SCHEMA_VERSION,
  type AtmanData,
  type AtmanMemoryLedgerEntry,
  type AtmanNudgeEntry,
  type NotificationPrefs,
  type UserLifeEvent,
  type UserRoutine,
} from "../../../src/types/user.js";
import {
  createInitialAtmanData,
  normalizeAtmanData,
  validateNudgeInput,
} from "../../../src/lib/atman-schema.js";

type UserDocSnapshot = {
  exists: boolean;
  data(): Record<string, unknown> | undefined;
};

type BrainNudgeDocRef = {
  set(data: Record<string, unknown>, options?: { merge?: boolean }): Promise<unknown>;
};

type BrainNudgeCollectionRef = {
  doc(id: string): BrainNudgeDocRef;
};

type UserDocRef = {
  get(): Promise<UserDocSnapshot>;
  set(data: Record<string, unknown>, options?: { merge?: boolean }): Promise<unknown>;
  collection(name: string): BrainNudgeCollectionRef;
};

type UsersCollectionRef = {
  doc(id: string): UserDocRef;
};

export interface BrainNudgeEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface BrainPushNotification {
  uid: string;
  token: string;
  title: string;
  body: string;
  url: string;
  triggerType: string;
  priority: BrainNudgeCandidate["priority"];
}

export interface BrainWhatsAppMessage {
  uid: string;
  to: string;
  body: string;
  triggerType: string;
  priority: BrainNudgeCandidate["priority"];
}

export interface ProactiveBrainDeps {
  db: {
    collection(name: string): UsersCollectionRef;
  };
  now?: () => Date;
  sendEmail?: (email: BrainNudgeEmail) => Promise<void>;
  loadPushTokens?: (uid: string) => Promise<string[]>;
  sendPush?: (push: BrainPushNotification) => Promise<void>;
  sendWhatsApp?: (message: BrainWhatsAppMessage) => Promise<void>;
}

export interface BrainNudgeProfile {
  name?: string;
  email?: string;
  phoneE164?: string;
  whatsappNumber?: string;
  timezone?: string;
  notificationPrefs?: Partial<NotificationPrefs>;
}

export type BrainNudgeChannel = "in_app" | "email" | "push" | "whatsapp";

export interface BrainNudgeCandidate {
  title: string;
  message: string;
  triggerType: string;
  priority: "high" | "normal" | "low";
  reason: string;
  localDate: string;
  channels: BrainNudgeChannel[];
}

export interface BuildBrainNudgeInput {
  atman?: Partial<AtmanData>;
  profile?: BrainNudgeProfile;
  now?: Date;
  timezone?: string;
}

export interface RunProactiveBrainInput {
  uid: string;
  sendEmail: boolean;
}

export interface RunProactiveBrainResult {
  uid: string;
  sent: boolean;
  emailSent: boolean;
  pushSent: boolean;
  whatsappSent: boolean;
  triggerType?: string;
  skippedReason?: string;
}

export function buildBrainNudgeCandidates(input: BuildBrainNudgeInput): BrainNudgeCandidate[] {
  const now = input.now || new Date();
  const timezone = input.timezone || input.profile?.timezone || "Asia/Kolkata";
  const localDate = formatLocalDate(now, timezone);
  const localHour = getLocalHour(now, timezone);
  const atman = normalizeAtmanData(input.atman, now);
  const prefs = input.profile?.notificationPrefs || {};
  if (!atman || prefs.enabled === false) return [];

  const name = input.profile?.name || "Friend";
  const candidates: BrainNudgeCandidate[] = [];

  if (
    (atman.emotionalState === "chaotic" || atman.emotionalState === "depressive") &&
    !hasNudgeForLocalDay(atman, "emotional_stabilization", localDate, timezone)
  ) {
    candidates.push({
      title: "A Moment of Ground",
      message: `${name}, pause for one grounding breath. Feel your feet, soften your jaw, and come back to this moment before deciding anything.`,
      triggerType: "emotional_stabilization",
      priority: "high",
      reason: `Atman state is ${atman.emotionalState}.`,
      localDate,
      channels: ["in_app", "email", "push", "whatsapp"],
    });
  }

  const morningRoutine = findIncompleteRoutine(atman.routines || [], "morning", localDate, timezone);
  if (
    morningRoutine &&
    localHour >= 8 &&
    localHour < 12 &&
    !hasNudgeForLocalDay(atman, "morning_routine", localDate, timezone)
  ) {
    candidates.push({
      title: "Morning Sadhana",
      message: `Your ${morningRoutine.title} is still open for today. Keep it small; consistency matters more than intensity.`,
      triggerType: "morning_routine",
      priority: "normal",
      reason: "Active morning routine has not been completed today.",
      localDate,
      channels: ["in_app", "push"],
    });
  }

  if (
    localHour >= 7 &&
    localHour < 11 &&
    atman.dailyIntentionDate !== localDate &&
    !hasNudgeForLocalDay(atman, "daily_intention", localDate, timezone)
  ) {
    candidates.push({
      title: "Daily Sankalpa",
      message: "Set one clear intention before the day gathers speed.",
      triggerType: "daily_intention",
      priority: "normal",
      reason: "No daily intention has been recorded for the local day.",
      localDate,
      channels: ["in_app", "push"],
    });
  }

  if (
    localHour >= 20 &&
    localHour < 23 &&
    atman.dailyGratitudeDate !== localDate &&
    !hasNudgeForLocalDay(atman, "evening_gratitude", localDate, timezone)
  ) {
    candidates.push({
      title: "Evening Reflection",
      message: "Before rest, name one thing that steadied you today.",
      triggerType: "evening_gratitude",
      priority: "low",
      reason: "No gratitude reflection has been recorded for the local day.",
      localDate,
      channels: ["in_app"],
    });
  }

  const pendingEvent = findPendingEventForFollowup(atman.activeEvents || atman.lifeEvents || [], now);
  if (
    pendingEvent &&
    !hasNudgeForLocalDay(atman, `life_event_followup_${pendingEvent.id}`, localDate, timezone)
  ) {
    candidates.push({
      title: "Path Check-In",
      message: `You had "${pendingEvent.title}" on your path. How did it unfold?`,
      triggerType: `life_event_followup_${pendingEvent.id}`,
      priority: "normal",
      reason: "A pending life event is ready for follow-up.",
      localDate,
      channels: ["in_app", "push"],
    });
  }

  const relationship = (atman.keyRelationships || []).find(
    (item) => item.dynamic === "conflict" || item.dynamic === "distant",
  );
  if (
    relationship &&
    localHour >= 15 &&
    localHour < 18 &&
    !hasNudgeForLocalDay(atman, "relational_management", localDate, timezone)
  ) {
    candidates.push({
      title: `With ${relationship.name}`,
      message: `A gentle check-in with ${relationship.name} may need patience today. Speak clearly, not quickly.`,
      triggerType: "relational_management",
      priority: "normal",
      reason: "A mapped relationship has a conflict or distant dynamic.",
      localDate,
      channels: ["in_app", "push"],
    });
  }

  return candidates.sort((a, b) => priorityScore(b.priority) - priorityScore(a.priority));
}

export async function runProactiveBrainForUser(
  deps: ProactiveBrainDeps,
  input: RunProactiveBrainInput,
): Promise<RunProactiveBrainResult> {
  const now = deps.now?.() || new Date();
  const userRef = deps.db.collection("users").doc(input.uid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    return {
      uid: input.uid,
      sent: false,
      emailSent: false,
      pushSent: false,
      whatsappSent: false,
      skippedReason: "user_not_found",
    };
  }

  const userData = userSnap.data() || {};
  const profile = buildProfile(userData);
  const candidates = buildBrainNudgeCandidates({
    atman: userData.atman as Partial<AtmanData> | undefined,
    profile,
    now,
    timezone: profile.timezone,
  });

  const candidate = candidates[0];
  if (!candidate) {
    return {
      uid: input.uid,
      sent: false,
      emailSent: false,
      pushSent: false,
      whatsappSent: false,
      skippedReason: "no_nudge_due",
    };
  }

  const atman = appendNudgeToAtman(userData.atman as Partial<AtmanData> | undefined, candidate, now);
  const docId = createNudgeDocId(candidate.localDate, candidate.triggerType);
  const record = {
    uid: input.uid,
    ...candidate,
    createdAt: now,
    emailSent: false,
    pushSent: false,
    pushTokenCount: 0,
    whatsappSent: false,
    deliveryStatus: "stored",
  };

  let emailSent = false;
  let emailError: string | undefined;
  if (shouldEmailNudge(candidate, profile, input.sendEmail) && deps.sendEmail && profile.email) {
    try {
      await deps.sendEmail(buildNudgeEmail(profile.email, profile.name || "Friend", candidate));
      emailSent = true;
    } catch (error: any) {
      emailError = error?.message || "email_failed";
    }
  }

  let pushSent = false;
  let pushTokenCount = 0;
  let pushError: string | undefined;
  if (shouldPushNudge(candidate, profile) && deps.loadPushTokens && deps.sendPush) {
    try {
      const tokens = await deps.loadPushTokens(input.uid);
      pushTokenCount = tokens.length;
      for (const token of tokens.slice(0, 5)) {
        await deps.sendPush(buildPushNotification(input.uid, token, candidate));
        pushSent = true;
      }
    } catch (error: any) {
      pushError = error?.message || "push_failed";
    }
  }

  let whatsappSent = false;
  let whatsappError: string | undefined;
  const whatsappNumber = profile.whatsappNumber || profile.phoneE164;
  if (shouldWhatsAppNudge(candidate, profile) && deps.sendWhatsApp && whatsappNumber) {
    try {
      await deps.sendWhatsApp(buildWhatsAppMessage(input.uid, whatsappNumber, candidate));
      whatsappSent = true;
    } catch (error: any) {
      whatsappError = error?.message || "whatsapp_failed";
    }
  }

  await userRef.set({ atman }, { merge: true });
  await userRef.collection("brainNudges").doc(docId).set(
    {
      ...record,
      emailSent,
      pushSent,
      pushTokenCount,
      whatsappSent,
      deliveryStatus: resolveDeliveryStatus({
        emailSent,
        pushSent,
        whatsappSent,
        emailError,
        pushError,
        whatsappError,
      }),
      emailError: emailError || null,
      pushError: pushError || null,
      whatsappError: whatsappError || null,
    },
    { merge: true },
  );

  return {
    uid: input.uid,
    sent: true,
    emailSent,
    pushSent,
    whatsappSent,
    triggerType: candidate.triggerType,
    skippedReason: emailError || pushError || whatsappError,
  };
}

export function appendNudgeToAtman(
  existingAtman: Partial<AtmanData> | undefined,
  candidate: BrainNudgeCandidate,
  now = new Date(),
): AtmanData {
  const atman = normalizeAtmanData(existingAtman, now) || createInitialAtmanData(now);
  const safeNudge = validateNudgeInput(candidate);
  const entry: AtmanNudgeEntry = {
    ...safeNudge,
    date: now.toISOString(),
  };
  atman.nudgeHistory = [...(atman.nudgeHistory || []).slice(-19), entry];
  atman.memory = {
    knownPatterns: atman.knownPatterns || [],
    lifeEvents: atman.activeEvents || atman.lifeEvents || [],
    keyRelationships: atman.keyRelationships || [],
    routines: atman.routines || [],
    savedAdvice: atman.savedAdvice || atman.adviceHistory || [],
    nudgeHistory: atman.nudgeHistory,
  };
  atman.schemaVersion = ATMAN_SCHEMA_VERSION;
  const ledgerEntry: AtmanMemoryLedgerEntry = {
    id: `nudge_${now.getTime()}_${sanitizeId(candidate.triggerType)}`,
    surface: "nudge",
    createdAt: now,
    messageExcerpt: `${candidate.title}: ${candidate.reason}`,
    confidence: candidate.priority === "high" ? 1 : candidate.priority === "normal" ? 0.75 : 0.5,
    patternsAdded: 0,
    eventsAdded: 0,
    adviceSaved: 0,
    contradictionsDetected: 0,
    karmicThreadsDetected: 0,
  };
  atman.memoryLedger = [...(atman.memoryLedger || []).slice(-49), ledgerEntry];
  return atman;
}

export function buildNudgeEmail(to: string, name: string, candidate: BrainNudgeCandidate): BrainNudgeEmail {
  const subject = `${name}, ${candidate.title}`;
  const text = `${candidate.message}\n\nWhy this now: ${candidate.reason}`;
  const html = `<div style="font-family:Inter,Arial,sans-serif;line-height:1.6;color:#f8f5ee;background:#08080d;padding:24px;border-radius:16px"><h2 style="color:#E5B96A;margin-top:0">${escapeHtml(candidate.title)}</h2><p>${escapeHtml(candidate.message)}</p><p style="color:#a7a2b8;font-size:13px">Why this now: ${escapeHtml(candidate.reason)}</p></div>`;
  return { to, subject, text, html };
}

export function buildPushNotification(
  uid: string,
  token: string,
  candidate: BrainNudgeCandidate,
): BrainPushNotification {
  return {
    uid,
    token,
    title: candidate.title,
    body: candidate.message,
    url: "/dashboard",
    triggerType: candidate.triggerType,
    priority: candidate.priority,
  };
}

export function buildWhatsAppMessage(
  uid: string,
  to: string,
  candidate: BrainNudgeCandidate,
): BrainWhatsAppMessage {
  return {
    uid,
    to,
    body: `${candidate.title}\n\n${candidate.message}`,
    triggerType: candidate.triggerType,
    priority: candidate.priority,
  };
}

function buildProfile(userData: Record<string, unknown>): BrainNudgeProfile {
  const profile = (userData.profile && typeof userData.profile === "object"
    ? userData.profile
    : userData) as Record<string, any>;
  return {
    name: profile.name || userData.name as string | undefined,
    email: profile.email || userData.email as string | undefined,
    phoneE164: profile.phoneE164 || profile.phone || userData.phoneE164 as string | undefined,
    whatsappNumber: profile.whatsappNumber || userData.whatsappNumber as string | undefined,
    timezone: profile.timezone || userData.timezone as string | undefined,
    notificationPrefs: profile.notificationPrefs || userData.notificationPrefs,
  };
}

function shouldEmailNudge(candidate: BrainNudgeCandidate, profile: BrainNudgeProfile, sendEmail: boolean) {
  if (!sendEmail || candidate.priority !== "high") return false;
  if (!candidate.channels.includes("email")) return false;
  if (!profile.email) return false;
  return profile.notificationPrefs?.emailDigest !== false;
}

function shouldPushNudge(candidate: BrainNudgeCandidate, profile: BrainNudgeProfile) {
  if (!candidate.channels.includes("push")) return false;
  return profile.notificationPrefs?.pushBrainNudges !== false;
}

function shouldWhatsAppNudge(candidate: BrainNudgeCandidate, profile: BrainNudgeProfile) {
  if (!candidate.channels.includes("whatsapp")) return false;
  if (!(profile.whatsappNumber || profile.phoneE164)) return false;
  return profile.notificationPrefs?.whatsappDigest === true;
}

function resolveDeliveryStatus(input: {
  emailSent: boolean;
  pushSent: boolean;
  whatsappSent: boolean;
  emailError?: string;
  pushError?: string;
  whatsappError?: string;
}) {
  if (input.emailSent || input.pushSent || input.whatsappSent) return "delivered";
  if (input.emailError || input.pushError || input.whatsappError) return "delivery_failed";
  return "stored";
}

function hasNudgeForLocalDay(atman: AtmanData, triggerType: string, localDate: string, timezone: string) {
  return (atman.nudgeHistory || []).some((entry) => {
    if (entry.triggerType !== triggerType) return false;
    return formatLocalDate(new Date(entry.date), timezone) === localDate;
  });
}

function findIncompleteRoutine(
  routines: UserRoutine[],
  type: UserRoutine["type"],
  localDate: string,
  timezone: string,
) {
  return routines.find((routine) => {
    if (routine.type !== type || routine.status !== "active") return false;
    if (!routine.lastCompletedAt) return true;
    return formatLocalDate(new Date(routine.lastCompletedAt), timezone) !== localDate;
  });
}

function findPendingEventForFollowup(events: UserLifeEvent[], now: Date) {
  return events.find((event) => {
    if (event.status !== "pending" || !event.date) return false;
    const eventDate = new Date(event.date);
    if (Number.isNaN(eventDate.getTime())) return false;
    const days = (now.getTime() - eventDate.getTime()) / (1000 * 60 * 60 * 24);
    return days >= 1;
  });
}

function priorityScore(priority: BrainNudgeCandidate["priority"]) {
  return priority === "high" ? 3 : priority === "normal" ? 2 : 1;
}

function createNudgeDocId(localDate: string, triggerType: string) {
  return `${localDate}_${sanitizeId(triggerType)}`;
}

function sanitizeId(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 120);
}

export function formatLocalDate(date: Date, timezone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getLocalHour(date: Date, timezone: string) {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    hour12: false,
  }).format(date);
  return Number(hour);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
