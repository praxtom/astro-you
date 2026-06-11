import { useState, useEffect } from "react";

interface PredictionSubjectData {
  name?: string;
  dob?: string;
  tob?: string;
  pob?: string;
  sunSign?: string;
}

function getZodiacSign(day: number, month: number): string {
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

  const { dob, tob, pob, sunSign, name } = userData ?? {};

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
        const [year, month, day] = dob.split("-").map(Number);
        const [hour, minute] = (tob || "12:00").split(":").map(Number);

        const pobParts = (pob || "Unknown").split(",").map((s) => s.trim());
        const city = pobParts[0] || "Unknown";
        const countryCode = pobParts[1]?.substring(0, 2).toUpperCase() || "US";
        const zodiacSign = sunSign || getZodiacSign(day, month);

        const response = await fetch("/api/daily-prediction", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sign: zodiacSign,
            format: "short",
            subject: {
              name: name || "Seeker",
              birth_data: {
                year,
                month,
                day,
                hour,
                minute,
                city,
                country_code: countryCode === "KA" ? "IN" : countryCode,
              },
            },
            options: {
              house_system: "P",
              zodiac_type: "Tropic",
              active_points: [
                "Sun",
                "Moon",
                "Mercury",
                "Venus",
                "Mars",
                "Jupiter",
                "Saturn",
              ],
              precision: 2,
            },
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
  }, [dob, tob, pob, sunSign, name]);

  return { prediction, error, loading };
}
