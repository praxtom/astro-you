/**
 * Where scheduled jobs (daily digest, brain nudges) may send messages.
 *
 * The user document is owner-writable, so any address or number stored on it
 * (`email`, `profile.email`, `phoneE164`, `whatsappNumber`, …) is attacker
 * controlled: reading a recipient from there would let anyone make our cron
 * email or WhatsApp an arbitrary victim. Recipients therefore come only from
 * server-verified sources:
 *
 *  - email: the Firebase Auth record, and only when Auth says it is verified.
 *    Email-OTP accounts are created with `emailVerified: true` (verify-otp.ts
 *    proves inbox ownership first); Google accounts carry Google's verified
 *    flag (and are accepted via the google.com provider entry as well).
 *  - WhatsApp/phone: only `verifiedContacts.whatsappE164`, a server-written
 *    field that no client can set (firestore.rules) and that requires a
 *    `whatsappVerifiedAt` marker. Nothing writes it yet, so WhatsApp delivery
 *    stays disabled until a verification flow exists.
 *
 * Pure module (no Firebase import) so it can be unit-tested.
 */

export interface AuthEmailRecord {
  email?: string | null;
  emailVerified?: boolean;
  disabled?: boolean;
  providerData?: Array<{ providerId?: string; email?: string | null }>;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const E164_RE = /^\+[1-9]\d{7,14}$/;

/** The deliverable, verified email on an Auth record, or null. */
export function selectVerifiedAuthEmail(
  record: AuthEmailRecord | null | undefined,
): string | null {
  if (!record || record.disabled) return null;
  const email =
    typeof record.email === "string" ? record.email.trim().toLowerCase() : "";
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) return null;
  if (record.emailVerified === true) return email;
  // Google sign-in: Google has verified the address it vouches for.
  const googleVouched = (record.providerData ?? []).some(
    (p) =>
      p?.providerId === "google.com" &&
      typeof p.email === "string" &&
      p.email.trim().toLowerCase() === email,
  );
  return googleVouched ? email : null;
}

/**
 * Look up the verified Auth email for a uid. Returns null (never throws) when
 * the user is missing, disabled, unverified, or the lookup fails.
 */
export async function lookupVerifiedAuthEmail(
  uid: string,
  getUser: (uid: string) => Promise<AuthEmailRecord>,
): Promise<string | null> {
  try {
    return selectVerifiedAuthEmail(await getUser(uid));
  } catch {
    return null;
  }
}

/** Server-written, verified WhatsApp number on a user doc, or null. */
export function selectVerifiedWhatsAppNumber(
  userData: Record<string, unknown> | null | undefined,
): string | null {
  const contacts = userData?.verifiedContacts;
  if (!contacts || typeof contacts !== "object") return null;
  const { whatsappE164, whatsappVerifiedAt } = contacts as Record<
    string,
    unknown
  >;
  if (!whatsappVerifiedAt) return null;
  return typeof whatsappE164 === "string" && E164_RE.test(whatsappE164)
    ? whatsappE164
    : null;
}
