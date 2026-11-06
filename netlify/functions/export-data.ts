import { Config, Context } from "@netlify/functions";
import type {
  DocumentReference,
  QueryDocumentSnapshot,
  QuerySnapshot,
} from "firebase-admin/firestore";
import { db, auth } from "./shared/firebase-admin";
import { enforceIpRateLimit, AuthError } from "./shared/require-auth";
import { writeAuditLog } from "./shared/audit-log";
import { buildUserDocExport } from "./shared/user-export";

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST")
    return new Response("Method Not Allowed", { status: 405 });

  try {
    let idToken: unknown;
    try {
      ({ idToken } = await req.json());
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (!idToken)
      return new Response(JSON.stringify({ error: "Missing auth token" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });

    const decoded = await auth.verifyIdToken(idToken as string);
    const uid = decoded.uid;
    const email = (decoded.email || "").toLowerCase().trim();

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

    // The user's own records in top-level collections that live OUTSIDE their
    // subtree — include them so the export is a complete record of the
    // personal data held about them. Each is capped so a heavy account can't
    // blow up memory or the function timeout.
    const [
      analyticsEvents,
      expertApplications,
      trustModerationQueue,
      supportTicketsGlobal,
      remedyRequestsGlobal,
      paymentOrders,
    ] = await Promise.all([
      readTopLevelCollectionByUid("analyticsEvents", uid),
      // expertApplications is written by the anonymous public application
      // endpoint (shared/expert-applications.ts) and never carries a `uid` —
      // only the applicant's email. Match on the verified token's email
      // instead; an account with no email on the token can't be matched to
      // an application, so it yields an empty array rather than a uid query
      // that would always return nothing.
      email
        ? readTopLevelCollectionByField("expertApplications", "email", email)
        : Promise.resolve([] as Array<Record<string, unknown>>),
      readTopLevelCollectionByUid("trustModerationQueue", uid),
      readTopLevelCollectionByUid("supportTickets", uid),
      readTopLevelCollectionByUid("remedyRequests", uid),
      readTopLevelCollectionByUid("paymentOrders", uid),
    ]);

    // The whole user document (minus the internal/secret fields documented
    // in shared/user-export.ts), so no stored setting is silently left out.
    const userFields = buildUserDocExport(userDoc.data());
    const exportData = {
      exportDate: new Date().toISOString(),
      ...userFields,
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
      analyticsEvents,
      expertApplications,
      trustModerationQueue,
      supportTicketsGlobal,
      remedyRequestsGlobal,
      paymentOrders,
    };

    return new Response(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename=astroyou-data-${uid}.json`,
      },
    });
  } catch (err: any) {
    // Never echo the raw error — it can leak internal paths / Firestore details.
    console.error("[ExportData] Failed:", err?.name || "error", err?.code);
    return new Response(
      JSON.stringify({
        error: "Could not export your data. Please try again.",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
};

export const config: Config = { path: "/api/export-data" };

async function readSubcollection(userRef: DocumentReference, name: string) {
  const snapshot = await userRef.collection(name).get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

const TOP_LEVEL_EXPORT_CAP = 500;

/**
 * Read a top-level (non-subtree) collection filtered to this user's uid,
 * capped so a heavy account can't blow up memory or the function timeout.
 * Best-effort: a read failure yields an empty array rather than failing the
 * whole export.
 */
async function readTopLevelCollectionByUid(
  collectionName: string,
  uid: string,
) {
  return readTopLevelCollectionByField(collectionName, "uid", uid);
}

/**
 * Read a top-level (non-subtree) collection filtered by an arbitrary field —
 * for collections whose docs don't carry a `uid` (e.g. `expertApplications`,
 * written by an anonymous endpoint and keyed by email instead). Capped so a
 * heavy account can't blow up memory or the function timeout. Best-effort: a
 * read failure yields an empty array rather than failing the whole export.
 */
async function readTopLevelCollectionByField(
  collectionName: string,
  field: string,
  value: string,
) {
  return db
    .collection(collectionName)
    .where(field, "==", value)
    .limit(TOP_LEVEL_EXPORT_CAP)
    .get()
    .then((snap: QuerySnapshot) =>
      snap.docs.map((d: QueryDocumentSnapshot) => ({ id: d.id, ...d.data() })),
    )
    .catch(() => [] as Array<Record<string, unknown>>);
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
