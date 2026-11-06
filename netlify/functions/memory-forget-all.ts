import { Config, Context } from "@netlify/functions";
import { db } from "./shared/firebase-admin";
import {
  AuthError,
  enforceRateLimit,
  jsonResponse,
  requireAuthBody,
} from "./shared/require-auth";
import type { RetentionDb } from "./shared/interaction-retention";
import { purgeInteractionsBestEffort } from "./shared/interaction-purge";
import { forgetAllInteractions } from "./shared/forget-all-interactions";

/**
 * POST /api/memory/forget-all
 * Body: { idToken: string }
 *
 * Server half of "Forget everything" (AtmanMemoryControls.forgetEverything):
 * purges every stored Gemini interaction logged for the user — Google keeps
 * them (~55 days) for conversation chaining — and clears the interaction log.
 * The uid comes only from the verified token.
 */
export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method Not Allowed" }, 405);
  }

  let body: { idToken?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  try {
    const decoded = await requireAuthBody(body);
    await enforceRateLimit({
      scope: "memory_forget_all",
      key: decoded.uid,
      limit: 10,
      windowMs: 60 * 60 * 1000,
    });

    const result = await forgetAllInteractions(
      {
        db: db as unknown as RetentionDb,
        purge: (ids) =>
          purgeInteractionsBestEffort(ids, { requestUrl: req.url }),
      },
      decoded.uid,
    );
    return jsonResponse({ ok: true, ...result });
  } catch (err) {
    if (err instanceof AuthError) {
      return jsonResponse({ error: err.message }, err.status);
    }
    console.error(
      "[MemoryForgetAll] Failed:",
      err instanceof Error ? err.name : "error",
    );
    return jsonResponse(
      { error: "Could not clear stored conversation data" },
      500,
    );
  }
};

export const config: Config = { path: "/api/memory/forget-all" };
