import { createContext } from "react";
import type { User } from "firebase/auth";

export interface AuthContextType {
  user: User | null;
  /** True only until Firebase reports its first auth state. */
  loading: boolean;
  /**
   * True while the signed-in account is bootstrapped in the background (user
   * doc creation, credits init, guest-profile migration, referral claim). A
   * missing profile or credits field while this is true means "not loaded
   * yet", not "absent".
   */
  accountSyncing: boolean;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
