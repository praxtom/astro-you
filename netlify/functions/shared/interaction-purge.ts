import { deleteGeminiInteraction } from "./gemini.js";
import { dispatchBackgroundJob } from "./internal-dispatch.js";
import {
  deleteInteractions,
  normalizeInteractionIds,
} from "./interaction-retention.js";

export const INTERACTION_PURGE_FUNCTION = "interaction-purge-background";

/**
 * Best-effort purge of Gemini interactions. Hands the ids to the background
 * function (fast 202, no timeout pressure on the caller); if that can't be
 * reached, deletes inline within a short time budget. Never throws.
 */
export async function purgeInteractionsBestEffort(
  ids: unknown,
  options: { requestUrl?: string; inlineBudgetMs?: number } = {},
): Promise<{ queued: number; mode: "none" | "background" | "inline" }> {
  const clean = normalizeInteractionIds(ids);
  if (clean.length === 0) return { queued: 0, mode: "none" };
  try {
    const accepted = await dispatchBackgroundJob(
      INTERACTION_PURGE_FUNCTION,
      { ids: clean },
      { requestUrl: options.requestUrl },
    );
    if (accepted) return { queued: clean.length, mode: "background" };
    await deleteInteractions(clean, deleteGeminiInteraction, {
      budgetMs: options.inlineBudgetMs ?? 5_000,
    });
  } catch (err) {
    console.warn(
      "[InteractionPurge] Purge failed:",
      err instanceof Error ? err.name : "error",
    );
  }
  return { queued: clean.length, mode: "inline" };
}
