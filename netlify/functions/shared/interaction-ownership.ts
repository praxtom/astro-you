/**
 * Gemini interaction ids act as bearer tokens: whoever presents one can chain
 * onto (read the context of) that interaction, and purging one deletes it.
 * So a client-supplied id is only honoured when it appears in the caller's
 * server-only log, users/{uid}/interactionLog (written by synthesis.ts each
 * turn via the Admin SDK; clients cannot write it). Client-writable fields —
 * request bodies, chat docs' lastInteractionId — are never trusted alone.
 */
import {
  isValidInteractionId,
  normalizeInteractionIds,
  MAX_PURGE_IDS,
} from "./interaction-retention.js";

/** Untrusted ids ∩ the caller's logged ids (validated, deduped, capped). */
export function ownedInteractionIds(
  candidates: unknown,
  logged: readonly string[],
  max = MAX_PURGE_IDS,
): string[] {
  const allowed = new Set(logged);
  return normalizeInteractionIds(candidates, max).filter((id) =>
    allowed.has(id),
  );
}

/** The client's previousInteractionId if (and only if) the caller logged it. */
export function resolvePreviousInteractionId(
  candidate: unknown,
  logged: readonly string[],
): string | undefined {
  return isValidInteractionId(candidate) && logged.includes(candidate)
    ? candidate
    : undefined;
}

type ChatTurn = { role: "user" | "assistant"; content: string };

/**
 * When a client sent only its latest turn (because it expected to chain on a
 * previousInteractionId that we refused), rebuild the visible transcript from
 * the `chatMessages` it also sent, so the reply keeps continuity.
 */
export function messagesWithoutChain(
  messages: ChatTurn[],
  chatMessages: unknown,
  maxTurns = 10,
): ChatTurn[] {
  if (messages.length !== 1 || !Array.isArray(chatMessages)) return messages;
  const prior = chatMessages.filter(
    (m: any): m is ChatTurn =>
      m &&
      (m.role === "user" || m.role === "assistant") &&
      typeof m.content === "string",
  );
  if (prior.length === 0) return messages;
  return [...prior, messages[0]].slice(-maxTurns);
}

const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;

/**
 * interactionLog doc id for a consultation session. Consult turns log under
 * `consult_<sessionId>` (beside the per-chat docs) so chaining can be verified
 * and account deletion purges them. Null for an invalid session id.
 */
export function consultInteractionLogId(sessionId: unknown): string | null {
  return typeof sessionId === "string" && SESSION_ID_PATTERN.test(sessionId)
    ? `consult_${sessionId}`
    : null;
}
