import { applyCreditChangeInTransaction } from "./credits.js";

export const PERSONA_PRICES: Record<string, number> = {
  "guru-vidyanath": 5,
  "arjun-sharma": 8,
  "meera-devi": 5,
  "pandit-raghunath": 10,
  "dr-shanti": 8,
  "nanda-ji": 5,
};

export const CONSULT_PERSONAS: Record<
  string,
  { id: string; name: string; pricePerMin: number; promptModifier: string }
> = {
  "guru-vidyanath": {
    id: "guru-vidyanath",
    name: "Guru Vidyanath",
    pricePerMin: 5,
    promptModifier:
      "You are a spiritual guru. Focus on soul evolution, karma, meditation practices, and inner peace. Use gentle wisdom. Suggest mantras and breathing exercises when appropriate.",
  },
  "arjun-sharma": {
    id: "arjun-sharma",
    name: "Arjun Sharma",
    pricePerMin: 8,
    promptModifier:
      "You are a career and finance astrologer. Focus on professional growth, business timing, investments, and wealth yogas. Give actionable advice with specific timeframes based on dashas and transits.",
  },
  "meera-devi": {
    id: "meera-devi",
    name: "Meera Devi",
    pricePerMin: 5,
    promptModifier:
      "You are a relationship astrologer. Focus on love, compatibility, marriage timing, and emotional healing. Be empathetic. Reference Venus, Moon, and 7th house placements. Give hope but be honest about challenges.",
  },
  "pandit-raghunath": {
    id: "pandit-raghunath",
    name: "Pandit Raghunath",
    pricePerMin: 10,
    promptModifier:
      "You are a traditional Vedic Jyotish pandit. Use classical terminology. Focus on doshas (Manglik, Sade Sati, Kaal Sarpa), remedies (gemstones, mantras, pujas), and muhurat selection. Reference shastras when relevant.",
  },
  "dr-shanti": {
    id: "dr-shanti",
    name: "Dr. Shanti",
    pricePerMin: 8,
    promptModifier:
      "You are a health and wellness astrologer. Focus on medical astrology, Ayurvedic constitution (dosha), health timing, and preventive care. Reference 6th house, Saturn, and Mars placements for health insights. Never diagnose - suggest consulting doctors for serious concerns.",
  },
  "nanda-ji": {
    id: "nanda-ji",
    name: "Nanda Ji",
    pricePerMin: 5,
    promptModifier:
      "You are a practical life advisor using astrology. Focus on family matters, property decisions, children's education, travel timing, and muhurat selection. Be warm and reassuring. Give specific date/time recommendations when possible.",
  },
};

export type ConsultSessionStatus = "active" | "ended" | "failed" | "refunded";

export interface ConsultStartPayload {
  idToken: string;
  personaId: string;
  existingSessionId?: string;
  preferredLanguage?: string;
}

export interface ConsultStartResult {
  success: true;
  sessionId: string;
  personaId: string;
  startedAt: number;
  pricePerMin: number;
  credits: number;
  estimatedMinutes: number;
  preferredLanguage: string;
}

export interface ConsultEndPayload {
  idToken: string;
  sessionId: string;
  messageCount: number;
}

export interface FinalizeConsultParams {
  uid: string;
  sessionId: string;
  messageCount?: number;
  /** Why the session is being closed — "client_end" (user left the chat) or "auto_timeout" (server reaper). */
  reason?: string;
}

export interface ConsultEndResult {
  success: true;
  durationSeconds: number;
  minutes: number;
  cost: number;
}

interface AuthLike {
  verifyIdToken(idToken: string): Promise<{ uid: string }>;
}

interface DocumentRefLike {
  collection(name: string): CollectionRefLike;
  id?: string;
  path?: string;
}

interface CollectionRefLike {
  doc(id?: string): DocumentRefLike;
}

interface DocumentSnapshotLike {
  exists?: boolean;
  data(): Record<string, any> | undefined;
}

interface TransactionLike {
  get(ref: DocumentRefLike): Promise<DocumentSnapshotLike>;
  update(ref: DocumentRefLike, data: Record<string, unknown>): void;
  set(
    ref: DocumentRefLike,
    data: Record<string, unknown>,
    options?: { merge?: boolean },
  ): void;
}

