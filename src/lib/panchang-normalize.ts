type RawObject = Record<string, unknown>;

export interface PanchangSummary {
  tithi: string;
  tithiEnd?: string;
  nakshatra: string;
  nakshatraEnd?: string;
  yoga: string;
  karana: string;
  rahuKaal: string;
  sunrise: string;
  sunset: string;
  abhijitMuhurat: string;
  auspiciousTimings: string[];
  inauspiciousTimings: string[];
  choghadiya: Array<{ name: string; time: string; nature: string }>;
}

const asObject = (value: unknown): RawObject | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as RawObject)
    : null;

const text = (value: unknown, fallback = "-"): string => {
  if (typeof value === "string" && value.trim()) return value;
  if (typeof value === "number") return String(value);
  const obj = asObject(value);
  if (!obj) return fallback;
  return text(obj.name ?? obj.title ?? obj.value ?? obj.label, fallback);
};

const timeRange = (value: unknown): string | undefined => {
  const obj = asObject(value);
  if (!obj) return undefined;
  const direct = text(obj.time ?? obj.timing ?? obj.period, "");
  if (direct) return direct;
  const start = text(obj.start ?? obj.start_time ?? obj.from, "");
  const end = text(obj.end ?? obj.end_time ?? obj.to, "");
  return start && end ? `${start} - ${end}` : start || end || undefined;
};

const labelWithTime = (value: unknown): { label: string; end?: string } => {
  const obj = asObject(value);
  if (!obj) return { label: text(value) };
  return {
    label: text(obj.name ?? obj.title ?? obj.value),
    end: text(obj.end_time ?? obj.endTime ?? obj.end, ""),
  };
};

const listText = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") return item;
      const obj = asObject(item);
      if (!obj) return "";
      const label = text(obj.name ?? obj.title ?? obj.type ?? obj.label, "");
      const range = timeRange(obj);
      return [label, range].filter(Boolean).join(": ");
    })
    .filter(Boolean);
};

export function normalizePanchangResponse(input: unknown): PanchangSummary {
  const raw = asObject(input) ?? {};
  const tithi = labelWithTime(raw.tithi);
  const nakshatra = labelWithTime(raw.nakshatra);
  const auspiciousPeriods = asObject(raw.auspicious_periods);
  const inauspiciousPeriods = asObject(raw.inauspicious_periods);
  // The day window is nested; falling back to raw keeps a flat response working.
  const sunTimes = asObject(raw.sunrise_sunset) ?? raw;
  const choghadiya = Array.isArray(raw.choghadiya)
    ? raw.choghadiya
        .map((item) => {
          const obj = asObject(item);
          if (!obj) return null;
          return {
            name: text(obj.name ?? obj.title ?? obj.period, "Period"),
            time: timeRange(obj) ?? "-",
            nature: text(obj.nature, "neutral"),
          };
        })
        .filter((item): item is { name: string; time: string; nature: string } => Boolean(item))
    : [];

  return {
    tithi: tithi.label,
    tithiEnd: tithi.end,
    nakshatra: nakshatra.label,
    nakshatraEnd: nakshatra.end,
    yoga: text(raw.yoga),
    karana: text(raw.karana),
    rahuKaal:
      timeRange(inauspiciousPeriods?.rahu_kalam) ??
      timeRange(raw.rahu_kalam) ??
      text(raw.rahu_kaal ?? raw.rahuKaal),
    sunrise: text(sunTimes?.sunrise ?? sunTimes?.sun_rise),
    sunset: text(sunTimes?.sunset ?? sunTimes?.sun_set),
    abhijitMuhurat:
      timeRange(auspiciousPeriods?.abhijit_muhurta) ??
      timeRange(raw.abhijit_muhurta) ??
      text(raw.abhijitMuhurat),
    auspiciousTimings: [
      ...listText(raw.auspicious_timings),
      ...listText(auspiciousPeriods?.items),
    ],
    inauspiciousTimings: [
      ...listText(raw.inauspicious_timings),
      ...listText(inauspiciousPeriods?.items),
    ],
    choghadiya,
  };
}

export function buildFallbackPanchangSummary(): PanchangSummary {
  return {
    tithi: "Daily rhythm",
    nakshatra: "Mindful action",
    yoga: "Steady focus",
    karana: "Supportive routine",
    rahuKaal: "Check live timing before major starts",
    sunrise: "-",
    sunset: "-",
    abhijitMuhurat: "Choose a calm daytime window",
    auspiciousTimings: ["After sunrise, once the mind is settled"],
    inauspiciousTimings: ["Avoid rushed starts and conflict-driven decisions"],
    choghadiya: [],
  };
}
