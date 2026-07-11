import { useEffect, useState, ReactNode } from "react";
import {
  type User,
  onAuthStateChanged,
  signOut as firebaseSignOut,
  getRedirectResult,
} from "firebase/auth";
import { auth, db, enableAnalytics } from "./firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { STORAGE_KEYS } from "./constants";
import {
  captureReferralFromUrl,
  clearPendingReferralCode,
  getPendingReferralCode,
} from "./acquisition";
import { AuthContext } from "./authContextValue";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [redirectChecked, setRedirectChecked] = useState(false);

  // Handle redirect result on app load - this MUST run before we consider auth ready
  useEffect(() => {
    getRedirectResult(auth)
      .catch((error) => {
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

  // Set up auth state listener after redirect check
  useEffect(() => {
    if (!redirectChecked) return;

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      // Signing in follows the Terms/Privacy notice shown at the auth modal, so
      // treat an authenticated session as analytics consent — GA4 stays off for
      // anonymous visitors who never accepted it.
      if (currentUser) enableAnalytics();

      // Initialize user doc + migrate guest/localStorage profile data on first login
      if (currentUser) {
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
                  };
                  await setDoc(
                    userDocRef,
                    { profile, updatedAt: new Date() },
                    { merge: true },
                  );
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

      setLoading(false);
    });

    return unsubscribe;
  }, [redirectChecked]);

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
    // Reset the anonymous analytics device id so a different account signing in
    // on this browser isn't linked to the previous user's events.
    localStorage.removeItem("astroyou:analytics_id");
  };

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