interface DbLike {
  collection(name: string): CollectionRefLike;
  runTransaction<T>(callback: (tx: TransactionLike) => Promise<T>): Promise<T>;
}

interface FieldValueLike {
  increment(value: number): unknown;
  serverTimestamp(): unknown;
}

export interface ConsultSessionDeps {
  auth: AuthLike;
  db: DbLike;
  FieldValue: FieldValueLike;
  now?: () => number;
}

export class ConsultSessionError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ConsultSessionError";
    this.status = status;
  }
}

export function getConsultPersona(personaId: string) {
  return CONSULT_PERSONAS[personaId];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizePreferredLanguage(value: unknown) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, 40);
}

export function parseConsultStartPayload(value: unknown): ConsultStartPayload {
  if (!isRecord(value)) {
    throw new ConsultSessionError("Missing session data", 400);
  }

  if (
    typeof value.idToken !== "string" ||
    !value.idToken ||
    typeof value.personaId !== "string" ||
    !value.personaId
  ) {
    throw new ConsultSessionError("Missing session data", 400);
  }

  return {
    idToken: value.idToken,
    personaId: value.personaId,
    existingSessionId:
      typeof value.existingSessionId === "string" && value.existingSessionId
        ? value.existingSessionId
        : undefined,
    preferredLanguage: normalizePreferredLanguage(value.preferredLanguage),
  };
}

export function parseConsultEndPayload(value: unknown): ConsultEndPayload {
  if (!isRecord(value)) {
    throw new ConsultSessionError("Missing session data", 400);
  }

  const messageCount =
    typeof value.messageCount === "number" &&
    Number.isFinite(value.messageCount)
      ? Math.max(0, Math.floor(value.messageCount))
      : 0;

  if (
    typeof value.idToken !== "string" ||
    !value.idToken ||
    typeof value.sessionId !== "string" ||
    !value.sessionId
  ) {
    throw new ConsultSessionError("Missing session data", 400);
  }

  return {
    idToken: value.idToken,
    sessionId: value.sessionId,
    messageCount,
  };
}

/**
 * How much to actually charge at finalize when the wallet may no longer cover
 * the metered cost. Never negative, never more than the wallet — and never
 * free while the user still has balance, otherwise a user could drain their
 * credits mid-session (e.g. via synthesis) and walk away with a free
 * consultation. `underbilled` is true when the charge is below the metered
 * cost.
 */
export function calculateConsultCharge(
  cost: number,
  availableCredits: number,
): { charge: number; underbilled: boolean } {
  const balance = Math.max(0, Math.floor(availableCredits));
  const charge = Math.min(Math.max(0, cost), balance);
  return { charge, underbilled: charge < cost };
}

export function calculateConsultBill(
  startedAt: number,
  now: number,
  pricePerMin: number,
  maxBillableMinutes?: number,
) {
  const durationSeconds = Math.max(1, Math.round((now - startedAt) / 1000));
  const elapsedMinutes = Math.max(1, Math.ceil(durationSeconds / 60));
  const minutes = maxBillableMinutes
    ? Math.min(elapsedMinutes, maxBillableMinutes)
    : elapsedMinutes;
  const cost = minutes * pricePerMin;

  return { durationSeconds, minutes, cost };
}

