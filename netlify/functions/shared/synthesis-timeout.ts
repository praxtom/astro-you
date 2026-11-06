/**
 * What to do when a synthesis stream hits its time limit.
 *
 * Before the first token: nothing was delivered → refund (caller's job).
 * After text has streamed: the user already has (part of) a reply, so the
 * credit is kept and the turn finishes with the partial text plus a calm note.
 * Refunding there would make a deliberately slow / stalled stream free.
 */
export const PARTIAL_REPLY_NOTE =
  "\n\n_(This reply was cut short — the stars took a little long to answer. Ask me to continue whenever you're ready.)_";

/** Final content to deliver for a timed-out turn, or null → refund. */
export function partialReplyOnTimeout(streamedText: string): string | null {
  return streamedText.trim() ? streamedText + PARTIAL_REPLY_NOTE : null;
}
