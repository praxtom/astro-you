import { Config, Context } from "@netlify/functions";
import { auth, db, FieldValue } from "./shared/firebase-admin";
import {
  SupportTicketError,
  buildSupportTicketRecord,
  notifyAdminsOfSupportTicket,
} from "./shared/support-tickets";
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

    const decoded = await auth.verifyIdToken(body.idToken);
    await enforceRateLimit({
      scope: "support_ticket",
      key: decoded.uid,
      limit: 10,
      windowMs: HOUR_MS,
    });
    const createdAt = FieldValue.serverTimestamp();
    const record = buildSupportTicketRecord(
      {
        ...body,
        uid: decoded.uid,
        email: decoded.email || body.email,
      },
      createdAt,
    );

    // Reject the identical ticket re-sent within 2 minutes (double submit,
    // client retry). Fingerprint the normalized record minus timestamps.
    const dedupeKey = {
      scope: "support_ticket",
      key: decoded.uid,
      fingerprint: submissionFingerprint(
        buildSupportTicketRecord(
          { ...body, uid: decoded.uid, email: decoded.email || body.email },
          null,
        ),
      ),
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
            "We already received this exact ticket a moment ago. No need to send it again.",
          code: "duplicate_submission",
        },
        409,
      );
    }

    const userTicketRef = db
      .collection("users")
      .doc(decoded.uid)
      .collection("supportTickets")
      .doc();
    const ticketRecord = { ...record, ticketId: userTicketRef.id };

    const batch = db.batch();
    batch.set(userTicketRef, ticketRecord);
    batch.set(db.collection("supportTickets").doc(userTicketRef.id), ticketRecord);
    await batch.commit().catch(async (commitError) => {
      await releaseSubmission(dedupeKey);
      throw commitError;
    });
    await notifyAdminsOfSupportTicket({ ...record, ticketId: userTicketRef.id });

    return json(
      {
        success: true,
        ticketId: userTicketRef.id,
        status: record.status,
      },
      200,
    );
  } catch (error: any) {
    if (error instanceof AuthError) {
      return json({ error: error.message }, error.status);
    }
    console.error("[Support Ticket] Error:", error);
    const status = error instanceof SupportTicketError ? error.status : 500;
    return json(
      {
        error:
          error instanceof SupportTicketError
            ? error.message
            : "Could not create support ticket",
      },
      status,
    );
  }
};

function json(payload: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const config: Config = {
  path: "/api/support/ticket",
};
