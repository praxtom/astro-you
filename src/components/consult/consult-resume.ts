import { db } from "../../lib/firebase";

/**
 * A sitting the visitor asked for before they had a chart to be read.
 *
 * Lives beside STORAGE_KEYS.CONSULT_DRAFT in sessionStorage — the draft holds
 * the question, this holds the guide — so a signup that detours through
 * onboarding still lands in the sitting that was actually asked for.
 */
const INTENT_KEY = "astroyou_consult_intent";

export interface ConsultIntent {
  personaId: string;
  language: string;
}

/** Remember the sitting while the visitor fills in their birth details. */
export function saveConsultIntent(intent: ConsultIntent): void {
  try {
    sessionStorage.setItem(INTENT_KEY, JSON.stringify(intent));
  } catch {
    // A browser refusing session storage shouldn't break the sign-in flow.
  }
}

/** Read the pending sitting exactly once — it never fires twice. */
export function takeConsultIntent(): ConsultIntent | null {
  try {
    const raw = sessionStorage.getItem(INTENT_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(INTENT_KEY);
    const parsed = JSON.parse(raw) as Partial<ConsultIntent>;
    if (typeof parsed?.personaId !== "string" || !parsed.personaId) return null;
    return {
      personaId: parsed.personaId,
      language: typeof parsed.language === "string" ? parsed.language : "",
    };
  } catch {
    return null;
  }
}

/**
 * Does this account have a chart for a guide to read?
 *
 * Asked of Firestore rather than useUserProfile() on purpose: immediately
 * after sign-in that hook is still holding the guest's (empty) profile and
 * its `loading` flag has already settled, so it would report "no chart" for
 * users who have one. Errs towards onboarding — sending someone to collect
 * birth details costs nothing, opening a billed sitting on an empty chart does.
 */
export async function hasBirthChart(uid: string): Promise<boolean> {
  try {
    const { doc, getDoc } = await import("firebase/firestore");
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) return false;
    const data = snap.data() as Record<string, any>;
    return Boolean(data?.profile?.dob || data?.dob);
  } catch (err) {
    console.error("Could not check for a birth chart:", err);
    return false;
  }
}
