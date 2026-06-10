import { useEffect, useState } from "react";
import type { PublicTrustSummary } from "../lib/trust-summary";

export function useTrustSummary() {
  const [summary, setSummary] = useState<PublicTrustSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchSummary() {
      try {
        setLoading(true);
        const response = await fetch("/api/trust/summary", {
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok || data?.error) return;
        setSummary(data);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    fetchSummary();
    return () => controller.abort();
  }, []);

  return { summary, loading };
}
