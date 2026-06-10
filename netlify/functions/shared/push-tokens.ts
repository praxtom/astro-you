import { createHash } from "node:crypto";

export interface PushTokenInput {
  token: string;
  platform?: string;
  userAgent?: string;
  now?: Date;
}

export interface PushTokenRecord {
  token: string;
  platform: string | null;
  userAgent: string | null;
  active: true;
  createdAt: Date;
  updatedAt: Date;
}

export function validatePushTokenInput(input: Partial<PushTokenInput>): PushTokenInput {
  const token = typeof input.token === "string" ? input.token.trim() : "";
  if (token.length < 100 || token.length > 4096) {
    throw new Error("Invalid push token");
  }

  return {
    token,
    platform: cleanOptionalString(input.platform, 80),
    userAgent: cleanOptionalString(input.userAgent, 300),
    now: input.now,
  };
}

export function buildPushTokenRecord(input: PushTokenInput): PushTokenRecord {
  const safeInput = validatePushTokenInput(input);
  const now = safeInput.now || new Date();
  return {
    token: safeInput.token,
    platform: safeInput.platform || null,
    userAgent: safeInput.userAgent || null,
    active: true,
    createdAt: now,
    updatedAt: now,
  };
}

export function createPushTokenDocId(token: string): string {
  const digest = createHash("sha256").update(token).digest("hex").slice(0, 32);
  return `token_${digest}`;
}

function cleanOptionalString(value: unknown, maxLength: number) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLength);
}
