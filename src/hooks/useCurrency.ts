import { useCallback } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/useAuth";
import { useUserProfile } from "./useUserProfile";
import {
  detectCurrency,
  normalizeCurrency,
  type Currency,
} from "../lib/currency";

/**
 * The currency to display and charge in.
 *
 * Resolution order: an explicit choice stored on the profile, then a guess from
 * the browser locale and the profile's timezone. The guess is only ever a
 * starting point — `setCurrency` records a real choice, which then wins.
 */
export function useCurrency(): {
  currency: Currency;
  setCurrency: (next: Currency) => Promise<void>;
} {
  const { user } = useAuth();
  const { profile } = useUserProfile();

  const currency = profile?.currency
    ? normalizeCurrency(profile.currency)
    : detectCurrency(
        typeof navigator !== "undefined" ? navigator.language : null,
        profile?.timezone ?? null,
      );

  const setCurrency = useCallback(
    async (next: Currency) => {
      if (!user) return;
      await updateDoc(doc(db, "users", user.uid), {
        "profile.currency": normalizeCurrency(next),
        updatedAt: new Date(),
      });
    },
    [user],
  );

  return { currency, setCurrency };
}
