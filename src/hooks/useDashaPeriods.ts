import { useState, useEffect } from "react";
import { postJson } from "../lib/apiFetch";

interface DashaBirthSource {
  dob?: string;
  tob?: string;
  pob?: string;
  coordinates?: { lat: number; lng: number };
}

/**
 * Vimshottari dasha periods via /api/kundali (chartType: DASHAS),
 * used by the dasha timeline. Returns [] until loaded.
 */
export function useDashaPeriods(userData: DashaBirthSource | null) {
  const [periods, setPeriods] = useState<any[]>([]);

  const { dob, tob, pob } = userData ?? {};
  const lat = userData?.coordinates?.lat;
  const lng = userData?.coordinates?.lng;

  useEffect(() => {
    if (!dob || !tob) return;
    const birthData = { dob, tob, pob: pob || "Unknown", lat, lng };
    const controller = new AbortController();

    postJson(
      "/api/kundali",
      { birthData, chartType: "DASHAS" },
      { signal: controller.signal },
    )
      .then((r) => r.json())
      .then((res) => {
        const result = res.periods || res.data?.periods || [];
        if (Array.isArray(result)) setPeriods(result);
      })
      .catch((err) => {
        if (err.name !== "AbortError")
          console.warn("[useDashaPeriods] Dasha timeline unavailable:", err);
      });

    return () => controller.abort();
  }, [dob, tob, pob, lat, lng]);

  return periods;
}
