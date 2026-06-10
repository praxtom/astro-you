import { Config, Context } from "@netlify/functions";
import { auth, db, FieldValue } from "./shared/firebase-admin";
import { initializeUserCredits } from "./shared/credits";

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const { idToken } = await req.json();
    if (!idToken) {
      return json({ error: "Missing auth token" }, 400);
    }

    const decoded = await auth.verifyIdToken(idToken);
    const result = await initializeUserCredits(
      { db, FieldValue },
      {
        uid: decoded.uid,
        email: decoded.email || null,
      },
    );

    return json({ success: true, ...result }, 200);
  } catch (error: any) {
    console.error("[Credits Initialize] Error:", error);
    return json(
      { error: error.message || "Could not initialize credits" },
      error.status || 500,
    );
  }
};

function json(payload: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const config: Config = {
  path: "/api/credits/initialize",
};
