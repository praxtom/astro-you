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
import { stripUndefined } from "../../../src/lib/memory-ops.js";
import { buildUnsubscribeUrl, resolveUnsubscribeSecret } from "./digest.js";
import { selectVerifiedWhatsAppNumber } from "./verified-contact.js";

/**
 * One-click unsubscribe URL for a user's nudge emails, or undefined when
 * EMAIL_UNSUB_SECRET is not configured. Without it, nudge EMAIL is not sent
 * at all (same as the daily digest) — bulk mail must carry List-Unsubscribe.
 * Push and in-app delivery are unaffected.
 */
export function resolveNudgeUnsubscribeUrl(uid: string): string | undefined {
  try {
    const secret = resolveUnsubscribeSecret();
    if (!secret) return undefined;
    return buildUnsubscribeUrl(uid, secret);
  } catch {
    return undefined;
  }
}

type UserDocSnapshot = {
  exists: boolean;
  data(): Record<string, unknown> | undefined;
};

type BrainNudgeDocRef = {
  /** Optional in test doubles; used to detect an existing claim. */
  get?(): Promise<UserDocSnapshot>;
  set(
    data: Record<string, unknown>,
    options?: { merge?: boolean },
  ): Promise<unknown>;
};

/** Minimal Firestore transaction surface used to claim a nudge. */
type NudgeTransaction = {
  get(ref: unknown): Promise<UserDocSnapshot>;
  set(
    ref: unknown,
    data: Record<string, unknown>,
    options?: { merge?: boolean },
  ): unknown;
};

type BrainNudgeCollectionRef = {
  doc(id: string): BrainNudgeDocRef;
};

type UserDocRef = {
  get(): Promise<UserDocSnapshot>;
  set(
    data: Record<string, unknown>,
    options?: { merge?: boolean },
  ): Promise<unknown>;
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
  uid: string;
  /** Tokenized one-click unsubscribe URL, when EMAIL_UNSUB_SECRET is set. */
  unsubscribeUrl?: string;
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
    /**
     * When present (production), the nudge is claimed and appended to Atman
     * inside a transaction on fresh data.
     */
    runTransaction?: <T>(
      fn: (tx: NudgeTransaction) => Promise<T>,
    ) => Promise<T>;
  };
  now?: () => Date;
  /**
   * One-click unsubscribe URL for a user. Defaults to the EMAIL_UNSUB_SECRET
   * based link; when it returns undefined, no nudge email is sent.
   */
  unsubscribeUrlFor?: (uid: string) => string | undefined;
  sendEmail?: (email: BrainNudgeEmail) => Promise<void>;
  /**
   * The user's verified email from the Firebase Auth record (see
   * shared/verified-contact.ts). Never read from the owner-writable user doc.
   * Without it, email nudges are not sent.
   */
  lookupVerifiedEmail?: (uid: string) => Promise<string | null | undefined>;
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

