import { Config, Context } from "@netlify/functions";
import { auth, db, FieldValue } from "./shared/firebase-admin";
import {
  SupportTicketError,
  buildSupportTicketRecord,
} from "./shared/support-tickets";

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
    const createdAt = FieldValue.serverTimestamp();
    const record = buildSupportTicketRecord(
      {
        ...body,
        uid: decoded.uid,
        email: decoded.email || body.email,
      },
      createdAt,
    );

    const userTicketRef = db
      .collection("users")
      .doc(decoded.uid)
      .collection("supportTickets")
      .doc();
    const ticketRecord = { ...record, ticketId: userTicketRef.id };

    const batch = db.batch();
    batch.set(userTicketRef, ticketRecord);
    batch.set(db.collection("supportTickets").doc(userTicketRef.id), ticketRecord);
    await batch.commit();

    return json(
      {
        success: true,
        ticketId: userTicketRef.id,
        status: record.status,
      },
      200,
    );
  } catch (error: any) {
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
