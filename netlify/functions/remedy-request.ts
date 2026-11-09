import { Config, Context } from "@netlify/functions";
import { auth, db, FieldValue } from "./shared/firebase-admin";
import { buildRemedyRequestRecord, getRemedyProduct } from "./shared/remedy-products";
import { AuthError, enforceRateLimit } from "./shared/require-auth";
import {
  isDuplicateSubmission,
  releaseSubmission,
  submissionFingerprint,
} from "./shared/rate-limit.js";

const HOUR_MS = 60 * 60 * 1000;
const DUPLICATE_WINDOW_MS = 2 * 60 * 1000;

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
    await enforceRateLimit({
      scope: "remedy_request",
      key: decoded.uid,
      limit: 10,
      windowMs: HOUR_MS,
    });
    const product = getRemedyProduct(body.productId);
    const notes = typeof body.notes === "string" ? body.notes : "";
    // Reject the identical request re-sent within 2 minutes.
    const dedupeKey = {
      scope: "remedy_request",
      key: decoded.uid,
      fingerprint: submissionFingerprint({ productId: product.id, notes }),
    };
    if (
      await isDuplicateSubmission({
        ...dedupeKey,
        windowMs: DUPLICATE_WINDOW_MS,
      })
    ) {
      return json(
        {
          error:
            "We already received this exact request a moment ago. No need to send it again.",
          code: "duplicate_submission",
        },
        409,
      );
    }
    const createdAt = FieldValue.serverTimestamp();
    const requestRef = db
      .collection("users")
      .doc(decoded.uid)
      .collection("remedyRequests")
      .doc();

    const record = buildRemedyRequestRecord({
      uid: decoded.uid,
      productId: product.id,
      notes,
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
    await batch.commit().catch(async (commitError) => {
      await releaseSubmission(dedupeKey);
      throw commitError;
    });

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
    if (error instanceof AuthError) {
      return json({ error: error.message }, error.status);
    }
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
