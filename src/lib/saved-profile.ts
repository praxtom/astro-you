/**
 * Does a users/{uid} document hold a completed birth profile?
 *
 * Onboarding writes the profile under `profile` ({ name, dob, tob, pob, ... }).
 * Checking the top-level `name` (which is never written) made every returning
 * user look new. Legacy docs that stored fields at the top level still count.
 */
export function hasSavedBirthProfile(userDoc: unknown): boolean {
  if (!userDoc || typeof userDoc !== "object") return false;
  const data = userDoc as Record<string, unknown>;
  const profile =
    data.profile && typeof data.profile === "object"
      ? (data.profile as Record<string, unknown>)
      : null;
  const isFilled = (v: unknown) => typeof v === "string" && v.trim() !== "";
  if (profile && isFilled(profile.dob) && isFilled(profile.tob)) return true;
  // Legacy top-level shape.
  return isFilled(data.dob) && isFilled(data.tob);
}