export async function startConsultSession(
  deps: ConsultSessionDeps,
  rawPayload: unknown,
): Promise<ConsultStartResult> {
  const payload = parseConsultStartPayload(rawPayload);
  const persona = getConsultPersona(payload.personaId);

  if (!persona) {
    throw new ConsultSessionError("Unknown persona", 400);
  }

  const decoded = await deps.auth.verifyIdToken(payload.idToken);
  const uid = decoded.uid;
  const now = deps.now?.() ?? Date.now();
  const userRef = deps.db.collection("users").doc(uid);
  const preferredLanguage = payload.preferredLanguage || "English";

  return deps.db.runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef);
    const userData = userSnap.data();
    const credits = userData?.credits ?? 0;

    // Single active consultation per user. `activeConsultSessionId` on the user
    // doc is the lock: because a new session writes it, two parallel starts both
    // write the user doc and Firestore serializes them — the loser retries, sees
    // the pointer, and resumes/rejects instead of opening a second meter. This
    // closes the abuse where K parallel sessions each reserve the full balance
    // (maxBillableMinutes = floor(credits/price)) but only the first bills it.
    const pointerId =
      typeof userData?.activeConsultSessionId === "string"
        ? userData.activeConsultSessionId
        : undefined;

    // Check the pointer FIRST — it is the authoritative lock. If the
    // client-supplied existingSessionId took precedence, a stale/ended id
    // would fall through the resume check and open a second live meter next
    // to the pointer's still-active session, resurrecting the parallel-billing
    // abuse. The payload id is only consulted as a legacy fallback (sessions
    // created before the pointer existed).
    const candidateIds = [pointerId, payload.existingSessionId].filter(
      (id, idx, arr): id is string => Boolean(id) && arr.indexOf(id) === idx,
    );

    for (const candidateId of candidateIds) {
      const resumeRef = userRef.collection("consultations").doc(candidateId);
      const resumeSnap = await tx.get(resumeRef);
      const existing = resumeSnap.data();
      const isActive =
        resumeSnap.exists !== false &&
        existing?.status === "active" &&
        typeof existing.startedAtMs === "number";

      if (!isActive) continue; // stale (ended/missing) — try next candidate

      if (existing.personaId !== persona.id) {
        // A different persona's meter is already running — one at a time.
        throw new ConsultSessionError(
          "You already have an active consultation. Please end it before starting a new one.",
          409,
        );
      }
      return {
        success: true,
        sessionId: candidateId,
        personaId: persona.id,
        startedAt: existing.startedAtMs,
        pricePerMin: existing.pricePerMin ?? persona.pricePerMin,
        credits,
        estimatedMinutes: existing.maxBillableMinutes ?? 1,
        preferredLanguage:
          normalizePreferredLanguage(existing.preferredLanguage) ||
          preferredLanguage,
      };
    }
    // No live session found — start fresh, overwriting the pointer below.

    const estimatedMinutes = Math.floor(credits / persona.pricePerMin);

    if (estimatedMinutes < 1) {
      throw new ConsultSessionError(
        "Insufficient credits to start this consultation",
        402,
      );
    }

    const consultationRef = userRef.collection("consultations").doc();
    tx.set(consultationRef, {
      personaId: persona.id,
      status: "active",
      startedAt: deps.FieldValue.serverTimestamp(),
      startedAtMs: now,
      pricePerMin: persona.pricePerMin,
      reservedCredits: credits,
      maxBillableMinutes: estimatedMinutes,
      preferredLanguage,
      messageCount: 0,
      createdAt: deps.FieldValue.serverTimestamp(),
      updatedAt: deps.FieldValue.serverTimestamp(),
    });
    tx.set(
      userRef,
      { activeConsultSessionId: consultationRef.id || "" },
      { merge: true },
    );

    return {
      success: true,
      sessionId: consultationRef.id || "",
      personaId: persona.id,
      startedAt: now,
      pricePerMin: persona.pricePerMin,
      credits,
      estimatedMinutes,
      preferredLanguage,
    };
  });
}

export async function endConsultSession(
  deps: ConsultSessionDeps,
  rawPayload: unknown,
): Promise<ConsultEndResult> {
  const payload = parseConsultEndPayload(rawPayload);
  const decoded = await deps.auth.verifyIdToken(payload.idToken);
  return finalizeConsultSession(deps, {
    uid: decoded.uid,
    sessionId: payload.sessionId,
    messageCount: payload.messageCount,
    reason: "client_end",
  });
}

/**
 * Server-authoritative billing for a consultation, keyed directly by uid.
 * Used by the client-driven `endConsultSession` (after token verification) and
 * by the scheduled reaper that closes abandoned sessions — so a user who closes
 * the tab without calling /api/consult/end is still billed for what they used.
 */
