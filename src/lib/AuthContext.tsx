import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import {
  User,
  onAuthStateChanged,
  signOut as firebaseSignOut,
  getRedirectResult,
} from "firebase/auth";
import { auth, db } from "./firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { STORAGE_KEYS } from "./constants";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [redirectChecked, setRedirectChecked] = useState(false);

  // Handle redirect result on app load - this MUST run before we consider auth ready
  useEffect(() => {
    getRedirectResult(auth)
      .catch(() => {
        // Redirect result errors are non-fatal (e.g. no pending redirect)
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

      // Initialize user doc + migrate guest/localStorage profile data on first login
      if (currentUser) {
        try {
          const userDocRef = doc(db, "users", currentUser.uid);
          const docSnap = await getDoc(userDocRef);
          const existingData = docSnap.exists() ? docSnap.data() : null;
          const hasProfile = existingData?.profile?.dob;

          // Initialize credits if missing
          if (!existingData || existingData.credits === undefined) {
            await setDoc(
              userDocRef,
              {
                email: currentUser.email,
                credits: 15,
                createdAt: existingData?.createdAt || serverTimestamp(),
              },
              { merge: true }
            );
          }

          // Migrate guest/localStorage profile to Firestore if user has no profile yet
          if (!hasProfile) {
            const guestData = sessionStorage.getItem(STORAGE_KEYS.GUEST_PROFILE);
            const localData = localStorage.getItem(STORAGE_KEYS.PROFILE);
            const profileJson = guestData || localData;

            if (profileJson) {
              try {
                const profile = JSON.parse(profileJson);
                if (profile.dob && profile.tob) {
                  console.log("[Auth] Migrating guest profile to Firestore");
                  await setDoc(
                    userDocRef,
                    { profile, updatedAt: new Date() },
                    { merge: true }
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
          // Check for referral code in URL
          const urlParams = new URLSearchParams(window.location.search);
          const refCode = urlParams.get('ref');
          if (refCode && currentUser) {
            try {
              const userDocRef2 = doc(db, "users", currentUser.uid);
              const userDoc2 = await getDoc(userDocRef2);
              if (!userDoc2.data()?.referredBy) {
                await setDoc(userDocRef2, { referredBy: refCode }, { merge: true });
              }
            } catch {
              // Ignore referral tracking errors
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
  };

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
