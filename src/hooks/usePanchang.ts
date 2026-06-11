import { useState, useEffect } from "react";
import { postJson } from "../lib/apiFetch";

export interface PanchangData {
  tithi: string;
  tithiEnd?: string;
  nakshatra: string;
  nakshatraEnd?: string;
  yoga: string;
  karana: string;
  rahu_kaal: string;
  sunrise?: string;
  sunset?: string;
  moonSign?: string;
  day?: string;
}

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
        const raw = result.data ?? result;
        const normalize = (val: any): string =>
          typeof val === "string" ? val : (val?.name ?? val?.title ?? "—");
        const normalizeWithTime = (
          val: any,
        ): { value: string; endTime?: string } => {
          if (typeof val === "string") return { value: val };
          return {
            value: val?.name ?? val?.title ?? "—",
            endTime: val?.end_time ?? val?.endTime ?? val?.end ?? undefined,
          };
        };

        const tithiInfo = normalizeWithTime(raw.tithi);
        const nakshatraInfo = normalizeWithTime(raw.nakshatra);

        setPanchang({
          tithi: tithiInfo.value,
          tithiEnd: tithiInfo.endTime,
          nakshatra: nakshatraInfo.value,
          nakshatraEnd: nakshatraInfo.endTime,
          yoga: normalize(raw.yoga),
          karana: normalize(raw.karana),
          rahu_kaal: raw.rahu_kaal || raw.rahuKaal || raw.rahu_kalam || "—",
          sunrise: raw.sunrise || raw.sun_rise || "—",
          sunset: raw.sunset || raw.sun_set || "—",
          moonSign: (() => {
            // API may return the moon as an object: {rashi, longitude, degree_in_sign}
            const moon = raw.moon_sign ?? raw.moonSign ?? raw.moon_rasi;
            if (typeof moon === "string") return moon;
            return moon?.rashi ?? moon?.sign ?? moon?.name ?? undefined;
          })(),
          day: raw.day || raw.vaara || undefined,
        });
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
