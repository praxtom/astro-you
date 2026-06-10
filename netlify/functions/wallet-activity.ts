import { Config, Context } from "@netlify/functions";
import { auth, db } from "./shared/firebase-admin";

type WalletCollection = "creditLedger" | "consultations" | "reports";

function serializeDate(value: any): string | null {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return null;
}

async function readSubcollection(
  uid: string,
  collectionName: WalletCollection,
  maxItems: number,
) {
  const snap = await db
    .collection("users")
    .doc(uid)
    .collection(collectionName)
    .orderBy("createdAt", "desc")
    .limit(maxItems)
    .get();

  return snap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      createdAt: serializeDate(data.createdAt),
      updatedAt: serializeDate(data.updatedAt),
      endedAt: serializeDate(data.endedAt),
    };
  });
}

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    if (!body.idToken || typeof body.idToken !== "string") {
      return json({ error: "Missing id token" }, 401);
    }

    const decoded = await auth.verifyIdToken(body.idToken);
    const maxItems =
      typeof body.limit === "number" && Number.isFinite(body.limit)
        ? Math.min(50, Math.max(1, Math.floor(body.limit)))
        : 30;

    const [ledger, consultations, reports] = await Promise.all([
      readSubcollection(decoded.uid, "creditLedger", maxItems),
      readSubcollection(decoded.uid, "consultations", 10),
      readSubcollection(decoded.uid, "reports", 10),
    ]);

    return json({ ledger, consultations, reports }, 200);
  } catch (error: any) {
    console.error("[Wallet Activity] Error:", error);
    return json({ error: "Could not load wallet activity" }, 500);
  }
};

function json(payload: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const config: Config = {
  path: "/api/wallet/activity",
};
