import { useState, useEffect } from "react";
import { postJson } from "../lib/apiFetch";
import { normalizePanchang, type PanchangData } from "../lib/panchang";
import { localDateKey, resolveTimezone } from "../lib/local-date";

// Re-exported so the dashboard components keep importing the type from the
// hook they already use. The shape and its parsing live in lib/panchang.ts,
// where they are pinned against a real API response by unit tests.
export type { PanchangData };

export function usePanchang(
  city?: string,
  lat?: number,
  lng?: number,
  timezone?: string,
) {
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
            // No New Delhi fallback here: panchang is location-derived
            // (sunrise, sunset, rahu kaal), so a wrong location is worse
            // than none — Delhi values are ~10.5h off for a US user. The
            // server applies its own shared-cache default when absent.
            ...(city ? { city } : {}),
            ...(lat !== undefined && lng !== undefined ? { lat, lng } : {}),
            localDate: localDateKey(resolveTimezone(timezone)),
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
  }, [city, lat, lng, timezone]);

  return { panchang, loading, error };
}
