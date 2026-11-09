import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../lib/useAuth";
import { NatalTransitData } from "../types/kundali";
import { STORAGE_KEYS } from "../lib/constants";
import { parseStoredJSON } from "../lib/safeStorage";
import { postJson } from "../lib/apiFetch";
import { viewerDateKey } from "../lib/viewer-timezone";

interface TransitState {
  data: NatalTransitData | null;
  predictions: any[] | null;
  aiSummary: string | null;
  loading: boolean;
  error: string | null;
  /** True when there is no saved birth profile to calculate transits against. */
  needsProfile: boolean;
}

export function useTransit(transitDate?: string) {
  const { user } = useAuth();
  const [state, setState] = useState<TransitState>({
    data: null,
    predictions: null,
    aiSummary: null,
    loading: true,
    error: null,
    needsProfile: false,
  });
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchTransit() {
      // Get birth data from localStorage (guest or user). parseStoredJSON clears
      // a corrupt value and returns null instead of throwing, which would
      // otherwise leave this hook stuck at loading:true forever.
      const birthData = parseStoredJSON(localStorage, STORAGE_KEYS.PROFILE);
      if (!birthData) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: null,
          needsProfile: true,
        }));
        return;
      }

      try {
        setState((prev) => ({ ...prev, loading: true, error: null, needsProfile: false }));

        const response = await postJson(
          "/api/transit",
          {
            birthData,
            transitDate: transitDate || viewerDateKey(),
            localDate: viewerDateKey(),
          },
          { signal: controller.signal },
        );

        const result = await response.json().catch(() => null);

        if (response.ok && result?.success) {
          setState({
            data: result.data.positions,
            predictions: result.data.predictions,
            aiSummary: result.data.aiSummary,
            loading: false,
            error: null,
            needsProfile: false,
          });
        } else {
          throw new Error(result?.error || `Transit request failed: ${response.status}`);
        }
      } catch (err: any) {
        if (err.name === "AbortError") return;
        console.error("Transit hook error:", err);
        setState((prev) => ({
          ...prev,
          loading: false,
          error: "We couldn't load today's transits. Check your connection and try again.",
        }));
      }
    }

    fetchTransit();
    return () => controller.abort();
  }, [user, transitDate, attempt]);

  return { ...state, retry };
}
