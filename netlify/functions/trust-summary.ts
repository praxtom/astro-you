import { Config, Context } from "@netlify/functions";
import { db } from "./shared/firebase-admin.js";
import { buildTrustSummary } from "./shared/trust.js";

interface FirestoreDataDoc {
  data(): Record<string, unknown>;
}

export default async (_req: Request, _context: Context) => {
  try {
    const [moderationSnapshot, feedbackSnapshot] = await withTimeout(
      Promise.all([
        db.collection("trustModerationQueue").limit(300).get(),
        db.collection("predictionFeedbackAggregateQueue").limit(1000).get(),
      ]),
      4500,
    );

    const summary = buildTrustSummary({
      moderationRecords: moderationSnapshot.docs.map(readDocData),
      predictionFeedbackRecords: feedbackSnapshot.docs.map(readDocData),
    });

    return json(summary, 200);
  } catch (error) {
    console.warn("[Trust Summary] Firestore read failed; returning empty public summary.", error);
    return json(
      buildTrustSummary({
        moderationRecords: [],
        predictionFeedbackRecords: [],
      }),
      200,
    );
  }
};

export const config: Config = {
  path: "/api/trust/summary",
};

function json(payload: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=300",
    },
  });
}

function readDocData(doc: FirestoreDataDoc) {
  return doc.data();
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error(`Trust summary read timed out after ${timeoutMs}ms`)),
      timeoutMs,
    );
    promise
      .then((value) => {
        clearTimeout(timeout);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timeout);
        reject(error);
      });
  });
}
