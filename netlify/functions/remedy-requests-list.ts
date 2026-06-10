import { Config, Context } from "@netlify/functions";
import { auth, db } from "./shared/firebase-admin";

function serializeDate(value: any): string | null {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return null;
}

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") {
    return json({ error: "Method Not Allowed" }, 405);
  }

  try {
    const body = await req.json().catch(() => ({}));
    if (!body.idToken || typeof body.idToken !== "string") {
      return json({ error: "Missing id token" }, 401);
    }

    const decoded = await auth.verifyIdToken(body.idToken);
    const snap = await db
      .collection("users")
      .doc(decoded.uid)
      .collection("remedyRequests")
      .orderBy("createdAt", "desc")
      .limit(20)
      .get();

    const requests = snap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: serializeDate(data.createdAt),
        updatedAt: serializeDate(data.updatedAt),
      };
    });

    return json({ requests }, 200);
  } catch (error: any) {
    console.error("[Remedy Requests List] Error:", error);
    return json({ error: "Could not load remedy requests" }, 500);
  }
};

function json(payload: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const config: Config = {
  path: "/api/remedies/requests",
};
