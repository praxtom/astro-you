import { useState, useEffect } from "react";
import { useAuth } from "../lib/useAuth";
import { NatalTransitData } from "../types/kundali";
import { STORAGE_KEYS } from "../lib/constants";
import { postJson } from "../lib/apiFetch";

interface TransitState {
  data: NatalTransitData | null;
  predictions: any[] | null;
  aiSummary: string | null;
  loading: boolean;
  error: string | null;
}

export function useTransit(transitDate?: string) {
  const { user } = useAuth();
  const [state, setState] = useState<TransitState>({
    data: null,
    predictions: null,
    aiSummary: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    const controller = new AbortController();

    async function fetchTransit() {
      // Get birth data from localStorage (guest or user)
      const storedProfile = localStorage.getItem(STORAGE_KEYS.PROFILE);
      if (!storedProfile) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: "No profile found",
        }));
        return;
      }

      const birthData = JSON.parse(storedProfile);

      try {
        setState((prev) => ({ ...prev, loading: true, error: null }));

        const response = await postJson("/api/transit", {
            birthData,
            transitDate: transitDate || new Date().toISOString().split("T")[0],
          }, { signal: controller.signal });

        const result = await response.json();

        if (result.success) {
          setState({
            data: result.data.positions,
            predictions: result.data.predictions,
            aiSummary: result.data.aiSummary,
            loading: false,
            error: null,
          });
        } else {
          throw new Error(result.error || "Failed to fetch transit data");
        }
      } catch (err: any) {
        if (err.name === "AbortError") return;
        console.error("Transit hook error:", err);
        setState((prev) => ({ ...prev, loading: false, error: err.message }));
      }
    }

    fetchTransit();
    return () => controller.abort();
  }, [user, transitDate]);

  return state;
}