export async function finalizeConsultSession(
  deps: ConsultSessionDeps,
  params: FinalizeConsultParams,
): Promise<ConsultEndResult> {
  const uid = params.uid;
  const now = deps.now?.() ?? Date.now();

  const userRef = deps.db.collection("users").doc(uid);
  const consultationRef = userRef
    .collection("consultations")
    .doc(params.sessionId);

  return deps.db.runTransaction<ConsultEndResult>(async (tx) => {
    const userSnap = await tx.get(userRef);
    const consultationSnap = await tx.get(consultationRef);
    const consultation = consultationSnap.data();

    // Release the single-active-session lock if it points at this session, so
    // the user can start a new consultation after this one closes. Deferred as a
    // write until after all reads (Firestore requires reads before writes).
    const releasesLock =
      userSnap.data()?.activeConsultSessionId === params.sessionId;
    const releaseLock = () => {
      if (releasesLock) {
        tx.set(userRef, { activeConsultSessionId: null }, { merge: true });
      }
    };

    if (consultationSnap.exists === false || !consultation) {
      throw new ConsultSessionError("Consultation session not found", 404);
    }

    if (consultation.status === "ended") {
      releaseLock();
      return {
        success: true as const,
        durationSeconds: consultation.duration,
        minutes: consultation.minutes,
        cost: consultation.cost,
      };
    }

    if (consultation.status !== "active") {
      throw new ConsultSessionError("Consultation session is not active", 409);
    }

    const persona = getConsultPersona(String(consultation.personaId || ""));
    if (!persona) {
      throw new ConsultSessionError("Unknown persona", 400);
    }

    const startedAtMs =
      typeof consultation.startedAtMs === "number"
        ? consultation.startedAtMs
        : 0;
    if (!startedAtMs) {
      throw new ConsultSessionError(
        "Consultation session is missing start time",
        400,
      );
    }

    const pricePerMin =
      typeof consultation.pricePerMin === "number"
        ? consultation.pricePerMin
        : persona.pricePerMin;
    const credits = userSnap.data()?.credits ?? 0;
    const startingBalanceBillableMinutes =
      typeof consultation.maxBillableMinutes === "number"
        ? consultation.maxBillableMinutes
        : 0;
    const currentBalanceBillableMinutes = Math.floor(credits / pricePerMin);
    const maxBillableMinutes =
      Math.max(startingBalanceBillableMinutes, currentBalanceBillableMinutes) ||
      undefined;
    const { durationSeconds, minutes, cost } = calculateConsultBill(
      startedAtMs,
      now,
      pricePerMin,
      maxBillableMinutes,
    );

    // Partial billing: if the wallet no longer covers the metered cost
    // (e.g. credits were spent elsewhere mid-session), charge whatever
    // balance remains — never negative, and never free while balance > 0.
    const { charge, underbilled } = calculateConsultCharge(cost, credits);

    if (charge > 0) {
      await applyCreditChangeInTransaction(
        tx,
        { FieldValue: deps.FieldValue },
        userRef,
        {
          uid,
          amount: -charge,
          type: "consultation",
          source: "consult_end",
          referenceId: params.sessionId,
          ledgerId: `consultation_${params.sessionId}`,
          metadata: {
            personaId: persona.id,
            minutes,
            durationSeconds,
            reason: params.reason ?? "client_end",
            ...(underbilled ? { underbilled: true, meteredCost: cost } : {}),
          },
        },
        credits,
      );
    }
    tx.update(consultationRef, {
      status: "ended",
      endReason: params.reason ?? "client_end",
      endedAt: deps.FieldValue.serverTimestamp(),
      endedAtMs: now,
      duration: durationSeconds,
      minutes,
      // The actual amount charged; `meteredCost` records the full price.
      cost: charge,
      ...(underbilled ? { underbilled: true, meteredCost: cost } : {}),
      pricePerMin,
      maxBillableMinutes,
      messageCount: consultation.messageCount ?? params.messageCount ?? 0,
      updatedAt: deps.FieldValue.serverTimestamp(),
    });
    releaseLock();

    return { success: true as const, durationSeconds, minutes, cost: charge };
  });
}
