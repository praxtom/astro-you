/**
 * Post-processing for a synthesis turn — everything that is NOT the reply:
 * consciousness analysis, advice extraction, Atman persistence and the
 * rolling chat summary. It runs OFF the response path (background function,
 * or after the stream closed), so the user's "done" never waits on it.
 *
 * Pure orchestration with injected dependencies so it is unit-testable.
 */

export const SYNTHESIS_POSTPROCESS_FUNCTION =
  "synthesis-postprocess-background";

/** Summarise on the 2nd user turn, then every 4th (2, 6, 10, …). */
export const SUMMARY_EVERY_N_TURNS = 4;

/**
 * `messageCount` is the number of visible messages BEFORE this turn (both
 * roles), as sent by the client. Completed exchanges = floor(count / 2).
 */
export function shouldSummarizeTurn(messageCount: unknown): boolean {
  const count =
    typeof messageCount === "number" ? messageCount : Number(messageCount);
  if (!Number.isFinite(count) || count < 2) return false;
  const exchanges = Math.floor(count / 2);
  return (exchanges - 1) % SUMMARY_EVERY_N_TURNS === 0;
}

type ChatMessage = { role: string; content: string };

export interface SynthesisPostprocessJob {
  uid: string;
  chatId?: string;
  interactionId?: string;
  userMessage: string;
  assistantMessage: string;
  /** Last few turns for consciousness analysis. */
  analysisMessages: ChatMessage[];
  /** Bounded transcript for the summary; omitted when not summarising. */
  summaryMessages?: ChatMessage[];
  /** Minimal context the analysis prompt needs (name + atman). */
  context: { name: string; atman?: unknown };
}

export interface SynthesisPostprocessDeps {
  isMemoryPaused(uid: string): Promise<boolean>;
  analyze(
    messages: ChatMessage[],
    context: SynthesisPostprocessJob["context"],
  ): Promise<any>;
  extractAdvice(
    assistantMessage: string,
    userMessage: string,
  ): Promise<{ advice: string; context: string } | null>;
  persistInsights(input: {
    uid: string;
    chatId?: string;
    analysisResult: any;
    extractedAdvice: { advice: string; context: string } | null;
    interactionId?: string;
    userMessage: string;
    assistantMessage: string;
  }): Promise<unknown>;
  readChatSummary(uid: string, chatId: string): Promise<string | undefined>;
  summarize(
    messages: ChatMessage[],
    userName: string,
    previousSummary?: string,
  ): Promise<string>;
  /** Must NOT create the chat doc if it was deleted meanwhile. */
  writeChatSummary(uid: string, chatId: string, summary: string): Promise<void>;
}

export interface SynthesisPostprocessResult {
  skipped?: "memory_paused" | "invalid";
  brainUpdated: boolean;
  summaryWritten: boolean;
}

const safe = async <T>(
  label: string,
  p: () => Promise<T>,
): Promise<T | null> => {
  try {
    return await p();
  } catch (err: any) {
    // Error name only — AI SDK messages can echo personal prompt content.
    console.warn(
      `[SynthesisPostprocess] ${label} failed:`,
      err?.name || "error",
    );
    return null;
  }
};

export function isValidPostprocessJob(
  job: any,
): job is SynthesisPostprocessJob {
  return Boolean(
    job &&
    typeof job.uid === "string" &&
    job.uid &&
    typeof job.userMessage === "string" &&
    typeof job.assistantMessage === "string" &&
    Array.isArray(job.analysisMessages) &&
    job.context &&
    typeof job.context.name === "string",
  );
}

export async function runSynthesisPostprocess(
  job: SynthesisPostprocessJob,
  deps: SynthesisPostprocessDeps,
): Promise<SynthesisPostprocessResult> {
  if (!isValidPostprocessJob(job)) {
    return { skipped: "invalid", brainUpdated: false, summaryWritten: false };
  }
  // Re-check at processing time: the user may have paused memory since the
  // request started. Fail closed — if we can't confirm, don't write.
  const paused = await safe("memoryPaused lookup", () =>
    deps.isMemoryPaused(job.uid),
  );
  if (paused !== false) {
    return {
      skipped: "memory_paused",
      brainUpdated: false,
      summaryWritten: false,
    };
  }

  const chatId = job.chatId || undefined;
  const wantsSummary = Boolean(chatId && job.summaryMessages?.length);

  const [analysisResult, extractedAdvice, summaryWritten] = await Promise.all([
    safe("analysis", () => deps.analyze(job.analysisMessages, job.context)),
    safe("advice", () =>
      deps.extractAdvice(job.assistantMessage, job.userMessage),
    ),
    wantsSummary
      ? safe("summary", async () => {
          const previous = await deps
            .readChatSummary(job.uid, chatId!)
            .catch(() => undefined);
          const summary = await deps.summarize(
            job.summaryMessages!,
            job.context.name,
            previous,
          );
          if (!summary) return false;
          await deps.writeChatSummary(job.uid, chatId!, summary);
          return true;
        })
      : Promise.resolve(false),
  ]);

  const persisted: any = await safe("persist", () =>
    deps.persistInsights({
      uid: job.uid,
      chatId,
      analysisResult,
      extractedAdvice,
      interactionId: job.interactionId,
      userMessage: job.userMessage,
      assistantMessage: job.assistantMessage,
    }),
  );

  return {
    brainUpdated: Boolean(persisted?.persisted),
    summaryWritten: summaryWritten === true,
  };
}

/**
 * Close out a turn: the "done" event is flushed and the stream closed BEFORE
 * any post-processing starts. When the runtime offers waitUntil, the
 * after-response work outlives the response; otherwise it is awaited before
 * close (the only way to keep the function alive) — still after "done".
 */
export async function finishSynthesisTurn(input: {
  sendDone: () => void;
  close: () => void;
  afterResponse: () => Promise<unknown>;
  waitUntil?: (promise: Promise<unknown>) => void;
}): Promise<void> {
  input.sendDone();
  const run = () =>
    input.afterResponse().catch((err: any) => {
      console.warn(
        "[Synthesis] After-response work failed:",
        err?.name || "error",
      );
    });
  if (typeof input.waitUntil === "function") {
    input.close();
    input.waitUntil(run());
    return;
  }
  await run();
  input.close();
}
