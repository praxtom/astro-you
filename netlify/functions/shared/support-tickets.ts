export type SupportTicketCategory =
  | "payment"
  | "refund"
  | "account"
  | "report"
  | "consultation"
  | "technical"
  | "other";

export type SupportTicketPriority = "normal" | "urgent";

export class SupportTicketError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
    this.name = "SupportTicketError";
  }
}

export interface SupportTicketPayload {
  uid?: unknown;
  email?: unknown;
  category?: unknown;
  priority?: unknown;
  subject?: unknown;
  message?: unknown;
  referenceId?: unknown;
}

const CATEGORIES: SupportTicketCategory[] = [
  "payment",
  "refund",
  "account",
  "report",
  "consultation",
  "technical",
  "other",
];

export function buildSupportTicketRecord(
  payload: SupportTicketPayload,
  createdAt: unknown,
) {
  const uid = cleanString(payload.uid, 128);
  if (!uid) {
    throw new SupportTicketError("User id is required", 401);
  }

  const email = cleanString(payload.email, 160).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new SupportTicketError("Valid account email is required");
  }

  const category = cleanString(payload.category, 40) as SupportTicketCategory;
  if (!CATEGORIES.includes(category)) {
    throw new SupportTicketError("Valid support category is required");
  }

  const subject = cleanString(payload.subject, 140);
  if (subject.length < 5) {
    throw new SupportTicketError("Subject must be at least 5 characters");
  }

  const message = cleanString(payload.message, 2000);
  if (message.length < 20) {
    throw new SupportTicketError("Message must be at least 20 characters");
  }

  const rawPriority = cleanString(payload.priority, 20);
  const priority: SupportTicketPriority =
    rawPriority === "urgent" ? "urgent" : "normal";

  return {
    uid,
    email,
    category,
    priority,
    subject,
    message,
    referenceId: cleanString(payload.referenceId, 100),
    status: "open" as const,
    source: "web" as const,
    createdAt,
    updatedAt: createdAt,
  };
}

export interface SupportTicketNotice {
  ticketId: string;
  category: string;
  priority: string;
  subject: string;
}

export interface NotifyAdminsOptions {
  env?: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

/**
 * Email ASTROYOU_ADMIN_EMAILS that a support ticket was created, so tickets
 * don't wait for someone to poll the admin queue. Fail-safe: never throws,
 * 3s timeout, and returns false when Resend or admin emails are not
 * configured. The email carries the ticket id, category, priority and subject
 * only — the requester's email and message stay in the admin console.
 */
export async function notifyAdminsOfSupportTicket(
  ticket: SupportTicketNotice,
  options: NotifyAdminsOptions = {},
): Promise<boolean> {
  const env = options.env ?? process.env;
  const apiKey = env.RESEND_API_KEY?.trim();
  const admins = (env.ASTROYOU_ADMIN_EMAILS || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter((item) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item))
    .slice(0, 10);
  if (!apiKey || admins.length === 0) return false;

  const base = (env.APP_BASE_URL || env.URL || "https://astroyou.app").replace(
    /\/+$/,
    "",
  );
  const subject = cleanString(ticket.subject, 140);
  const category = cleanString(ticket.category, 40);
  const priority = cleanString(ticket.priority, 20) || "normal";
  const ticketId = cleanString(ticket.ticketId, 160);
  const prefix = priority === "urgent" ? "[URGENT] " : "";
  const adminUrl = `${base}/admin`;

  try {
    const res = await (options.fetchImpl ?? fetch)(
      "https://api.resend.com/emails",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "Idempotency-Key": `support_ticket_${ticketId}`,
        },
        body: JSON.stringify({
          from: env.DIGEST_FROM_EMAIL || "AstroYou <noreply@astroyou.app>",
          to: admins,
          subject: `${prefix}New support ticket (${category}): ${subject}`,
          text: [
            `A new ${priority} support ticket was created.`,
            `Category: ${category}`,
            `Subject: ${subject}`,
            `Ticket id: ${ticketId}`,
            "",
            `Review it in the admin operations queue: ${adminUrl}`,
          ].join("\n"),
        }),
        signal: AbortSignal.timeout(options.timeoutMs ?? 3_000),
      },
    );
    if (!res.ok) {
      console.error(
        `[Support Ticket] Admin notification failed (${res.status})`,
      );
      return false;
    }
    return true;
  } catch (err) {
    console.error(
      "[Support Ticket] Admin notification failed:",
      err instanceof Error ? err.name : "error",
    );
    return false;
  }
}

function cleanString(value: unknown, maxLength: number) {
  return typeof value === "string"
    ? value.trim().replace(/\s+/g, " ").slice(0, maxLength)
    : "";
}
