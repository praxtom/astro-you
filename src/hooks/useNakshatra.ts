import { useState, useEffect, useCallback } from "react";
import { PersonalDataError, errorKindOf, type PersonalDataErrorKind } from "../lib/personal-data-error";
import { useRequestBirthData } from "./useRequestBirthData";
import { postJson } from "../lib/apiFetch";

export interface NakshatraData {
  name: string;
  deity?: string;
  prediction?: string;
  ruler?: string;
  symbol?: string;
}

export interface UseNakshatraResult {
  nakshatra: NakshatraData | null;
  loading: boolean;
  error: string | null;
  errorKind: PersonalDataErrorKind | null;
  retry: () => void;
}

export function useNakshatra(birthData: any): UseNakshatraResult {
  const [nakshatra, setNakshatra] = useState<NakshatraData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<PersonalDataErrorKind | null>(
    null,
  );
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const requestBirthData = useRequestBirthData(birthData);

  useEffect(() => {
    if (!requestBirthData?.dob || !requestBirthData.tob) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();

    const fetchNakshatra = async () => {
      try {
        setLoading(true);
        setError(null);
        setErrorKind(null);

        const response = await postJson(
          "/api/kundali",
          {
            birthData: requestBirthData,
            chartType: "NAKSHATRA",
          },
          { signal: controller.signal },
        );

        if (!response.ok) throw new PersonalDataError(response.status);

        const result = await response.json();
        const data = result.data ?? result;

        setNakshatra({
          name: data.name || data.nakshatra_name || data.nakshatra || "Unknown",
          deity: data.deity || data.devata || data.ruling_deity || undefined,
          prediction:
            data.prediction ||
            data.today_prediction ||
            data.daily_prediction ||
            data.interpretation ||
            undefined,
          ruler: data.ruler || data.ruling_planet || data.lord || undefined,
          symbol: data.symbol || undefined,
        });
      } catch (err: any) {
        if (err.name === "AbortError") return;
        console.error("[useNakshatra] Error:", err);
        setError(err.message);
        setErrorKind(errorKindOf(err));
      } finally {
        setLoading(false);
      }
    };

    fetchNakshatra();
    return () => controller.abort();
  }, [requestBirthData, attempt]);

  return { nakshatra, loading, error, errorKind, retry };
}
