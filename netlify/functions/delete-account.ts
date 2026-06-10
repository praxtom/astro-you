import { Config, Context } from "@netlify/functions";
import type {
  CollectionReference,
  DocumentReference,
} from "firebase-admin/firestore";
import { auth, db, getStorageBucket } from "./shared/firebase-admin";
import { writeAuditLog } from "./shared/audit-log";

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") {
    return json({ error: "Method Not Allowed" }, 405);
  }

  try {
    const { idToken, confirmation } = await req.json();
    if (!idToken || confirmation !== "DELETE") {
      return json({ error: "Missing delete confirmation" }, 400);
    }

    const decoded = await auth.verifyIdToken(idToken);
    const uid = decoded.uid;
    const userRef = db.collection("users").doc(uid);

    await writeAuditLog({
      uid,
      action: "account_delete_requested",
      entityType: "user",
      entityId: uid,
      metadata: { legalRetention: "payment audit logs retained outside user document" },
    });

    await deleteDocumentTree(userRef);
    await getStorageBucket().deleteFiles({
      prefix: `users/${safeSegment(uid)}/`,
      force: true,
    }).catch((storageError) => {
      console.error("[Delete Account] Storage cleanup failed:", storageError);
    });
    await auth.deleteUser(uid);

    await writeAuditLog({
      uid,
      action: "account_deleted",
      entityType: "user",
      entityId: uid,
    });

    return json({ status: "success" });
  } catch (err: any) {
    console.error("[Delete Account] Error:", err);
    return json({ error: err.message || "Could not delete account" }, 500);
  }
};

async function deleteDocumentTree(ref: DocumentReference) {
  const collections = await ref.listCollections();
  for (const collection of collections) {
    await deleteCollection(collection);
  }
  await ref.delete();
}

async function deleteCollection(collection: CollectionReference) {
  const docs = await collection.listDocuments();
  for (const doc of docs) {
    await deleteDocumentTree(doc);
  }
}

function json(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const config: Config = { path: "/api/account/delete" };

function safeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 160);
}
