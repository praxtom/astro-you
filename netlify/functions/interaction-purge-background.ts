import { deleteGeminiInteraction } from "./shared/gemini";
import { isAuthorizedInternalRequest } from "./shared/internal-dispatch";
import {
  deleteInteractions,
  normalizeInteractionIds,
} from "./shared/interaction-retention";

/**
 * Background function (15-min budget): deletes stored Gemini interactions
 * after a chat or account deletion. Internal-only — requires the shared
 * internal secret header. Netlify answers the caller 202 immediately.
 */
export default async (req: Request) => {
  if (req.method !== "POST" || !isAuthorizedInternalRequest(req)) {
    return new Response("Forbidden", { status: 403 });
  }
  let body: { ids?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response("Bad Request", { status: 400 });
  }
  const ids = normalizeInteractionIds(body.ids);
  const result = await deleteInteractions(ids, deleteGeminiInteraction, {
    budgetMs: 10 * 60 * 1000,
  });
  console.info(
    `[InteractionPurge] deleted=${result.deleted} failed=${result.failed} skipped=${result.skipped}`,
  );
  return new Response(null, { status: 202 });
};
