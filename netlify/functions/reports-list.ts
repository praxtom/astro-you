import { Config, Context } from "@netlify/functions";
import { auth, db } from "./shared/firebase-admin";

type ReportDocument = Record<string, any>;

function serializeReport(id: string, data: ReportDocument) {
  const createdAt =
    data.createdAt?.toDate?.() instanceof Date
      ? data.createdAt.toDate().toISOString()
      : null;

  return {
    id,
    title: data.title,
    reportType: data.reportType,
    filename: data.filename,
    status: data.status,
    chargedCredits: data.chargedCredits,
    creditCost: data.creditCost,
    createdAt,
  };
}

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const { idToken, limit = 30 } = await req.json();
    if (!idToken) {
      return new Response(JSON.stringify({ error: "Missing auth token" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const decoded = await auth.verifyIdToken(idToken);
    const safeLimit = Math.min(Math.max(Number(limit) || 30, 1), 50);
    const snap = await db
      .collection("users")
      .doc(decoded.uid)
      .collection("reports")
      .orderBy("createdAt", "desc")
      .limit(safeLimit)
      .get();

    const reports = snap.docs.map((doc) => serializeReport(doc.id, doc.data()));

    return new Response(JSON.stringify({ reports }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[Reports List] Failed:", error);
    return new Response(JSON.stringify({ error: "Could not load reports" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const config: Config = { path: "/api/reports/list" };
