import { useState, useEffect } from "react";
import { viewerDateKey } from "../lib/viewer-timezone";
import { normalizeZodiacMode, type ZodiacMode } from "../lib/zodiac-mode";

interface PredictionSubjectData {
  name?: string;
  dob?: string;
  tob?: string;
  pob?: string;
  sunSign?: string;
  zodiacMode?: ZodiacMode;
}

/**
 * Tropical Sun sign from a birth date.
 *
 * This is a *Western* construct: the date ranges only hold for the tropical
 * zodiac. It must never be used in vedic mode, where the sidereal Sun sits
 * roughly one sign earlier — that mismatch is what made the dashboard chart
 * and this forecast disagree about the same person's sign.
 */
function getTropicalSunSign(day: number, month: number): string {
  const signs = [
    "Capricorn",
    "Aquarius",
    "Pisces",
    "Aries",
    "Taurus",
    "Gemini",
    "Cancer",
    "Leo",
    "Virgo",
    "Libra",
    "Scorpio",
    "Sagittarius",
  ];
  const boundaries = [20, 19, 21, 20, 21, 21, 23, 23, 23, 23, 22, 22];
  return day < boundaries[month - 1] ? signs[month - 1] : signs[month % 12];
}

/**
 * Sign-based daily prediction text from /api/daily-prediction.
 * Aborts after 7s so the dashboard never hangs on a slow upstream.
 */
export function useDailyPrediction(userData: PredictionSubjectData | null) {
  const [prediction, setPrediction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { dob, sunSign, zodiacMode } = userData ?? {};
  const mode = normalizeZodiacMode(zodiacMode);

  useEffect(() => {
    setPrediction(null);
    setError(null);
    if (!dob) return;

    const controller = new AbortController();
    let cancelled = false;
    const timeoutId = window.setTimeout(() => controller.abort(), 7000);
    setLoading(true);

    const fetchPrediction = async () => {
      try {
        const [, month, day] = dob.split("-").map(Number);

        // In vedic mode the sign MUST come from the sidereal chart. The
        // tropical date table below disagrees with it by about one sign,
        // which is exactly what made the dashboard and this forecast
        // contradict each other about the same person.
        const zodiacSign =
          sunSign ||
          (mode === "western" ? getTropicalSunSign(day, month) : null);

        // No sign yet in vedic mode: wait for the chart rather than guess.
        if (!zodiacSign) {
          if (!cancelled) setLoading(false);
          return;
        }

        // Only `sign`, `date` and `format` are sent. The endpoint recasts from
        // its own SIGN_ANCHOR_DOB and ignores any client-supplied subject, so
        // the old `subject`/`options` payload was dead weight — and its country
        // code was derived as pobParts[1].slice(0,2), which turned
        // "New York, New York, United States" into "NE" (Niger) and London
        // into "GR" (Greece).
        const response = await fetch("/api/daily-prediction", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sign: zodiacSign,
            format: "short",
            // The viewer's local day: a UTC key served US evening users
            // tomorrow's horoscope from ~5pm.
            date: viewerDateKey(),
          }),
          signal: controller.signal,
        });

        if (!response.ok) throw new Error("Daily prediction request failed");
        const result = await response.json();
        if (cancelled) return;
        if (result.success && result.data?.text) {
          setPrediction(result.data.text);
        } else {
          setError("Daily prediction is unavailable");
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof DOMException && err.name === "AbortError") {
          setError("Daily prediction timed out");
        } else {
          console.warn("Failed to fetch prediction:", err);
          setError("Daily prediction is unavailable");
        }
      } finally {
        window.clearTimeout(timeoutId);
        if (!cancelled) setLoading(false);
      }
    };

    void fetchPrediction();

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [dob, sunSign, mode]);

  return { prediction, error, loading };
}
