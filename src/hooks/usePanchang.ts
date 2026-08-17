import { useState, useEffect } from "react";
import { postJson } from "../lib/apiFetch";
import { normalizePanchang, type PanchangData } from "../lib/panchang";

// Re-exported so the dashboard components keep importing the type from the
// hook they already use. The shape and its parsing live in lib/panchang.ts,
// where they are pinned against a real API response by unit tests.
export type { PanchangData };

export function usePanchang(city?: string, lat?: number, lng?: number) {
  const [panchang, setPanchang] = useState<PanchangData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const fetchPanchang = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await postJson(
          "/api/kundali",
          {
            chartType: "PANCHANG",
            city: city ?? "New Delhi",
            lat: lat ?? 28.6139,
            lng: lng ?? 77.209,
          },
          { signal: controller.signal },
        );

        if (!response.ok) {
          throw new Error("Failed to fetch Panchang data");
        }

        const result = await response.json();
        setPanchang(normalizePanchang(result.data ?? result));
      } catch (err: any) {
        if (err.name === "AbortError") return;
        console.error("[usePanchang] Error:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchPanchang();
    return () => controller.abort();
  }, [city, lat, lng]);

  return { panchang, loading, error };
}
