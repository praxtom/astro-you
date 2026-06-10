const REFERRAL_CODE_PATTERN = /^STAR[A-Z0-9]{6}$/;

export function createClientReferralCode(uid: string): string {
  const safeUid = uid.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return `STAR${safeUid.slice(0, 6).padEnd(6, "X")}`;
}

export function normalizeClientReferralCode(code: unknown): string | null {
  if (typeof code !== "string") return null;
  const normalized = code.trim().toUpperCase();
  return REFERRAL_CODE_PATTERN.test(normalized) ? normalized : null;
}

export function buildReferralLink(origin: string, code: unknown): string {
  const normalized = normalizeClientReferralCode(code);
  if (!normalized) return "";
  const url = new URL(origin);
  return `${url.origin}/?ref=${normalized}`;
}

export function extractReferralCodeFromSearch(search: string): string | null {
  if (!search) return null;
  const params = new URLSearchParams(search);
  return normalizeClientReferralCode(params.get("ref"));
}
