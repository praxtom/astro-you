import { Config, Context } from "@netlify/functions";
import type { DocumentReference } from "firebase-admin/firestore";
import { db, auth } from "./shared/firebase-admin";
import { enforceIpRateLimit, AuthError } from "./shared/require-auth";
import { writeAuditLog } from "./shared/audit-log";

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST")
    return new Response("Method Not Allowed", { status: 405 });

  const { idToken } = await req.json();
  if (!idToken)
    return new Response(JSON.stringify({ error: "Missing auth token" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });

  try {
    const decoded = await auth.verifyIdToken(idToken);
    const uid = decoded.uid;

    // This export pulls the user's full sensitive profile across many
    // subcollections — rate-limit it and record an audit trail.
    try {
      await enforceIpRateLimit(req, "export_data", 3, 60 * 60 * 1000);
    } catch (err) {
      const status = err instanceof AuthError ? err.status : 429;
      return new Response(
        JSON.stringify({
          error: "Too many export requests. Please try again later.",
        }),
        {
          status,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
    await writeAuditLog({
      uid,
      action: "data_exported",
      entityType: "user",
      entityId: uid,
      metadata: {},
    }).catch((e) => console.error("[ExportData] Audit log failed:", e));

    // Gather all user data
    const userRef = db.collection("users").doc(uid);
    const userDoc = await userRef.get();
    const [
      chats,
      consultations,
      reports,
      remedyRequests,
      supportTickets,
      referrals,
      referralClaims,
      creditLedger,
      digests,
      brainNudges,
      pushTokens,
      consultationReviews,
      predictionFeedback,
      testimonialSubmissions,
    ] = await Promise.all([
      readSubcollection(userRef, "chats"),
      readSubcollection(userRef, "consultations"),
      readSubcollection(userRef, "reports"),
      readSubcollection(userRef, "remedyRequests"),
      readSubcollection(userRef, "supportTickets"),
      readSubcollection(userRef, "referrals"),
      readSubcollection(userRef, "referralClaims"),
      readSubcollection(userRef, "creditLedger"),
      readSubcollection(userRef, "digests"),
      readSubcollection(userRef, "brainNudges"),
      readSubcollection(userRef, "pushTokens"),
      readSubcollection(userRef, "consultationReviews"),
      readSubcollection(userRef, "predictionFeedback"),
      readSubcollection(userRef, "testimonialSubmissions"),
    ]);

    const exportData = {
      exportDate: new Date().toISOString(),
      profile: userDoc.data()?.profile || {},
      credits: userDoc.data()?.credits,
      subscription: userDoc.data()?.subscription,
      atman: userDoc.data()?.atman || {},
      kundaliData: userDoc.data()?.kundaliData || {},
      chats,
      consultations,
      reports,
      remedyRequests,
      supportTickets,
      referrals,
      referralClaims,
      creditLedger,
      digests,
      brainNudges,
      pushTokens,
      consultationReviews,
      predictionFeedback,
      testimonialSubmissions,
    };

    return new Response(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename=astroyou-data-${uid}.json`,
      },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const config: Config = { path: "/api/export-data" };

async function readSubcollection(userRef: DocumentReference, name: string) {
  const snapshot = await userRef.collection(name).get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}
