import { Config, Context } from "@netlify/functions";
import { auth, db, FieldValue } from "./shared/firebase-admin.js";
import {
  TrustRecordError,
  buildConsultReviewRecord,
  buildPredictionFeedbackRecord,
  buildTestimonialSubmissionRecord,
} from "./shared/trust.js";
import { persistPredictionFeedbackSignal } from "./shared/atman-brain.js";

type TrustKind = "consult_review" | "prediction_feedback" | "testimonial";

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") {
    return json({ error: "Method Not Allowed" }, 405);
  }

  try {
    const body = await req.json().catch(() => ({}));
    if (!body.idToken || typeof body.idToken !== "string") {
      return json({ error: "Missing id token" }, 401);
    }

    const kind = body.kind as TrustKind;
    const decoded = await auth.verifyIdToken(body.idToken);
    const actor = { uid: decoded.uid, email: decoded.email };
    const createdAt = FieldValue.serverTimestamp();
    const userRef = db.collection("users").doc(decoded.uid);

    if (kind === "consult_review") {
      const record = buildConsultReviewRecord(body, actor, createdAt);
      const reviewRef = userRef.collection("consultationReviews").doc();
      const writes: Promise<unknown>[] = [reviewRef.set(record)];

      if (record.sharePublic) {
        const publicRecord = { ...record, reviewId: reviewRef.id };
        writes.push(
          db
            .collection("astrologers")
            .doc(record.personaId)
            .collection("reviews")
            .doc(reviewRef.id)
            .set(publicRecord),
          db.collection("trustModerationQueue").doc(reviewRef.id).set(publicRecord),
        );
      }

      await Promise.all(writes);
      return json({ success: true, id: reviewRef.id, publicStatus: record.publicStatus }, 200);
    }

    if (kind === "prediction_feedback") {
      const record = buildPredictionFeedbackRecord(body, actor, createdAt);
      const feedbackRef = userRef.collection("predictionFeedback").doc();
      await Promise.all([
        feedbackRef.set(record),
        db
          .collection("predictionFeedbackAggregateQueue")
          .doc(feedbackRef.id)
          .set({ ...record, feedbackId: feedbackRef.id }),
      ]);
      try {
        await persistPredictionFeedbackSignal(
          { db },
          {
            uid: decoded.uid,
            feedback: {
              signal: record.signal,
              source: record.source,
              period: record.period,
              forecastDate: record.forecastDate,
            },
          },
        );
      } catch (error) {
        console.warn("[Trust Submit] Prediction feedback brain update failed:", error);
      }
      return json({ success: true, id: feedbackRef.id, publicStatus: record.publicStatus }, 200);
    }

    if (kind === "testimonial") {
      const record = buildTestimonialSubmissionRecord(body, actor, createdAt);
      const testimonialRef = userRef.collection("testimonialSubmissions").doc();
      const writes: Promise<unknown>[] = [testimonialRef.set(record)];

      if (record.allowPublicUse) {
        const moderationRecord = { ...record, testimonialId: testimonialRef.id };
        writes.push(
          db.collection("trustModerationQueue").doc(testimonialRef.id).set(moderationRecord),
        );
      }

      await Promise.all(writes);
      return json({ success: true, id: testimonialRef.id, publicStatus: record.publicStatus }, 200);
    }

    throw new TrustRecordError("Unsupported trust record type");
  } catch (error: unknown) {
    console.error("[Trust Submit] Error:", error);
    const status = error instanceof TrustRecordError ? error.status : 500;
    const message =
      error instanceof TrustRecordError
        ? error.message
        : "Could not submit trust record";
    return json({ error: message }, status);
  }
};

function json(payload: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const config: Config = {
  path: "/api/trust/submit",
};
