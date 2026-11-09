/**
 * Shared streaming plumbing for every chat surface that talks to Gemini
 * (the Synthesis chat and paid consultations):
 *
 * - isCrisisTurn / crisisSafetyResponse: the deterministic self-harm screen and
 *   its fixed reply. Callers check it BEFORE any credit, meter or model call.
 * - createChatSseStream: an SSE ReadableStream with an immediate open comment,
 *   keepalive comments (so the CDN never sees an idle connection), and an
 *   AbortController that fires when the client disconnects.
 * - consumeChatStream: drains a synthesizeStream iterator under a first-token
 *   and a total deadline, aborting the upstream request on timeout.
 */
import { CRISIS_SAFETY_REPLY, detectCrisisRisk } from "./safety.js";
import { stripHiddenTags } from "./chat-tags.js";
import {
  raceWithTimeout,
  SSE_KEEPALIVE_COMMENT,
  SSE_OPEN_COMMENT,
  SYNTHESIS_FIRST_TOKEN_TIMEOUT_MS,
  SYNTHESIS_KEEPALIVE_MS,
  SYNTHESIS_TOTAL_TIMEOUT_MS,
  TIMED_OUT,
} from "./synthesis-stream.js";
import { partialReplyOnTimeout } from "./synthesis-timeout.js";
import type { SynthesisStreamEvent } from "./gemini.js";

export const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
};

/**
 * True when the turn being answered reads as a self-harm / suicide statement.
 * Screens the final message and the latest user-role message (they differ only
 * for a malformed transcript, which must not be a way around the screen).
 */
export function isCrisisTurn(messages: unknown): boolean {
  if (!Array.isArray(messages) || messages.length === 0) return false;
  const last = messages[messages.length - 1];
  if (detectCrisisRisk(last?.content)) return true;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === "user")
      return detectCrisisRisk(messages[i].content);
  }
  return false;
}

export function sseFrame(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

/**
 * Fixed safety reply, streamed in the same SSE format the clients parse.
 * No model call, no charge, no memory writes. `doneFields` lets each surface
 * add the keys its client expects on `done`.
 */
export function crisisSafetyResponse(
  doneFields: Record<string, unknown> = {},
): Response {
  const encoder = new TextEncoder();
  const readable = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(SSE_OPEN_COMMENT));
      controller.enqueue(
        encoder.encode(sseFrame({ type: "delta", text: CRISIS_SAFETY_REPLY })),
      );
      controller.enqueue(
        encoder.encode(
          sseFrame({
            type: "done",
            content: CRISIS_SAFETY_REPLY,
            interactionId: null,
            suggestedRoutine: null,
            ...doneFields,
            safety: "crisis",
          }),
        ),
      );
      controller.close();
    },
  });
  return new Response(readable, { status: 200, headers: SSE_HEADERS });
}

export interface ChatSseChannel {
  /** Send one `data:` event. A no-op once the stream is closed/cancelled. */
  send(data: unknown): void;
  /** Close the stream (idempotent) and stop the keepalive. */
  close(): void;
  /** True once closed by us or cancelled by the client. */
  isClosed(): boolean;
  /** Aborted when the client disconnects — pass to the model call. */
  abortController: AbortController;
}

/**
 * SSE stream with open comment + keepalive + client-disconnect abort. `run`
 * drives the turn; if it throws, the stream is closed (the caller is expected
 * to have sent its own error event first).
 */
export function createChatSseStream(
  run: (channel: ChatSseChannel) => Promise<void>,
  { keepaliveMs = SYNTHESIS_KEEPALIVE_MS }: { keepaliveMs?: number } = {},
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const abortController = new AbortController();
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let closed = false;

  const stopHeartbeat = () => {
    if (heartbeat) clearInterval(heartbeat);
    heartbeat = undefined;
  };

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const enqueueRaw = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closed = true;
        }
      };
      const channel: ChatSseChannel = {
        send: (data) => enqueueRaw(sseFrame(data)),
        close: () => {
          stopHeartbeat();
          if (closed) return;
          closed = true;
          try {
            controller.close();
          } catch {
            // already closed / cancelled
          }
        },
        isClosed: () => closed,
        abortController,
      };

      enqueueRaw(SSE_OPEN_COMMENT);
      heartbeat = setInterval(
        () => enqueueRaw(SSE_KEEPALIVE_COMMENT),
        keepaliveMs,
      );

      try {
        await run(channel);
      } catch (error: any) {
        console.error(
          "[ChatStream] Unhandled turn error:",
          error?.name || "error",
        );
      } finally {
        channel.close();
      }
    },
    cancel() {
      // Client disconnected — stop the keepalive and the upstream model call.
      closed = true;
      stopHeartbeat();
      abortController.abort();
    },
  });
}

export class ChatStreamTimeoutError extends Error {
  constructor() {
    super("synthesis_timeout");
    this.name = "ChatStreamTimeoutError";
  }
}

export interface ConsumedChatTurn {
  content: string;
  interactionId: string;
  suggestedRoutine?: unknown;
  chips: string[];
  /** True when the client disconnected before the model finished. */
  aborted: boolean;
}

/**
 * Drain a synthesizeStream iterator, forwarding each visible delta. Throws
 * ChatStreamTimeoutError (after aborting the upstream request) when the first
 * token or the whole reply misses its deadline.
 */
export async function consumeChatStream(
  iterator: AsyncIterator<SynthesisStreamEvent>,
  {
    abortController,
    onDelta,
    firstTokenTimeoutMs = SYNTHESIS_FIRST_TOKEN_TIMEOUT_MS,
    totalTimeoutMs = SYNTHESIS_TOTAL_TIMEOUT_MS,
    now = Date.now,
  }: {
    abortController: AbortController;
    onDelta: (text: string) => void;
    firstTokenTimeoutMs?: number;
    totalTimeoutMs?: number;
    now?: () => number;
  },
): Promise<ConsumedChatTurn> {
  const startedAt = now();
  let gotFirstToken = false;
  const turn: ConsumedChatTurn = {
    content: "",
    interactionId: "",
    chips: [],
    aborted: false,
  };

  while (true) {
    const deadline =
      startedAt +
      (gotFirstToken
        ? totalTimeoutMs
        : Math.min(firstTokenTimeoutMs, totalTimeoutMs));
    const next = await raceWithTimeout(iterator.next(), deadline - now());
    if (next === TIMED_OUT) {
      abortController.abort();
      void iterator.return?.(undefined)?.catch(() => undefined);
      throw new ChatStreamTimeoutError();
    }
    if (next.done) break;
    const event = next.value;
    if (event.type === "delta") {
      gotFirstToken = true;
      onDelta(event.text);
    } else if (event.type === "complete") {
      turn.content = event.content;
      turn.interactionId = event.interactionId;
      turn.suggestedRoutine = event.suggestedRoutine;
      turn.chips = Array.isArray(event.chips) ? event.chips : [];
    }
  }
  turn.aborted = abortController.signal.aborted;
  return turn;
}

/**
 * Final content for a turn that timed out after text had streamed, with any
 * hidden-tag fragment removed, or null when nothing visible was delivered.
 */
export function partialChatReply(streamedText: string): string | null {
  return partialReplyOnTimeout(stripHiddenTags(streamedText));
}
