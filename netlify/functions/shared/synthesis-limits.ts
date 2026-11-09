/**
 * Input bounds for anything we forward to the model.
 *
 * An unbounded transcript (or a single huge message) is a cheap way to run up
 * our Gemini bill on one credit, and can blow the model's context window.
 * Every surface that streams a user-supplied transcript to Gemini — the
 * Synthesis chat and the paid consultations — must apply the same limits
 * BEFORE any generation call, which is why they live in a shared module
 * rather than inside one function.
 */

/** Per-message character cap for anything we forward to the model. */
export const MAX_SYNTHESIS_MESSAGE_CHARS = 8000;

/** Maximum number of messages accepted in a single synthesis payload. */
export const MAX_SYNTHESIS_MESSAGES = 60;

/**
 * True when `value` is within the prompt-size budget.
 *
 * A non-array passes: payload *shape* is validated by the caller, and this
 * guard only answers "is this too big?". Entries whose `content` is not a
 * string are likewise left to shape validation.
 */
export function isWithinSynthesisInputLimits(value: unknown): boolean {
  if (!Array.isArray(value)) return true;
  if (value.length > MAX_SYNTHESIS_MESSAGES) return false;
  return value.every(
    (message) =>
      typeof message?.content !== "string" ||
      message.content.length <= MAX_SYNTHESIS_MESSAGE_CHARS,
  );
}

/**
 * Fair-use ceiling for paid subscribers, whose chat is otherwise unmetered
 * (they are also held to the hourly cap). Override with the
 * SUBSCRIBER_DAILY_MESSAGE_CAP env var.
 */
export const DEFAULT_SUBSCRIBER_DAILY_MESSAGE_CAP = 150;

export function resolveSubscriberDailyCap(
  raw: unknown = process.env.SUBSCRIBER_DAILY_MESSAGE_CAP,
): number {
  if (raw === undefined || raw === null || raw === "") {
    return DEFAULT_SUBSCRIBER_DAILY_MESSAGE_CAP;
  }
  const value = typeof raw === "string" ? Number(raw.trim()) : Number(raw);
  return Number.isInteger(value) && value > 0
    ? value
    : DEFAULT_SUBSCRIBER_DAILY_MESSAGE_CAP;
}

/** Kind copy for a subscriber who reached the daily fair-use ceiling. */
export function subscriberFairUseMessage(cap: number): string {
  return `You've had a deep day of conversation — ${cap} messages, the daily fair-use limit on your plan. Let today's guidance settle; your chat opens again tomorrow.`;
}
