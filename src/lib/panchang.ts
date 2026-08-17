/**
 * Panchang response normalization.
 *
 * The astrology API nests several of the values the dashboard shows:
 * rahu kalam sits under `inauspicious_periods`, the day window under
 * `sunrise_sunset`, and the moon sign is an object carrying an abbreviated
 * rashi ("Vir"). Reading those flat is what made Rahu Kaal and the sunrise
 * and sunset times render as "—" and the Moon read "Vir".
 *
 * Every reader goes through here so the shape is described in exactly one
 * place, and `panchang-normalize.test.ts` pins it against a real response.
 */

export interface PanchangData {
  tithi: string;
  tithiEnd?: string;
  nakshatra: string;
  nakshatraEnd?: string;
  yoga: string;
  karana: string;
  /** A range such as "07:30 - 09:08", or "—" when the API omits it. */
  rahu_kaal: string;
  sunrise?: string;
  sunset?: string;
  moonSign?: string;
  day?: string;
}

/** The placeholder the almanac renders when a value is genuinely unavailable. */
export const MISSING = "—";

const RASHI_BY_ABBREVIATION: Record<string, string> = {
  ari: "Aries",
  tau: "Taurus",
  gem: "Gemini",
  can: "Cancer",
  leo: "Leo",
  vir: "Virgo",
  lib: "Libra",
  sco: "Scorpio",
  sag: "Sagittarius",
  cap: "Capricorn",
  aqu: "Aquarius",
  pis: "Pisces",
};

/**
 * Expand the API's three-letter rashi ("Vir") to the sign a reader expects
 * ("Virgo"). Full names and unrecognized values pass through untouched, so a
 * Sanskrit name or a future API change is displayed rather than swallowed.
 */
export function expandRashi(value?: string | null): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return RASHI_BY_ABBREVIATION[trimmed.toLowerCase()] ?? trimmed;
}

type Unknown = Record<string, any>;

/** A limb of the panchang is either a bare name or an object carrying one. */
function name(value: unknown): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  const obj = value as Unknown | null | undefined;
  const found = obj?.name ?? obj?.title;
  return typeof found === "string" && found.trim() ? found.trim() : MISSING;
}

function nameWithEnd(value: unknown): { value: string; endTime?: string } {
  if (typeof value === "string") return { value: name(value) };
  const obj = value as Unknown | null | undefined;
  const end = obj?.end_time ?? obj?.endTime ?? obj?.end;
  return {
    value: name(value),
    endTime: typeof end === "string" && end.trim() ? end.trim() : undefined,
  };
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/**
 * Render a {start, end} period as a range. A period missing its end is still
 * worth showing — a start time alone is more useful than a placeholder.
 */
function period(value: unknown): string | undefined {
  if (typeof value === "string") return text(value);
  const obj = value as Unknown | null | undefined;
  const start = text(obj?.start ?? obj?.start_time ?? obj?.from);
  const end = text(obj?.end ?? obj?.end_time ?? obj?.to);
  if (start && end) return `${start} - ${end}`;
  return start ?? end;
}

export function normalizePanchang(raw: unknown): PanchangData {
  const d = (raw ?? {}) as Unknown;

  const tithi = nameWithEnd(d.tithi);
  const nakshatra = nameWithEnd(d.nakshatra);

  // Nested container first, then the flat spellings, so an API that flattens
  // its response later keeps working instead of regressing to placeholders.
  const rahu =
    period(d.inauspicious_periods?.rahu_kalam) ??
    period(d.inauspicious_periods?.rahu_kaal) ??
    period(d.rahu_kaal) ??
    period(d.rahuKaal) ??
    period(d.rahu_kalam);

  const window = d.sunrise_sunset ?? d;

  const moon = d.moon_sign ?? d.moonSign ?? d.moon_rasi;
  const moonSign =
    typeof moon === "string"
      ? expandRashi(moon)
      : expandRashi(moon?.rashi ?? moon?.sign ?? moon?.name);

  return {
    tithi: tithi.value,
    tithiEnd: tithi.endTime,
    nakshatra: nakshatra.value,
    nakshatraEnd: nakshatra.endTime,
    yoga: name(d.yoga),
    karana: name(d.karana),
    rahu_kaal: rahu ?? MISSING,
    sunrise: text(window?.sunrise ?? window?.sun_rise),
    sunset: text(window?.sunset ?? window?.sun_set),
    moonSign,
    day: text(d.vara?.english ?? d.vara?.name ?? d.day ?? d.vaara),
  };
}
