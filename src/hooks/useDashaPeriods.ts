import { useState, useEffect, useCallback } from "react";
import { postJson } from "../lib/apiFetch";
import {
  PersonalDataError,
  errorKindOf,
  type PersonalDataErrorKind,
} from "../lib/personal-data-error";

interface DashaBirthSource {
  dob?: string;
  tob?: string;
  pob?: string;
  coordinates?: { lat: number; lng: number };
  birthTimeUnknown?: boolean;
}

export interface DashaPeriodSummary {
  planet: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  subPeriods?: DashaPeriodSummary[];
}

export interface UseDashaPeriodsResult {
  periods: DashaPeriodSummary[];
  /** Birth time unknown — the dates can be years off. */
  approximate: boolean;
  loading: boolean;
  errorKind: PersonalDataErrorKind | null;
  retry: () => void;
}

/**
 * Vimshottari dasha periods via /api/kundali (chartType: DASHAS).
 *
 * The Dashboard calls this ONCE and passes the result to every consumer
 * (DashaCard, DashaTimeline, the "chart in three lines" card, the dasha
 * monitor) — each DASHAS request is a paid astrology-API call.
 */
export function useDashaPeriods(
  userData: DashaBirthSource | null,
): UseDashaPeriodsResult {
  const [periods, setPeriods] = useState<DashaPeriodSummary[]>([]);
  const [approximate, setApproximate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorKind, setErrorKind] = useState<PersonalDataErrorKind | null>(
    null,
  );
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  const { dob, tob, pob } = userData ?? {};
  const lat = userData?.coordinates?.lat;
  const lng = userData?.coordinates?.lng;
  const birthTimeUnknown = userData?.birthTimeUnknown === true;

  useEffect(() => {
    if (!dob || !tob) {
      setPeriods([]);
      setLoading(false);
      setErrorKind(null);
      return;
    }
    // Never send a placeholder place ("Unknown") upstream — it gets geocoded.
    // Without a pob the coordinates locate the chart.
    const birthData = {
      dob,
      tob,
      ...(pob?.trim() ? { pob } : {}),
      lat,
      lng,
      ...(birthTimeUnknown ? { birthTimeUnknown: true } : {}),
    };
    const controller = new AbortController();
    setLoading(true);
    setErrorKind(null);

    postJson(
      "/api/kundali",
      { birthData, chartType: "DASHAS" },
      { signal: controller.signal },
    )
      .then((r) => {
        if (!r.ok) throw new PersonalDataError(r.status);
        return r.json();
      })
      .then((res) => {
        const result = res.periods || res.data?.periods || [];
        setApproximate(res.approximate === true);
        if (Array.isArray(result) && result.length > 0) {
          setPeriods(result);
        } else {
          // The server returns [] when the upstream dasha call failed.
          setPeriods([]);
          setErrorKind("unavailable");
        }
        setLoading(false);
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        console.warn("[useDashaPeriods] Dasha periods unavailable:", err);
        setErrorKind(errorKindOf(err));
        setLoading(false);
      });

    return () => controller.abort();
  }, [dob, tob, pob, lat, lng, birthTimeUnknown, attempt]);

  return { periods, approximate, loading, errorKind, retry };
}
