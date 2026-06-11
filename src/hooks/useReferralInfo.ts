import { useState, useEffect, useMemo } from "react";
import { useAuth } from "../lib/useAuth";
import {
  buildReferralLink,
  createClientReferralCode,
  normalizeClientReferralCode,
} from "../lib/referrals";

export interface ReferralStats {
  invited: number;
  creditsEarned: number;
  referrerRewardCredits: number;
  refereeRewardCredits: number;
}

/**
 * Referral code, share link, and reward stats for the signed-in user.
 * Falls back to a client-derived code while (or if) the server lookup fails.
 */
export function useReferralInfo() {
  const { user } = useAuth();
  const [code, setCode] = useState("");
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setCode("");
      setStats(null);
      setError(null);
      return;
    }

    let cancelled = false;
    const fallbackCode = createClientReferralCode(user.uid);
    setCode(fallbackCode);
    setLoading(true);
    setError(null);

    const loadReferralInfo = async () => {
      try {
        const idToken = await user.getIdToken();
        const response = await fetch("/api/referrals/info", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok)
          throw new Error(data.error || "Could not load referrals");
        if (cancelled) return;
        setCode(normalizeClientReferralCode(data.code) || fallbackCode);
        setStats({
          invited: Number(data.stats?.invited) || 0,
          creditsEarned: Number(data.stats?.creditsEarned) || 0,
          referrerRewardCredits:
            Number(data.stats?.referrerRewardCredits) || 25,
          refereeRewardCredits: Number(data.stats?.refereeRewardCredits) || 15,
        });
      } catch {
        if (!cancelled) {
          setError("Stats unavailable");
          setStats(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadReferralInfo();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const link = useMemo(
    () =>
      typeof window === "undefined" || !code
        ? ""
        : buildReferralLink(window.location.origin, code),
    [code],
  );

  return { code, link, stats, loading, error };
}
