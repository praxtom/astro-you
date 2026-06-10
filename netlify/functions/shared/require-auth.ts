/**
 * Shared authentication + rate-limit helpers for Netlify functions.
 *
 * Centralizes the "verify a Firebase ID token, derive the uid server-side, and
 * apply a per-user rate limit" pattern so every protected endpoint enforces it
 * the same way. The uid ALWAYS comes from the verified token, never from a
 * client-supplied field.
 */
import { auth } from "./firebase-admin.js";
import {
  checkRateLimit,
  getRequestIdentifier,
  type RateLimitOptions,
} from "./rate-limit.js";

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

/** Verify a Firebase ID token and return the decoded token (with uid/email). */
export async function verifyToken(idToken: unknown) {
  if (typeof idToken !== "string" || idToken.length === 0) {
    throw new AuthError("Authentication required", 401);
  }
  try {
    return await auth.verifyIdToken(idToken);
  } catch {
    throw new AuthError("Invalid or expired auth token", 401);
  }
}

/** Require auth from an `idToken` field in an already-parsed request body. */
export async function requireAuthBody(body: { idToken?: unknown }) {
  return verifyToken(body?.idToken);
}

/** Require auth from an `Authorization: Bearer <token>` header. */
export async function requireAuthReq(req: Request) {
  const header = req.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return verifyToken(match?.[1]);
}

/**
 * Apply a rate limit and throw AuthError(429) if exceeded. Returns the result
 * so callers can surface Retry-After if they wish.
 */
export async function enforceRateLimit(options: RateLimitOptions) {
  const result = await checkRateLimit(options);
  if (!result.allowed) {
    throw new AuthError("Too many requests. Please slow down.", 429);
  }
  return result;
}

/** Convenience: rate-limit a request by its (non-spoofable) client IP. */
export async function enforceIpRateLimit(
  req: Request,
  scope: string,
  limit: number,
  windowMs: number,
) {
  return enforceRateLimit({
    scope,
    key: getRequestIdentifier(req),
    limit,
    windowMs,
  });
}

/** Standard JSON response helper. */
export function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Map a thrown error to a Response. AuthError keeps its status; everything else
 * becomes a generic 500 so internal details (Firestore paths, project ids)
 * never leak to clients.
 */
export function errorResponse(
  err: unknown,
  genericMessage = "Request failed",
): Response {
  if (err instanceof AuthError) {
    return jsonResponse({ error: err.message }, err.status);
  }
  console.error("[function error]", err);
  return jsonResponse({ error: genericMessage }, 500);
}
