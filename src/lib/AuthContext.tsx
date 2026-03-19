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

      // Initialize credits if user exists but doc/credits missing
      if (currentUser) {
        try {
          const userDocRef = doc(db, "users", currentUser.uid);
          const docSnap = await getDoc(userDocRef);

          if (!docSnap.exists() || docSnap.data()?.credits === undefined) {
            await setDoc(
              userDocRef,
              {
                email: currentUser.email,
                credits: 15, // Initial bonus
                createdAt: docSnap.exists()
                  ? docSnap.data()?.createdAt || serverTimestamp()
                  : serverTimestamp(),
              },
              { merge: true }
            );
          }
        } catch (err) {
          console.error("[Auth] Error checking/initializing credits:", err);
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
