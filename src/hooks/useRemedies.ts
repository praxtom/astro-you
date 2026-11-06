import { useState, useEffect, useCallback } from "react";
import { PersonalDataError, errorKindOf, type PersonalDataErrorKind } from "../lib/personal-data-error";
import type { BirthData } from "../types";
import { useRequestBirthData } from "./useRequestBirthData";
import { postJson } from "../lib/apiFetch";

export interface Remedy {
  category: string;
  name: string;
  detail: string;
  planet?: string;
}

export interface RemediesData {
  remedies: Remedy[];
  [key: string]: unknown;
}

interface UseRemediesResult {
  remedies: RemediesData | null;
  loading: boolean;
  error: string | null;
  errorKind: PersonalDataErrorKind | null;
  retry: () => void;
}

export function useRemedies(birthData: BirthData | null): UseRemediesResult {
  const [remedies, setRemedies] = useState<RemediesData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<PersonalDataErrorKind | null>(
    null,
  );
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const requestBirthData = useRequestBirthData(birthData);

  useEffect(() => {
    if (!requestBirthData?.dob || !requestBirthData.tob) {
      setRemedies(null);
      setError(null);
      setErrorKind(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    let timedOut = false;
    const timeoutId = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 8000);

    const fetchRemedies = async () => {
      try {
        setLoading(true);
        setError(null);
        setErrorKind(null);

        const response = await postJson(
          "/api/kundali",
          { birthData: requestBirthData, chartType: "REMEDIES" },
          { signal: controller.signal },
        );

        if (!response.ok) throw new PersonalDataError(response.status);

        const result = await response.json();
        const raw = result.data ?? result;

        // Handle multiple possible response structures
        const remedyArray = Array.isArray(raw.remedies)
          ? raw.remedies
          : Array.isArray(raw.data?.remedies)
            ? raw.data.remedies
            : Array.isArray(raw)
              ? raw
              : [];

        const normalized = remedyArray.map((r: any) => ({
          category: r.category || r.type || r.remedy_type || "Ritual",
          name: r.name || r.title || r.remedy_name || "Unknown",
          detail:
            r.detail || r.description || r.details || r.instructions || "",
          planet: r.planet || r.related_planet || undefined,
        }));

        setRemedies({ remedies: normalized });
      } catch (err: any) {
        if (err.name === "AbortError") {
          if (timedOut) {
            setError("Remedies took too long to load");
            setErrorKind("unavailable");
          }
          return;
        }
        console.error("[useRemedies] Error:", err);
        setError(err.message);
        setErrorKind(errorKindOf(err));
      } finally {
        window.clearTimeout(timeoutId);
        setLoading(false);
      }
    };

    fetchRemedies();
    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [requestBirthData, attempt]);

  return { remedies, loading, error, errorKind, retry };
}
