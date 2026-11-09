import { useEffect, useState } from "react";
import type { PublicTrustSummary } from "../lib/trust-summary";

export function useTrustSummary() {
  const [summary, setSummary] = useState<PublicTrustSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchSummary() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch("/api/trust/summary", {
          signal: controller.signal,
        });
        const data = await response.json().catch(() => null);
        if (!response.ok || !data || data.error) {
          console.error("Trust summary failed:", response.status, data?.error);
          setError("Trust summary couldn't be loaded.");
          return;
        }
        setSummary(data);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error("Trust summary failed:", err);
        setError("Trust summary couldn't be loaded.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    fetchSummary();
    return () => controller.abort();
  }, []);

  return { summary, loading, error };
}
