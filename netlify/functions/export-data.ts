import { Config, Context } from "@netlify/functions";
import type {
  DocumentReference,
  QueryDocumentSnapshot,
} from "firebase-admin/firestore";
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
      friends,
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
      // Chats and consultations keep their transcripts in a `messages`
      // subcollection — the most personal data in the export.
      readSubcollectionWithMessages(userRef, "chats"),
      readSubcollectionWithMessages(userRef, "consultations"),
      readSubcollection(userRef, "friends"),
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

    const userData = userDoc.data() || {};
    const exportData = {
      exportDate: new Date().toISOString(),
      profile: userData.profile || {},
      email: userData.email,
      credits: userData.credits,
      subscription: userData.subscription,
      referral: userData.referral,
      referredBy: userData.referredBy,
      referralClaimedAt: userData.referralClaimedAt,
      chartUrl: userData.chartUrl,
      thumbnailUrl: userData.thumbnailUrl,
      atman: userData.atman || {},
      kundaliData: userData.kundaliData || {},
      kundaliData_D9: userData.kundaliData_D9,
      kundaliData_D10: userData.kundaliData_D10,
      chats,
      consultations,
      friends,
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

/**
 * Read a subcollection and, for each doc, its `messages` subcollection.
 * Messages are paged so a single huge thread can't blow up memory or the
 * function timeout in one read.
 */
async function readSubcollectionWithMessages(
  userRef: DocumentReference,
  name: string,
) {
  const snapshot = await userRef.collection(name).get();
  const out: Array<Record<string, unknown>> = [];
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const messages = await readMessagesPaged(doc.ref);
    out.push({
      id: doc.id,
      ...data,
      // Prefer the subcollection transcript; fall back to a legacy inline
      // `messages` array field if that's all the doc has.
      messages: messages.length
        ? messages
        : Array.isArray(data.messages)
          ? data.messages
          : [],
    });
  }
  return out;
}

const MESSAGE_PAGE_SIZE = 200;

async function readMessagesPaged(parent: DocumentReference) {
  const collection = parent.collection("messages");
  const messages: Array<Record<string, unknown>> = [];
  let cursor: QueryDocumentSnapshot | undefined;
  for (;;) {
    let query = collection.limit(MESSAGE_PAGE_SIZE);
    if (cursor) query = query.startAfter(cursor);
    const page = await query.get();
    messages.push(...page.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    if (page.size < MESSAGE_PAGE_SIZE) break;
    cursor = page.docs[page.size - 1];
  }
  return messages;
}
