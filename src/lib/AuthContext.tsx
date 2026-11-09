import { useEffect, useRef, useState, ReactNode } from "react";
import {
  type User,
  onAuthStateChanged,
  signOut as firebaseSignOut,
  getRedirectResult,
} from "firebase/auth";
import {
  auth,
  db,
  applyPendingAnalyticsOptIn,
  setAnalyticsConsent,
} from "./firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { STORAGE_KEYS } from "./constants";
import {
  captureReferralFromUrl,
  clearPendingReferralCode,
  getPendingReferralCode,
} from "./acquisition";
import { AuthContext } from "./authContextValue";
import { deriveProfileSigns, normalizeSignCode } from "./chart-summary";
import { ZODIAC_SIGNS } from "./astrology";
import { normalizeZodiacMode } from "./zodiac-mode";
import { COMPATIBILITY_CONTEXT_KEY } from "../components/layout/AskJyotishBridge";

/** A trusted sign name ("Taurus") from untrusted storage, or undefined. */
function storedSignName(value: unknown): string | undefined {
  const code = normalizeSignCode(value);
  return code ? ZODIAC_SIGNS.find((z) => z.code === code)?.western : undefined;
}

/**
 * Best-effort: derive the sidereal Moon/Sun signs + Moon nakshatra for a
 * just-migrated guest profile from its Vedic D1 (the guest already cast it,
 * so this is normally a server-cache hit) and save them to the profile.
 * Never blocks sign-in; useKundali backfills later if this fails.
 */
async function backfillMigratedSigns(
  currentUser: User,
  profile: Record<string, any>,
): Promise<void> {
  try {
    const idToken = await currentUser.getIdToken();
    const res = await fetch("/api/kundali", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idToken,
        chartType: "D1",
        zodiacMode: "vedic",
        birthData: {
          dob: profile.dob,
          tob: profile.tob,
          ...(profile.pob ? { pob: profile.pob } : {}),
          ...(profile.coordinates ?? {}),
          ...(profile.birthTimeUnknown ? { birthTimeUnknown: true } : {}),
        },
      }),
    });
    if (!res.ok) return;
    const signs = deriveProfileSigns(await res.json());
    if (!signs) return;
    await setDoc(
      doc(db, "users", currentUser.uid),
      { profile: signs },
      { merge: true },
    );
  } catch (err) {
    console.warn("[Auth] Sign backfill after migration failed:", err);
  }
}

/**
 * Account bootstrap for a signed-in user: create the user doc, initialize
 * credits server-side, migrate a guest profile, and claim a pending referral.
 * Runs in the BACKGROUND after first render — the app must never sit on a
 * blank screen waiting for these network round-trips. Consumers that depend
 * on the doc being ready (profile, credits) read `accountSyncing` from the
 * auth context and treat "absent while syncing" as "not loaded yet".
 */
