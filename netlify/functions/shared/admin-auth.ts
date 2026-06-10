import { auth } from "./firebase-admin.js";
import { getConfiguredAdminEmails } from "./env.js";

export async function requireAdmin(idToken?: string) {
  if (!idToken) throw new AdminAuthError("Missing auth token", 401);
  const decoded = await auth.verifyIdToken(idToken);
  const email = decoded.email || "";
  const configuredEmails = getConfiguredAdminEmails();

  if (decoded.admin === true || configuredEmails.includes(email.toLowerCase())) {
    return { uid: decoded.uid, email };
  }

  throw new AdminAuthError("Admin access required", 403);
}

export class AdminAuthError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AdminAuthError";
    this.status = status;
  }
}
