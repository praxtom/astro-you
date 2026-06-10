export type AdminOperationKind = "support" | "remedy";
export type SupportOperationStatus = "open" | "in_progress" | "resolved" | "closed";
export type RemedyOperationStatus =
  | "requested"
  | "reviewing"
  | "quoted"
  | "fulfilled"
  | "cancelled";

export interface AdminActor {
  uid: string;
  email: string;
}

export interface AdminOperationUpdateInput {
  kind?: unknown;
  itemId?: unknown;
  status?: unknown;
  note?: unknown;
}

export interface AdminOperationPatch {
  status: SupportOperationStatus | RemedyOperationStatus;
  adminNote: string;
  assignedAdmin: AdminActor;
  updatedAt: unknown;
  resolvedAt?: unknown;
}

export class AdminOperationsError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
    this.name = "AdminOperationsError";
  }
}

const SUPPORT_STATUSES: SupportOperationStatus[] = [
  "open",
  "in_progress",
  "resolved",
  "closed",
];

const REMEDY_STATUSES: RemedyOperationStatus[] = [
  "requested",
  "reviewing",
  "quoted",
  "fulfilled",
  "cancelled",
];

export function buildOperationsQueueItem(
  kind: AdminOperationKind,
  id: string,
  record: Record<string, any>,
) {
  const uid = cleanString(record.uid, 128);
  const createdAt = record.createdAt ?? null;
  const updatedAt = record.updatedAt ?? createdAt;

  if (kind === "support") {
    const category = cleanString(record.category, 40) || "support";
    const priority = cleanString(record.priority, 20) || "normal";

    return {
      id,
      kind,
      uid,
      email: cleanString(record.email, 160) || null,
      title: cleanString(record.subject, 140) || "Support ticket",
      subtitle: `${category} · ${priority}`,
      detail: cleanString(record.message, 2000),
      referenceId: cleanString(record.referenceId, 100) || null,
      status: cleanString(record.status, 40) || "open",
      priorityScore: getSupportPriorityScore(category, priority),
      createdAt,
      updatedAt,
    };
  }

  const product = isRecord(record.product) ? record.product : {};
  const category = cleanString(product.category, 40) || "remedy";
  const fulfillment = cleanString(product.fulfillment, 40) || "review";
  const price = typeof product.priceInRupees === "number" ? product.priceInRupees : 0;

  return {
    id,
    kind,
    uid,
    email: cleanString(record.email, 160) || null,
    title:
      cleanString(product.title, 140) ||
      cleanString(record.productId, 140) ||
      "Remedy request",
    subtitle: `${category} · ${fulfillment} · ₹${price}`,
    detail: cleanString(record.notes, 800),
    referenceId: cleanString(record.productId, 100) || null,
    status: cleanString(record.status, 40) || "requested",
    priorityScore: fulfillment === "partner" ? 80 : fulfillment === "review" ? 60 : 40,
    createdAt,
    updatedAt,
  };
}

export function buildAdminOperationUpdate(
  input: AdminOperationUpdateInput,
  admin: AdminActor,
  updatedAt: unknown,
) {
  const kind = cleanString(input.kind, 20) as AdminOperationKind;
  if (kind !== "support" && kind !== "remedy") {
    throw new AdminOperationsError("Valid operation kind is required");
  }

  const itemId = cleanString(input.itemId, 160);
  if (!itemId) {
    throw new AdminOperationsError("Operation item id is required");
  }

  const status = cleanString(input.status, 40);
  const allowedStatuses = kind === "support" ? SUPPORT_STATUSES : REMEDY_STATUSES;
  if (!allowedStatuses.includes(status as never)) {
    throw new AdminOperationsError(`Valid ${kind} status is required`);
  }

  const patch: AdminOperationPatch = {
    status: status as SupportOperationStatus | RemedyOperationStatus,
    adminNote: cleanString(input.note, 1000),
    assignedAdmin: {
      uid: cleanString(admin.uid, 128),
      email: cleanString(admin.email, 160).toLowerCase(),
    },
    updatedAt,
  };

  if (
    (kind === "support" && (status === "resolved" || status === "closed")) ||
    (kind === "remedy" && (status === "fulfilled" || status === "cancelled"))
  ) {
    patch.resolvedAt = updatedAt;
  }

  return {
    kind,
    itemId,
    collectionName: kind === "support" ? "supportTickets" : "remedyRequests",
    userCollectionName: kind === "support" ? "supportTickets" : "remedyRequests",
    patch,
  };
}

function getSupportPriorityScore(category: string, priority: string) {
  if (priority === "urgent") return 100;
  if (category === "payment" || category === "refund") return 80;
  return 50;
}

function cleanString(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, maxLength) : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
