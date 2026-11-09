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

        const text = (value: unknown): string =>
          typeof value === "string" ? value.trim() : "";
        const normalized: Remedy[] = remedyArray
          .map((r: any) => ({
            category:
              text(r?.category) || text(r?.type) || text(r?.remedy_type) || "Ritual",
            name: text(r?.name) || text(r?.title) || text(r?.remedy_name),
            detail:
              text(r?.detail) ||
              text(r?.description) ||
              text(r?.details) ||
              text(r?.instructions),
            planet: text(r?.planet) || text(r?.related_planet) || undefined,
          }))
          // A remedy without a name can't be shown honestly — drop it rather
          // than rendering "Unknown".
          .filter((r: Remedy) => r.name.length > 0);

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
        if (!controller.signal.aborted || timedOut) setLoading(false);
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
