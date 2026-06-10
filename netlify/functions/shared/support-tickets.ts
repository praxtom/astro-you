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
  const priority: SupportTicketPriority = rawPriority === "urgent" ? "urgent" : "normal";

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

function cleanString(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, maxLength) : "";
}
