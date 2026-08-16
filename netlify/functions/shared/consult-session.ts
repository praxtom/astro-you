import { applyCreditChangeInTransaction } from "./credits.js";
import { PERSONAS } from "../../../src/lib/personas.js";

/**
 * Single source of truth for guides: the server registry is derived from the
 * client catalogue (`src/lib/personas.ts`) so a guide can never be listed in
 * the UI but rejected by `/api/consult/start` as "Unknown persona", and prices
 * can never drift between the card the user sees and the meter they are billed
 * on.
 */
export const CONSULT_PERSONAS: Record<
  string,
  { id: string; name: string; pricePerMin: number; promptModifier: string }
> = Object.fromEntries(
  PERSONAS.map((p) => [
    p.id,
    {
      id: p.id,
      name: p.name,
      pricePerMin: p.pricePerMin,
      promptModifier: p.promptModifier,
    },
  ]),
);

export type ConsultSessionStatus = "active" | "ended" | "failed" | "refunded";

export interface ConsultStartPayload {
  idToken: string;
  personaId: string;
  existingSessionId?: string;
  preferredLanguage?: string;
  /**
   * "Pick up a sitting that is already running, but never open a new one."
   * The client sets this on the mount-time resume path, where a stored session
   * id may already be dead (the `pagehide` beacon ends the sitting server-side
   * but deliberately keeps the id so a reload can resume). Without it, that
   * stale id falls through the resume check and a fresh meter starts while the
   * user is only reading — defeating "the meter starts on the first message".
   */
  resumeOnly?: boolean;
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

/**
 * A `resumeOnly` start that found nothing live to pick up. The request itself
 * succeeded — no session was created, nothing is being billed — so the client
 * simply stays in the pre-meter state and lets the first message open a fresh
 * sitting through the normal (non-`resumeOnly`) path.
 */
export interface ConsultNothingToResumeResult {
  success: true;
  resumed: false;
  sessionId: null;
}

export type ConsultStartResponse =
  ConsultStartResult | ConsultNothingToResumeResult;

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
  /**
   * Machine-readable context for the client (e.g. the id/persona of the session
   * that is blocking a new start), spread into the JSON error body by the
   * endpoint so the UI can offer "resume" or "end it" instead of a dead end.
   */
  details?: Record<string, unknown>;

  constructor(
    message: string,
    status: number,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ConsultSessionError";
    this.status = status;
    this.details = details;
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
    // Absent (or anything other than an explicit `true`) keeps the original
    // behaviour: a start that may create a session.
    resumeOnly: value.resumeOnly === true,
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

/**
 * The live billable-minute cap for a session: the greater of the cap reserved
 * at start and what the wallet funds *right now*. Reading it live means a
 * mid-session top-up actually extends the session instead of the meter staying
 * frozen at the balance the user happened to have when they pressed start.
 * Returns `undefined` when there is no cap to apply (zero funded minutes), so
 * callers can treat it as "no cap recorded" exactly as before.
 */
export function computeBillableCapMinutes(
  session: { maxBillableMinutes?: unknown; pricePerMin?: unknown },
  currentCredits: number,
  fallbackPricePerMin: number,
): number | undefined {
  const pricePerMin =
    typeof session.pricePerMin === "number" && session.pricePerMin > 0
      ? session.pricePerMin
      : fallbackPricePerMin;
  const startCap =
    typeof session.maxBillableMinutes === "number" &&
    Number.isFinite(session.maxBillableMinutes)
      ? Math.max(0, Math.floor(session.maxBillableMinutes))
      : 0;
  const credits = Number.isFinite(currentCredits)
    ? Math.max(0, currentCredits)
    : 0;
  const liveCap =
    pricePerMin > 0 ? Math.max(0, Math.floor(credits / pricePerMin)) : 0;

  return Math.max(startCap, liveCap) || undefined;
}

export function calculateConsultBill(
  startedAt: number,
  now: number,
  pricePerMin: number,
  maxBillableMinutes?: number,
  messageCount?: number,
) {
  const durationSeconds = Math.max(1, Math.round((now - startedAt) / 1000));

  // Zero-message waiver: a session where the user never sent anything (opened
  // the guide, changed their mind) cost us nothing and gave them nothing —
  // don't charge the one-minute minimum for it.
  if (messageCount === 0) {
    return { durationSeconds, minutes: 0, cost: 0 };
  }

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
): Promise<ConsultStartResponse> {
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

  return deps.db.runTransaction<ConsultStartResponse>(async (tx) => {
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
        // Hand back which session is blocking so the client can offer to resume
        // or end it rather than showing an unactionable error.
        throw new ConsultSessionError(
          "You already have an active consultation. Please end it before starting a new one.",
          409,
          {
            code: "active_session",
            activeSessionId: candidateId,
            activePersonaId: existing.personaId,
          },
        );
      }
      return {
        success: true as const,
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
    // No live session found. A resume-only start stops right here: the caller
    // is the page-mount path, and creating a session there would run the meter
    // while the user is merely reading a restored transcript.
    if (payload.resumeOnly) {
      return {
        success: true as const,
        resumed: false as const,
        sessionId: null,
      };
    }

    // Otherwise start fresh, overwriting the pointer below.

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
      success: true as const,
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
    const maxBillableMinutes = computeBillableCapMinutes(
      consultation,
      credits,
      persona.pricePerMin,
    );
    const { durationSeconds, minutes, cost } = calculateConsultBill(
      startedAtMs,
      now,
      pricePerMin,
      maxBillableMinutes,
      typeof consultation.messageCount === "number"
        ? consultation.messageCount
        : undefined,
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