async function initializeAccount(currentUser: User): Promise<void> {
  try {
    const userDocRef = doc(db, "users", currentUser.uid);
    const docSnap = await getDoc(userDocRef);
    const existingData = docSnap.exists() ? docSnap.data() : null;
    const hasProfile = existingData?.profile?.dob;

    // Initialize credits server-side so the credit ledger is complete.
    // Track success: if init fails, the referral claim below must be
    // skipped this session — a successful claim would define `credits`,
    // and the server guard would then treat the signup bonus as already
    // granted, permanently skipping it. Both retry on next login.
    let creditsReady = existingData?.credits !== undefined;
    if (!creditsReady) {
      const idToken = await currentUser.getIdToken();
      const initRes = await fetch("/api/credits/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      creditsReady = initRes.ok;
      if (!initRes.ok) {
        console.error(
          "[Auth] Credits initialization failed:",
          initRes.status,
        );
      }
      await setDoc(
        userDocRef,
        {
          email: currentUser.email,
          createdAt: existingData?.createdAt || serverTimestamp(),
        },
        { merge: true },
      );
    }

    // Migrate a guest profile to Firestore if the user has no profile
    // yet. Only trust artifacts of a real guest onboarding session —
    // sessionStorage GUEST_PROFILE, or localStorage PROFILE when this
    // session's GUEST_COMPLETE marker is present. A bare PROFILE left in
    // localStorage by a previous account on this browser must never
    // migrate into a new uid.
    if (!hasProfile) {
      const guestData = sessionStorage.getItem(
        STORAGE_KEYS.GUEST_PROFILE,
      );
      const guestComplete = sessionStorage.getItem(
        STORAGE_KEYS.GUEST_COMPLETE,
      );
      const localData = guestComplete
        ? localStorage.getItem(STORAGE_KEYS.PROFILE)
        : null;
      const profileJson = guestData || localData;

      if (profileJson) {
        try {
          const parsed = JSON.parse(profileJson);
          if (parsed.dob && parsed.tob) {
            console.log("[Auth] Migrating guest profile to Firestore");
            // Whitelist known profile fields — don't persist arbitrary
            // keys from localStorage into the user document.
            const profile = {
              name:
                typeof parsed.name === "string"
                  ? parsed.name.slice(0, 100)
                  : "",
              dob: String(parsed.dob).slice(0, 20),
              tob: String(parsed.tob).slice(0, 20),
              pob:
                typeof parsed.pob === "string"
                  ? parsed.pob.slice(0, 200)
                  : "",
              gender:
                typeof parsed.gender === "string"
                  ? parsed.gender.slice(0, 20)
                  : "",
              lat: typeof parsed.lat === "number" ? parsed.lat : null,
              lng: typeof parsed.lng === "number" ? parsed.lng : null,
              coordinates: parsed.coordinates ?? null,
              birthTimeUnknown: Boolean(parsed.birthTimeUnknown),
            } as Record<string, any>;
            // Sidereal signs, when the guest session already derived
            // them — validated, since storage is untrusted.
            const moonSign = storedSignName(parsed.moonSign);
            const sunSign = storedSignName(parsed.sunSign);
            if (moonSign) profile.moonSign = moonSign;
            if (sunSign) profile.sunSign = sunSign;
            if (
              typeof parsed.moonNakshatra === "string" &&
              parsed.moonNakshatra.trim()
            ) {
              profile.moonNakshatra = parsed.moonNakshatra
                .trim()
                .slice(0, 40);
            }
            await setDoc(
              userDocRef,
              { profile, updatedAt: new Date() },
              { merge: true },
            );
            if (
              !moonSign &&
              normalizeZodiacMode(parsed.zodiacMode) === "vedic"
            ) {
              void backfillMigratedSigns(currentUser, profile);
            }
            // Clean up guest session data after migration
            sessionStorage.removeItem(STORAGE_KEYS.GUEST_PROFILE);
            sessionStorage.removeItem(STORAGE_KEYS.GUEST_COMPLETE);
          }
        } catch {
          // Ignore invalid JSON
        }
      }
    }
    const urlReferralCode = captureReferralFromUrl();
    const pendingReferralCode =
      getPendingReferralCode() || urlReferralCode;
    if (
      creditsReady &&
      pendingReferralCode &&
      !existingData?.referredBy &&
      !existingData?.referralClaimedAt
    ) {
      try {
        const idToken = await currentUser.getIdToken();
        const response = await fetch("/api/referrals/claim", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            idToken,
            referralCode: pendingReferralCode,
          }),
        });

        // 400/404/409 are permanent (invalid, unknown, or already
        // claimed) — drop the pending code. Keep it on 429/5xx so the
        // claim retries on the next login.
        if (
          response.ok ||
          response.status === 400 ||
          response.status === 404 ||
          response.status === 409
        ) {
          clearPendingReferralCode();
        }
      } catch (referralError) {
        console.warn("[Auth] Referral claim unavailable:", referralError);
      }
    }
  } catch (err) {
    console.error("[Auth] Error initializing user:", err);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authResolved, setAuthResolved] = useState(false);
  const [redirectChecked, setRedirectChecked] = useState(false);
  const [accountSyncing, setAccountSyncing] = useState(false);
  const syncedUidRef = useRef<string | null>(null);

  // A pending Google redirect sign-in must resolve before we treat the first
  // auth state as final — otherwise a just-redirected user flashes as
  // signed-out.
  useEffect(() => {
    getRedirectResult(auth)
      .then((result) => applyPendingAnalyticsOptIn(Boolean(result?.user)))
      .catch((error) => {
        applyPendingAnalyticsOptIn(false);
        console.error("[Auth] Redirect sign-in failed:", error);
        sessionStorage.removeItem(STORAGE_KEYS.LOGIN_REDIRECT);
        window.dispatchEvent(
          new CustomEvent("astroyou-auth-error", {
            detail: error?.message || "Google sign-in failed.",
          }),
        );
        // Redirect result errors are non-fatal for app boot.
      })
      .finally(() => {
        setRedirectChecked(true);
      });
  }, []);

  // `loading` covers only Firebase's first auth state (plus the redirect
  // result). Account bootstrap runs afterwards in the background.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthResolved(true);

      if (!currentUser) {
        syncedUidRef.current = null;
        setAccountSyncing(false);
        return;
      }
      // Token refreshes re-fire this listener; bootstrap once per uid.
      if (syncedUidRef.current === currentUser.uid) return;
      syncedUidRef.current = currentUser.uid;
      setAccountSyncing(true);
      void initializeAccount(currentUser).finally(() => {
        if (syncedUidRef.current === currentUser.uid) setAccountSyncing(false);
      });
    });

    return unsubscribe;
  }, []);

  const loading = !redirectChecked || !authResolved;

  const signOut = async () => {
    await firebaseSignOut(auth);
    // Centralized logout cleanup — every per-user client artifact goes, so a
    // different account signing in on this browser can never migrate the
    // previous user's profile, drafts, or trial state into its own uid.
    localStorage.removeItem(STORAGE_KEYS.PROFILE);
    localStorage.removeItem(STORAGE_KEYS.PROFILE_COMPLETE);
    localStorage.removeItem(STORAGE_KEYS.FREE_SECONDS);
    sessionStorage.removeItem(STORAGE_KEYS.GUEST_PROFILE);
    sessionStorage.removeItem(STORAGE_KEYS.GUEST_COMPLETE);
    sessionStorage.removeItem(STORAGE_KEYS.MODE);
    sessionStorage.removeItem(STORAGE_KEYS.LOGIN_REDIRECT);
    sessionStorage.removeItem(STORAGE_KEYS.SYNTHESIS_DRAFT);
    sessionStorage.removeItem(STORAGE_KEYS.CONSULT_DRAFT);
    // A just-run compatibility match (both people's details) handed to chat.
    sessionStorage.removeItem(COMPATIBILITY_CONTEXT_KEY);
    // Reset the anonymous analytics device id so a different account signing in
    // on this browser isn't linked to the previous user's events.
    localStorage.removeItem("astroyou:analytics_id");
    // The privacy policy says signing out withdraws analytics consent: stop
    // collection now and forget the opt-in so the next load doesn't restart
    // GA4. The user can opt in again at sign-in or in Settings.
    setAnalyticsConsent(false);
  };

  return (
    <AuthContext.Provider value={{ user, loading, accountSyncing, signOut }}>
      {loading ? (
        <div
          role="status"
          aria-live="polite"
          className="flex min-h-screen items-center justify-center bg-[#030308]"
        >
          <span className="h-2 w-2 animate-pulse rounded-full bg-gold/70" />
          <span className="sr-only">Loading AstroYou</span>
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
}
