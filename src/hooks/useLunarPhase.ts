import { useState, useEffect } from "react";
import { useRequestBirthData } from "./useRequestBirthData";
import { postJson } from "../lib/apiFetch";
import { viewerDateKey } from "../lib/viewer-timezone";

export interface LunarPhaseData {
  phase: string;
  illumination: number;
  emoji: string;
}

const PHASE_EMOJIS: Record<string, string> = {
  "new moon": "\u{1F311}",
  "waxing crescent": "\u{1F312}",
  "first quarter": "\u{1F313}",
  "waxing gibbous": "\u{1F314}",
  "full moon": "\u{1F315}",
  "waning gibbous": "\u{1F316}",
  "last quarter": "\u{1F317}",
  "third quarter": "\u{1F317}",
  "waning crescent": "\u{1F318}",
};

function getPhaseEmoji(phase: string): string {
  const lower = phase.toLowerCase();
  for (const [key, emoji] of Object.entries(PHASE_EMOJIS)) {
    if (lower.includes(key)) return emoji;
  }
  return "\u{1F315}";
}

interface UseLunarPhaseResult {
  lunar: LunarPhaseData | null;
  loading: boolean;
  error: string | null;
}

export function useLunarPhase(birthData: any): UseLunarPhaseResult {
  const [lunar, setLunar] = useState<LunarPhaseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestBirthData = useRequestBirthData(birthData);

  useEffect(() => {
    if (!requestBirthData?.dob || !requestBirthData.tob) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();

    const fetchLunar = async () => {
      try {
        setLoading(true);
        setError(null);

        // Tonight's Moon where the user is now — not the Moon at birth.
        // The current location is a free-text place; when it differs from
        // the birth place it is sent as `city`, otherwise the geocoded birth
        // coordinates stand in for it.
        const current =
          typeof birthData?.currentLocation === "string"
            ? birthData.currentLocation.trim()
            : "";
        const atBirthPlace =
          !current ||
          current.toLowerCase() === (requestBirthData.pob || "").trim().toLowerCase();
        const coords = requestBirthData.coordinates;
        const sky = atBirthPlace
          ? coords
            ? { lat: coords.lat, lng: coords.lng }
            : requestBirthData.pob
              ? { city: requestBirthData.pob }
              : {}
          : { city: current };
        const response = await postJson(
          "/api/kundali",
          {
            birthData: requestBirthData,
            chartType: "LUNAR_PHASES",
            localDate: viewerDateKey(),
            ...sky,
          },
          { signal: controller.signal },
        );

        if (!response.ok) throw new Error("Failed to fetch lunar phase");

        const result = await response.json();
        const data = result.data ?? result;

        const phase =
          data.phase ||
          data.moon_phase ||
          data.lunar_phase ||
          data.current_phase ||
          "Unknown";
        const illumination =
          data.illumination ?? data.illumination_pct ?? data.percent ?? 0;

        setLunar({
          phase,
          illumination:
            typeof illumination === "number"
              ? illumination
              : parseFloat(illumination) || 0,
          emoji: getPhaseEmoji(phase),
        });
      } catch (err: any) {
        if (err.name === "AbortError") return;
        console.error("[useLunarPhase] Error:", err);
        setError(err.message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    fetchLunar();
    return () => controller.abort();
  }, [requestBirthData, birthData?.currentLocation]);

  return { lunar, loading, error };
}
