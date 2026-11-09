import { auth } from "./firebase-admin.js";
import { getConfiguredAdminEmails } from "./env.js";

export async function requireAdmin(idToken?: string) {
  if (!idToken) throw new AdminAuthError("Missing auth token", 401);
  const decoded = await auth.verifyIdToken(idToken);
  const email = decoded.email || "";
  const configuredEmails = getConfiguredAdminEmails();

  // The email allowlist only counts for a VERIFIED address — otherwise anyone
  // who registers an account with an admin's address (e.g. an unverified
  // email/password or third-party provider account) would inherit admin.
  const allowlisted =
    decoded.email_verified === true &&
    email !== "" &&
    configuredEmails.includes(email.toLowerCase());

  if (decoded.admin === true || allowlisted) {
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