export function buildBrainNudgeCandidates(
  input: BuildBrainNudgeInput,
): BrainNudgeCandidate[] {
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
    (atman.emotionalState === "chaotic" ||
      atman.emotionalState === "depressive") &&
    // Respect quiet hours (08:00–21:00 local) and cap to once every 3 days so a
    // user whose state stays low isn't nudged across every channel daily.
    localHour >= 8 &&
    localHour < 21 &&
    !hasNudgeWithinDays(atman, "emotional_stabilization", 3, now)
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

  const morningRoutine = findIncompleteRoutine(
    atman.routines || [],
    "morning",
    localDate,
    timezone,
  );
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

  const pendingEvent = findPendingEventForFollowup(
    atman.activeEvents || atman.lifeEvents || [],
    now,
  );
  if (
    pendingEvent &&
    !hasNudgeForLocalDay(
      atman,
      `life_event_followup_${pendingEvent.id}`,
      localDate,
      timezone,
    )
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

  return candidates.sort(
    (a, b) => priorityScore(b.priority) - priorityScore(a.priority),
  );
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

  const docId = createNudgeDocId(candidate.localDate, candidate.triggerType);
  const nudgeRef = userRef.collection("brainNudges").doc(docId);
  const record = {
    uid: input.uid,
    ...candidate,
    createdAt: now,
    emailSent: false,
    pushSent: false,
    pushTokenCount: 0,
    whatsappSent: false,
    deliveryStatus: "claimed",
  };

  // Claim BEFORE sending anything: the brainNudges doc is written first (and
  // the nudge appended to Atman with field-level writes on fresh data), so a
  // crash or retry after delivery can never resend, and the slow sends below
  // never hold a stale copy of the user's memory that could be written back.
  const claim = await claimNudge(deps, {
    userRef,
    nudgeRef,
    record,
    candidate,
    now,
    initialUserData: userData,
  });
  if (!claim.claimed) {
    return {
      uid: input.uid,
      sent: false,
      emailSent: false,
      pushSent: false,
      whatsappSent: false,
      triggerType: candidate.triggerType,
      skippedReason: claim.reason,
    };
  }

  let emailSent = false;
  let emailError: string | undefined;
  // No List-Unsubscribe link (EMAIL_UNSUB_SECRET missing) → no email at all.
  const unsubscribeUrl = shouldEmailNudge(candidate, profile, input.sendEmail)
    ? (deps.unsubscribeUrlFor || resolveNudgeUnsubscribeUrl)(input.uid)
    : undefined;
  const emailTo =
    unsubscribeUrl && deps.sendEmail && deps.lookupVerifiedEmail
      ? await deps.lookupVerifiedEmail(input.uid).catch(() => null)
      : null;
  if (emailTo && unsubscribeUrl && deps.sendEmail) {
    try {
      await deps.sendEmail(
        buildNudgeEmail(
          emailTo,
          profile.name || "Friend",
          candidate,
          input.uid,
          unsubscribeUrl,
        ),
      );
      emailSent = true;
    } catch (error: any) {
      emailError = error?.message || "email_failed";
    }
  }

  let pushSent = false;
  let pushTokenCount = 0;
  let pushError: string | undefined;
  if (
    shouldPushNudge(candidate, profile) &&
    deps.loadPushTokens &&
    deps.sendPush
  ) {
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
  const whatsappNumber = profile.whatsappNumber;
  if (
    shouldWhatsAppNudge(candidate, profile) &&
    deps.sendWhatsApp &&
    whatsappNumber
  ) {
    try {
      await deps.sendWhatsApp(
        buildWhatsAppMessage(input.uid, whatsappNumber, candidate),
      );
      whatsappSent = true;
    } catch (error: any) {
      whatsappError = error?.message || "whatsapp_failed";
    }
  }

  // Delivery outcome only — the user's memory is never rewritten here.
  await nudgeRef.set(
    {
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

/**
 * Field-level Atman patch (for set-with-merge) that appends one nudge to the
 * history and ledger. Never carries the rest of the memory, so it cannot
 * bring back anything the user deleted.
 */
export function buildNudgeAtmanPatch(
  existingAtman: Partial<AtmanData> | undefined,
  candidate: BrainNudgeCandidate,
  now = new Date(),
): Record<string, unknown> {
  const atman = appendNudgeToAtman(existingAtman, candidate, now);
  return stripUndefined({
    schemaVersion: ATMAN_SCHEMA_VERSION,
    nudgeHistory: atman.nudgeHistory,
    memory: { nudgeHistory: atman.nudgeHistory },
    memoryLedger: atman.memoryLedger,
  });
}

type ClaimResult = { claimed: true } | { claimed: false; reason: string };

/**
 * Write the brainNudges/{docId} claim and append the nudge to Atman, before
 * any delivery. In production this is one transaction on fresh data: an
 * existing claim (an earlier or concurrent run) means skip, and the Atman
 * append re-reads the memory instead of reusing the snapshot taken before.
 */
async function claimNudge(
  deps: ProactiveBrainDeps,
  input: {
    userRef: UserDocRef;
    nudgeRef: BrainNudgeDocRef;
    record: Record<string, unknown>;
    candidate: BrainNudgeCandidate;
    now: Date;
    initialUserData: Record<string, unknown>;
  },
): Promise<ClaimResult> {
  const { userRef, nudgeRef, record, candidate, now } = input;
  if (typeof deps.db.runTransaction === "function") {
    return deps.db.runTransaction<ClaimResult>(async (tx) => {
      const existing = await tx.get(nudgeRef);
      if (existing.exists) return { claimed: false, reason: "already_claimed" };
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists) return { claimed: false, reason: "user_not_found" };
      const fresh = userSnap.data() || {};
      tx.set(nudgeRef, record);
      tx.set(
        userRef,
        {
          atman: buildNudgeAtmanPatch(
            fresh.atman as Partial<AtmanData> | undefined,
            candidate,
            now,
          ),
        },
        { merge: true },
      );
      return { claimed: true };
    });
  }

  // Fallback for test doubles without transactions.
  if (nudgeRef.get) {
    const existing = await nudgeRef.get();
    if (existing.exists) return { claimed: false, reason: "already_claimed" };
  }
  await nudgeRef.set(record);
  await userRef.set(
    {
      atman: buildNudgeAtmanPatch(
        input.initialUserData.atman as Partial<AtmanData> | undefined,
        candidate,
        now,
      ),
    },
    { merge: true },
  );
  return { claimed: true };
}

export function appendNudgeToAtman(
  existingAtman: Partial<AtmanData> | undefined,
  candidate: BrainNudgeCandidate,
  now = new Date(),
): AtmanData {
  const atman =
    normalizeAtmanData(existingAtman, now) || createInitialAtmanData(now);
  const safeNudge = validateNudgeInput(candidate);
  const entry: AtmanNudgeEntry = {
    ...safeNudge,
    date: now.toISOString(),
  };
  // Keep a wider window so per-trigger dedup/frequency checks see enough
  // history across multiple days and trigger types (was 20 — too small).
  atman.nudgeHistory = [...(atman.nudgeHistory || []).slice(-79), entry];
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
    confidence:
      candidate.priority === "high"
        ? 1
        : candidate.priority === "normal"
          ? 0.75
          : 0.5,
    patternsAdded: 0,
    eventsAdded: 0,
    adviceSaved: 0,
    contradictionsDetected: 0,
    karmicThreadsDetected: 0,
  };
  atman.memoryLedger = [...(atman.memoryLedger || []).slice(-49), ledgerEntry];
  return atman;
}

export function buildNudgeEmail(
  to: string,
  name: string,
  candidate: BrainNudgeCandidate,
  uid: string,
  unsubscribeUrl?: string,
): BrainNudgeEmail {
  const subject = `${name}, ${candidate.title}`;
  const settingsUrl = `${(process.env.APP_BASE_URL || "https://astroyou.app").replace(/\/$/, "")}/settings`;
  // Prefer the one-click unsubscribe link (no login) when available; fall back
  // to the settings page otherwise.
  const optOutUrl = unsubscribeUrl || settingsUrl;
  const optOutLabel = unsubscribeUrl
    ? "Unsubscribe"
    : "Manage or turn off notifications";
  const text = `${candidate.message}\n\nWhy this now: ${candidate.reason}\n\nUnsubscribe: ${optOutUrl}`;
  const html = `<div style="font-family:Inter,Arial,sans-serif;line-height:1.6;color:#f8f5ee;background:#08080d;padding:24px;border-radius:16px"><h2 style="color:#E5B96A;margin-top:0">${escapeHtml(candidate.title)}</h2><p>${escapeHtml(candidate.message)}</p><p style="color:#a7a2b8;font-size:13px">Why this now: ${escapeHtml(candidate.reason)}</p><p style="color:#6b6780;font-size:12px;margin-top:24px">You're receiving this because you enabled spiritual nudges. <a href="${optOutUrl}" style="color:#8a86a0">${optOutLabel}</a>.</p></div>`;
  return { to, subject, text, html, uid, unsubscribeUrl };
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
  const profile = (
    userData.profile && typeof userData.profile === "object"
      ? userData.profile
      : userData
  ) as Record<string, any>;
  return {
    name: profile.name || (userData.name as string | undefined),
    // Contact points are never read from the owner-writable doc fields
    // (email/phoneE164/whatsappNumber): email comes from the verified Auth
    // record at send time, WhatsApp only from the server-written
    // verifiedContacts field. See shared/verified-contact.ts.
    whatsappNumber: selectVerifiedWhatsAppNumber(userData) ?? undefined,
    timezone: profile.timezone || (userData.timezone as string | undefined),
    notificationPrefs: profile.notificationPrefs || userData.notificationPrefs,
  };
}

function shouldEmailNudge(
  candidate: BrainNudgeCandidate,
  profile: BrainNudgeProfile,
  sendEmail: boolean,
) {
  if (!sendEmail || candidate.priority !== "high") return false;
  if (!candidate.channels.includes("email")) return false;
  // Email is explicit opt-in (same rule as the scheduled digest).
  return profile.notificationPrefs?.emailDigest === true;
}

function shouldPushNudge(
  candidate: BrainNudgeCandidate,
  profile: BrainNudgeProfile,
) {
  if (!candidate.channels.includes("push")) return false;
  return profile.notificationPrefs?.pushBrainNudges !== false;
}

function shouldWhatsAppNudge(
  candidate: BrainNudgeCandidate,
  profile: BrainNudgeProfile,
) {
  if (!candidate.channels.includes("whatsapp")) return false;
  if (!profile.whatsappNumber) return false;
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
  if (input.emailSent || input.pushSent || input.whatsappSent)
    return "delivered";
  if (input.emailError || input.pushError || input.whatsappError)
    return "delivery_failed";
  return "stored";
}

function hasNudgeForLocalDay(
  atman: AtmanData,
  triggerType: string,
  localDate: string,
  timezone: string,
) {
  return (atman.nudgeHistory || []).some((entry) => {
    if (entry.triggerType !== triggerType) return false;
    return formatLocalDate(new Date(entry.date), timezone) === localDate;
  });
}

/** True if a nudge of this type was sent within the last `days` (frequency cap). */
function hasNudgeWithinDays(
  atman: AtmanData,
  triggerType: string,
  days: number,
  now: Date,
) {
  const cutoff = now.getTime() - days * 24 * 60 * 60 * 1000;
  return (atman.nudgeHistory || []).some(
    (entry) =>
      entry.triggerType === triggerType &&
      new Date(entry.date).getTime() >= cutoff,
  );
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
    return (
      formatLocalDate(new Date(routine.lastCompletedAt), timezone) !== localDate
    );
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
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120);
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
