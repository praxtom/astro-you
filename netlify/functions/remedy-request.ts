import { Config, Context } from "@netlify/functions";
import { auth, db, FieldValue } from "./shared/firebase-admin";
import { buildRemedyRequestRecord, getRemedyProduct } from "./shared/remedy-products";

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") {
    return json({ error: "Method Not Allowed" }, 405);
  }

  try {
    const body = await req.json().catch(() => ({}));
    if (!body.idToken || typeof body.idToken !== "string") {
      return json({ error: "Missing id token" }, 401);
    }
    if (!body.productId || typeof body.productId !== "string") {
      return json({ error: "Missing remedy product" }, 400);
    }

    const decoded = await auth.verifyIdToken(body.idToken);
    const product = getRemedyProduct(body.productId);
    const createdAt = FieldValue.serverTimestamp();
    const requestRef = db
      .collection("users")
      .doc(decoded.uid)
      .collection("remedyRequests")
      .doc();

    const record = buildRemedyRequestRecord({
      uid: decoded.uid,
      productId: product.id,
      notes: typeof body.notes === "string" ? body.notes : "",
      createdAt,
    });
    const requestRecord = {
      ...record,
      requestId: requestRef.id,
      email: decoded.email || null,
    };

    const batch = db.batch();
    batch.set(requestRef, requestRecord);
    batch.set(db.collection("remedyRequests").doc(requestRef.id), requestRecord);
    await batch.commit();

    return json(
      {
        success: true,
        requestId: requestRef.id,
        product: requestRecord.product,
        status: requestRecord.status,
      },
      200,
    );
  } catch (error: any) {
    console.error("[Remedy Request] Error:", error);
    const message =
      error?.message && String(error.message).startsWith("Unsupported remedy product")
        ? "Unsupported remedy product"
        : "Could not create remedy request";
    return json({ error: message }, message === "Unsupported remedy product" ? 400 : 500);
  }
};

function json(payload: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const config: Config = {
  path: "/api/remedies/request",
};
