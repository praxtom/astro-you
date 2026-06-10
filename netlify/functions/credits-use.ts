import { Config, Context } from "@netlify/functions";
import { auth, db, FieldValue } from "./shared/firebase-admin";
import { applyCreditChange } from "./shared/credits";

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const { idToken, source: rawSource } = await req.json();
    if (!idToken) {
      return json({ error: "Missing auth token" }, 401);
    }

    // `source` is written to the immutable credit ledger — never trust arbitrary
    // client text. Validate against an allowlist.
    const ALLOWED_SOURCES = new Set([
      "synthesis_chat",
      "subscription_hook",
      "feature_use",
    ]);
    const source = ALLOWED_SOURCES.has(rawSource) ? rawSource : "feature_use";

    const decoded = await auth.verifyIdToken(idToken);
    const result = await applyCreditChange(
      { db, FieldValue },
      {
        uid: decoded.uid,
        amount: -1,
        type: "synthesis",
        source,
        metadata: { source },
      },
    );

    return json({ success: true, ...result }, 200);
  } catch (error: any) {
    if (error?.name === "CreditError") {
      return json({ error: error.message }, error.status || 402);
    }
    console.error("[Credits Use] Error:", error);
    return json({ error: "Could not use credit" }, 500);
  }
};

function json(payload: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const config: Config = {
  path: "/api/credits/use",
};
