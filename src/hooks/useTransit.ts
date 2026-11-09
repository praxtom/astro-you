import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../lib/useAuth";
import type { NatalTransitData } from "../types/kundali";
import type { BirthData } from "../types";
import { postJson } from "../lib/apiFetch";
import { viewerDateKey } from "../lib/viewer-timezone";
import { FEATURE_CREDIT_COST, creditLabel } from "../lib/feature-pricing";
import { useRequestBirthData } from "./useRequestBirthData";

/** Why the transit reading is missing, so the page can offer the right fix. */
export type TransitErrorKind = "auth" | "credits" | "unavailable";

interface TransitState {
  data: NatalTransitData | null;
  predictions: any[] | null;
  aiSummary: string | null;
  loading: boolean;
  error: string | null;
  errorKind: TransitErrorKind | null;
  /** True when there is no saved birth profile to calculate transits against. */
  needsProfile: boolean;
}

interface UseTransitOptions {
  /**
   * False holds the request (e.g. until the user confirms the credit charge,
   * or while the profile is still loading). Nothing is fetched or charged.
   */
  enabled?: boolean;
}

/**
 * Today's transits over the user's chart. Birth data comes from the caller
 * (useUserProfile's birthData: Firestore for signed-in users, stored profile
 * for guests), so a fresh device and profile edits both work.
 */
export function useTransit(
  birthData: BirthData | null,
  transitDate?: string,
  { enabled = true }: UseTransitOptions = {},
) {
  const { user } = useAuth();
  const requestBirthData = useRequestBirthData(birthData);
  const [state, setState] = useState<TransitState>({
    data: null,
    predictions: null,
    aiSummary: null,
    loading: true,
    error: null,
    errorKind: null,
    needsProfile: false,
  });
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    if (!enabled) {
      setState((prev) => ({ ...prev, loading: false }));
      return;
    }
    if (!requestBirthData?.dob || !requestBirthData.tob) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: null,
        errorKind: null,
        needsProfile: true,
      }));
      return;
    }
    // Transits are read against a saved chart and billed, so the server
    // requires an account; say so instead of firing a request that 401s.
    if (!user) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: "Sign in to see today's transits over your chart.",
        errorKind: "auth",
        needsProfile: false,
      }));
      return;
    }

    const controller = new AbortController();

    async function fetchTransit() {
      try {
        setState((prev) => ({
          ...prev,
          loading: true,
          error: null,
          errorKind: null,
          needsProfile: false,
        }));

        const response = await postJson(
          "/api/transit",
          {
            birthData: requestBirthData,
            transitDate: transitDate || viewerDateKey(),
            localDate: viewerDateKey(),
          },
          { signal: controller.signal },
        );

        const result = await response.json().catch(() => null);
        if (controller.signal.aborted) return;

        if (response.ok && result?.success) {
          setState({
            data: result.data.positions,
            predictions: result.data.predictions,
            aiSummary: result.data.aiSummary,
            loading: false,
            error: null,
            errorKind: null,
            needsProfile: false,
          });
          return;
        }
        if (response.status === 402) {
          setState((prev) => ({
            ...prev,
            loading: false,
            error: `You're out of credits. Today's transit reading costs ${creditLabel(FEATURE_CREDIT_COST.transit)}.`,
            errorKind: "credits",
          }));
          return;
        }
        if (response.status === 401) {
          setState((prev) => ({
            ...prev,
            loading: false,
            error: "Sign in to see today's transits over your chart.",
            errorKind: "auth",
          }));
          return;
        }
        if (response.status === 429) {
          setState((prev) => ({
            ...prev,
            loading: false,
            error:
              typeof result?.error === "string" && result.error
                ? result.error
                : "Too many attempts right now. Please try again later.",
            errorKind: "unavailable",
          }));
          return;
        }
        throw new Error(
          result?.error || `Transit request failed: ${response.status}`,
        );
      } catch (err: any) {
        if (err.name === "AbortError") return;
        console.error("Transit hook error:", err);
        setState((prev) => ({
          ...prev,
          loading: false,
          error:
            "We couldn't load today's transits. Check your connection and try again.",
          errorKind: "unavailable",
        }));
      }
    }

    fetchTransit();
    return () => controller.abort();
  }, [user, requestBirthData, transitDate, attempt, enabled]);

  return { ...state, retry };
}
