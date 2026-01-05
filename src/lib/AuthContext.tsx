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
import { auth } from "./firebase";

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
    console.log("[Auth] Checking for redirect result...");

    getRedirectResult(auth)
      .then((result) => {
        console.log("[Auth] Redirect result:", result);
        if (result?.user) {
          console.log("[Auth] User from redirect:", result.user.email);
        } else {
          console.log("[Auth] No redirect result (user came directly to page)");
        }
      })
      .catch((error) => {
        console.error(
          "[Auth] Redirect result error:",
          error.code,
          error.message
        );
      })
      .finally(() => {
        setRedirectChecked(true);
      });
  }, []);

  // Set up auth state listener after redirect check
  useEffect(() => {
    if (!redirectChecked) return;

    console.log("[Auth] Setting up auth state listener...");

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      console.log("[Auth] Auth state changed:", currentUser?.email || "null");
      setUser(currentUser);
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
