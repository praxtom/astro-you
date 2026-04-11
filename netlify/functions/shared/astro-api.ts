/**
 * Astrology API Service — Centralized wrapper for all Astrology-API.io v3 calls.
 * https://api.astrology-api.io/api/v3  (266 endpoints available, OpenAPI spec verified)
 *
 * ── Currently wired endpoints ──────────────────────────────────────────────
 *
 * Charts
 *   POST /charts/natal                         → getNatalChart()
 *   POST /charts/transit                       → getTransitChart()
 *   POST /charts/synastry                      → (used inside getCompatibilityDetails)
 *
 * Data
 *   GET  /data/now                             → getCurrentTransits()
 *
 * Vedic
 *   POST /vedic/divisional-chart               → getNavamsaChart()
 *   POST /vedic/vimshottari-dasha              → getDashaPeriods()
 *   POST /vedic/panchang                       → getPanchang()
 *   POST /vedic/yoga-analysis                  → getYogaAnalysis()
 *   POST /vedic/kundli-matching                → getKundliMatching()
 *   POST /vedic/manglik-dosha                  → getManglikDosha()
 *   POST /vedic/remedies                       → getRemedies()
 *   POST /vedic/sade-sati                      → getSadeSati()
 *   POST /vedic/kaal-sarpa-dosha               → getKaalSarpaDosha()
 *   POST /vedic/nakshatra-predictions           → getNakshatraPredictions()
 *   POST /vedic/ashtakvarga                     → getAshtakvarga()
 *
 * Eclipses & Lunar
 *   GET  /eclipses/upcoming                     → getUpcomingEclipses()
 *   POST /eclipses/natal-check                  → getEclipseNatalImpact()
 *   POST /lunar/phases                          → getLunarPhases()
 *   POST /lunar/void-of-course                  → getVoidOfCourse()
 *
 * Horoscope
 *   POST /horoscope/personal/daily             → getDailyHoroscope()
 *   POST /horoscope/personal/weekly            → getWeeklyHoroscope()
 *   POST /horoscope/personal/monthly            → getMonthlyHoroscope()
 *   POST /horoscope/personal/yearly             → getYearlyHoroscope()
 *   POST /horoscope/sign/daily/text            → getDailyHoroscopeText()
 *   POST /horoscope/sign/weekly/text           → getWeeklySignHoroscope()
 *   POST /horoscope/sign/monthly/text          → getMonthlySignHoroscope()
 *   POST /horoscope/sign/yearly/text           → getYearlySignHoroscope()
 *
 * Analysis
 *   POST /analysis/natal-transit-report        → getTransitReport()
 *
 * SVG
 *   POST /svg/natal                             → getNatalChartSVG()
 *   POST /svg/transit                           → getTransitChartSVG()
 *
 * Render
 *   POST /render/transit                        → getRenderedTransitChart() (existing)
 *   POST /render/natal                          → getRenderedNatalChart()
 *   POST /render/synastry                       → getRenderedSynastryChart()
 *
 * Insights
 *   POST /insights/relationship/compatibility  → (used inside getCompatibilityDetails)
 *   POST /insights/wellness/biorhythms          → getBiorhythms()
 *   POST /insights/wellness/wellness-score      → getWellnessScore()
 *   POST /insights/wellness/energy-patterns     → getEnergyPatterns()
 *
 * PDF
 *   POST /pdf/natal-report                      → getNatalReportPDF()
 *   POST /pdf/horoscope/daily                   → getDailyHoroscopePDF()
 *   POST /pdf/horoscope/weekly                  → getWeeklyHoroscopePDF()
 */

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface BirthData {
  name?: string;
  dob: string; // YYYY-MM-DD
  tob: string; // HH:MM
  pob: string; // Place of birth (city name)
  lat?: number;
  lng?: number;
}

export interface PlanetaryPosition {
  name: string;
  sign: string;
  signCode: string;
  degree: number;
  house: number;
  is_retrograde: boolean;
  speed?: number;
  nakshatra?: string;
}

export interface HouseCusp {
  house: number;
  sign: string;
  degree: number;
}

export interface KundaliData {
  planetary_positions: PlanetaryPosition[];
  house_cusps: HouseCusp[];
  ascendant?: { sign: string; degree: number };
}

export interface DashaPeriod {
  planet: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  subPeriods?: DashaPeriod[];
}

export interface TransitData {
  date: string;
  positions: PlanetaryPosition[];
  significantEvents?: string[];
}

// ─── Internals ───────────────────────────────────────────────────────────────

const API_BASE = "https://api.astrology-api.io/api/v3";

function getApiKey(): string | undefined {
  return process.env.ASTROYOU_API_KEY || process.env.ASTROLOGY_API_KEY;
}

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  const apiKey = getApiKey();
  if (apiKey) headers["X-API-Key"] = apiKey;
  return headers;
}

/** Standard DateTimeLocation object used by most endpoints. */
function buildDateTimeLocation(
  dateStr: string,
  timeStr: string,
  city?: string,
  lat?: number,
  lng?: number,
): Record<string, any> {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hour, minute] = timeStr.split(":").map(Number);
  const dtl: Record<string, any> = {
    year,
    month,
    day,
    hour,
    minute,
    second: 0,
  };
  if (city) dtl.city = city;
  if (lat !== undefined && lng !== undefined) {
    dtl.latitude = lat;
    dtl.longitude = lng;
  }
  return dtl;
}

/** Standard Subject wrapper: { name, birth_data: DateTimeLocation }. */
function buildSubject(birthData: BirthData): Record<string, any> {
  return {
    name: birthData.name || "User",
    birth_data: buildDateTimeLocation(
      birthData.dob,
      birthData.tob,
      birthData.pob || undefined,
      birthData.lat,
      birthData.lng,
    ),
  };
}

/** Chart-request payload with subject + Vedic options. */
function parseBirthData(birthData: BirthData) {
  return {
    subject: buildSubject(birthData),
    options: {
      house_system: "W",
      zodiac_type: "Sidereal",
      active_points: [
        "Sun",
        "Moon",
        "Mercury",
        "Venus",
        "Mars",
        "Jupiter",
        "Saturn",
        "Mean_Node",
        "Mean_South_Node",
        "Ascendant",
      ],
      precision: 2,
    },
  };
}

/** Transit-time payload: { datetime: DateTimeLocation }. */
function buildTransitTime(
  birthData: BirthData,
  transitDate?: string,
): Record<string, any> {
  const now = new Date();
  const dateStr = transitDate || now.toISOString().split("T")[0];
  const [y, m, d] = dateStr.split("-").map(Number);
  return {
    datetime: {
      year: y,
      month: m,
      day: d,
      hour: now.getUTCHours(),
      minute: now.getUTCMinutes(),
      second: 0,
      ...(birthData.pob ? { city: birthData.pob } : {}),
      ...(birthData.lat !== undefined && birthData.lng !== undefined
        ? { latitude: birthData.lat, longitude: birthData.lng }
        : {}),
    },
  };
}

// ─── Response Transformers ───────────────────────────────────────────────────

function transformKundaliResponse(apiResponse: any): KundaliData {
  const planetary_positions: PlanetaryPosition[] = [];
  const house_cusps: HouseCusp[] = [];
  const data = apiResponse.subject_data || apiResponse.data || apiResponse;

  const planetKeys = [
    "sun",
    "moon",
    "mercury",
    "venus",
    "mars",
    "jupiter",
    "saturn",
    "uranus",
    "neptune",
    "pluto",
    "mean_node",
    "true_node",
    "mean_south_node",
    "ketu",
    "rahu",
  ];
  const src = data.planets || data.subject_data || data;

  for (const key of planetKeys) {
    const pd = src[key] || data[key];
    if (pd && (pd.sign || pd.zodiac_sign)) {
      planetary_positions.push({
        name:
          pd.name ||
          key.charAt(0).toUpperCase() + key.slice(1).replace("_", " "),
        sign: pd.sign || pd.zodiac_sign || "",
        signCode: pd.sign || pd.zodiac_sign || "",
        degree: pd.position || pd.degree || 0,
        house: parseHouseNumber(pd.house) || 1,
        is_retrograde: pd.retrograde || pd.is_retrograde || false,
        speed: pd.speed,
        nakshatra: pd.nakshatra,
      });
    }
  }

  if (data.houses) {
    for (const [num, hd] of Object.entries(data.houses) as any) {
      house_cusps.push({
        house: parseInt(num),
        sign: hd.sign || "",
        degree: hd.degree || 0,
      });
    }
  }

  let ascendant = null;
  if (data.ascendant) {
    ascendant = {
      sign: data.ascendant.sign || data.ascendant,
      degree: data.ascendant.position || data.ascendant.degree || 0,
    };
  } else if (data.first_house) {
    ascendant = {
      sign: data.first_house.sign || "",
      degree: data.first_house.position || 0,
    };
  }

  return {
    planetary_positions,
    house_cusps,
    ascendant: ascendant || undefined,
  };
}

function parseHouseNumber(houseName: string | number | undefined): number {
  if (typeof houseName === "number") return houseName;
  if (!houseName) return 1;
  const map: Record<string, number> = {
    First_House: 1,
    Second_House: 2,
    Third_House: 3,
    Fourth_House: 4,
    Fifth_House: 5,
    Sixth_House: 6,
    Seventh_House: 7,
    Eighth_House: 8,
    Ninth_House: 9,
    Tenth_House: 10,
    Eleventh_House: 11,
    Twelfth_House: 12,
  };
  return map[houseName] || parseInt(houseName) || 1;
}

/** Unwrap the common { data: ... } envelope the API uses. */
function unwrap(result: any): any {
  return result.data || result;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  CHARTS  (/charts/*)
// ═══════════════════════════════════════════════════════════════════════════════

/** POST /charts/natal — Full natal chart. */
export async function getNatalChart(
  birthData: BirthData,
): Promise<KundaliData> {
  const res = await fetch(`${API_BASE}/charts/natal`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(parseBirthData(birthData)),
  });
  if (!res.ok)
    throw new Error(`Natal chart error: ${res.status} - ${await res.text()}`);
  return transformKundaliResponse(await res.json());
}

/** POST /charts/transit — Transit snapshot overlaid on natal. */
export async function getTransitChart(
  birthData: BirthData,
  transitDate?: string,
): Promise<any> {
  const payload = {
    subject: buildSubject(birthData),
    transit_time: buildTransitTime(birthData, transitDate),
    options: {
      house_system: "W",
      zodiac_type: "Sidereal",
      active_points: [
        "Sun",
        "Moon",
        "Mercury",
        "Venus",
        "Mars",
        "Jupiter",
        "Saturn",
        "Mean_Node",
        "Mean_South_Node",
        "Ascendant",
      ],
      precision: 2,
    },
  };
  const res = await fetch(`${API_BASE}/charts/transit`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Transit chart error: ${res.status}`);
  return res.json();
}

// ═══════════════════════════════════════════════════════════════════════════════
//  DATA  (/data/*)
// ═══════════════════════════════════════════════════════════════════════════════

/** GET /data/now — Current planetary positions (no birth data needed). */
export async function getCurrentTransits(): Promise<TransitData> {
  const today = new Date().toISOString().split("T")[0];
  try {
    const res = await fetch(`${API_BASE}/data/now`, {
      method: "GET",
      headers: getHeaders(),
    });
    if (!res.ok) {
      console.warn("/data/now error:", res.status);
      return { date: today, positions: [], significantEvents: [] };
    }

    const raw = await res.json();
    const positions: PlanetaryPosition[] = [];
    const pd = raw.data || raw.positions || raw;
    if (typeof pd === "object") {
      for (const [key, value] of Object.entries(pd)) {
        const p = value as any;
        if (p && (p.sign || p.zodiac_sign)) {
          positions.push({
            name:
              p.name ||
              key.charAt(0).toUpperCase() + key.slice(1).replace("_", " "),
            sign: p.sign || p.zodiac_sign || "",
            signCode: p.sign || p.zodiac_sign || "",
            degree: p.position || p.degree || 0,
            house: parseHouseNumber(p.house) || 1,
            is_retrograde: p.retrograde || p.is_retrograde || false,
            speed: p.speed,
            nakshatra: p.nakshatra,
          });
        }
      }
    }
    return { date: today, positions, significantEvents: raw.events || [] };
  } catch (err) {
    console.error("getCurrentTransits error:", err);
    return { date: today, positions: [], significantEvents: [] };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  VEDIC  (/vedic/*)
// ═══════════════════════════════════════════════════════════════════════════════

/** POST /vedic/divisional-chart — Divisional charts (D1-D60). */
export async function getNavamsaChart(
  birthData: BirthData,
  charts: string[] = ["D9"],
): Promise<KundaliData> {
  try {
    const res = await fetch(`${API_BASE}/vedic/divisional-chart`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ subject: buildSubject(birthData), charts }),
    });
    if (!res.ok) throw new Error(`Divisional chart error: ${res.status}`);
    const data = await res.json();
    const chartData = data[charts[0]] || data.data?.[charts[0]] || data;
    return transformKundaliResponse(chartData);
  } catch (err) {
    console.error("Divisional chart error:", err);
    return { planetary_positions: [], house_cusps: [] };
  }
}

/** POST /vedic/vimshottari-dasha — Dasha periods with sub-periods. */
export async function getDashaPeriods(
  birthData: BirthData,
): Promise<DashaPeriod[]> {
  const res = await fetch(`${API_BASE}/vedic/vimshottari-dasha`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      subject: buildSubject(birthData),
      dasha_level: "antardasha",
      target_date: new Date().toISOString().split("T")[0],
    }),
  });
  if (!res.ok) {
    console.warn("Dasha error:", res.status);
    return [];
  }

  const data = unwrap(await res.json());
  const raw =
    data.mahadashas ||
    data.periods ||
    data.dashas ||
    (Array.isArray(data) ? data : []);

  return raw.map(
    (m: any) =>
      ({
        planet: m.planet || m.lord || m.name || "",
        startDate: m.start_date || m.startDate || m.start || "",
        endDate: m.end_date || m.endDate || m.end || "",
        isCurrent: m.is_current ?? m.isCurrent ?? false,
        subPeriods: (m.antardashas || m.sub_periods || m.subPeriods || []).map(
          (s: any) => ({
            planet: s.planet || s.lord || s.name || "",
            startDate: s.start_date || s.startDate || s.start || "",
            endDate: s.end_date || s.endDate || s.end || "",
            isCurrent: s.is_current ?? s.isCurrent ?? false,
          }),
        ),
      }) as DashaPeriod,
  );
}

/** POST /vedic/panchang — Daily almanac (Tithi, Nakshatra, Karana, Rahu Kaal). */
export async function getPanchang(
  date?: string,
  city?: string,
  lat?: number,
  lng?: number,
): Promise<any> {
  const dateStr = date || new Date().toISOString().split("T")[0];
  const res = await fetch(`${API_BASE}/vedic/panchang`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      datetime_location: buildDateTimeLocation(
        dateStr,
        "06:00",
        city || "New Delhi",
        lat ?? 28.6139,
        lng ?? 77.209,
      ),
    }),
  });
  if (!res.ok)
    throw new Error(`Panchang error: ${res.status} - ${await res.text()}`);
  return unwrap(await res.json());
}

/** POST /vedic/festival-calendar — Upcoming festivals for a year/region. */
export async function getFestivalCalendar(
  year?: number,
  region?: string,
): Promise<any> {
  const res = await fetch(`${API_BASE}/vedic/festival-calendar`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      year: year || new Date().getFullYear(),
      region: region || "north",
    }),
  });
  if (!res.ok) return [];
  return unwrap(await res.json());
}

/** POST /vedic/yoga-analysis — Detect yogas (Raj, Gajakesari, etc). */
export async function getYogaAnalysis(birthData: BirthData): Promise<any> {
  const res = await fetch(`${API_BASE}/vedic/yoga-analysis`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ subject: buildSubject(birthData) }),
  });
  if (!res.ok)
    throw new Error(`Yoga analysis error: ${res.status} - ${await res.text()}`);
  return unwrap(await res.json());
}

/** POST /vedic/kundli-matching — 36-point Guna Milan. */
export async function getKundliMatching(
  person1: BirthData,
  person2: BirthData,
): Promise<any> {
  const res = await fetch(`${API_BASE}/vedic/kundli-matching`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      groom: buildSubject(person1),
      bride: buildSubject(person2),
      include_manglik: true,
    }),
  });
  if (!res.ok)
    throw new Error(
      `Kundli matching error: ${res.status} - ${await res.text()}`,
    );
  return unwrap(await res.json());
}

/** POST /vedic/manglik-dosha — Manglik dosha detection. */
export async function getManglikDosha(birthData: BirthData): Promise<any> {
  const res = await fetch(`${API_BASE}/vedic/manglik-dosha`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ subject: buildSubject(birthData) }),
  });
  if (!res.ok)
    throw new Error(`Manglik dosha error: ${res.status} - ${await res.text()}`);
  return unwrap(await res.json());
}

/** POST /vedic/remedies — Gemstones, mantras, fasting, rituals. */
export async function getRemedies(
  birthData: BirthData,
  remedyType?: string,
): Promise<any> {
  const res = await fetch(`${API_BASE}/vedic/remedies`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      subject: buildSubject(birthData),
      remedy_type: remedyType || null,
    }),
  });
  if (!res.ok)
    throw new Error(`Remedies error: ${res.status} - ${await res.text()}`);
  return unwrap(await res.json());
}

/** POST /vedic/sade-sati — Sade Sati (Saturn transit) detection. */
export async function getSadeSati(birthData: BirthData): Promise<any> {
  const res = await fetch(`${API_BASE}/vedic/sade-sati`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      subject: buildSubject(birthData),
      include_remedies: true,
    }),
  });
  if (!res.ok) throw new Error(`Sade Sati error: ${res.status}`);
  return unwrap(await res.json());
}

/** POST /vedic/kaal-sarpa-dosha — Kaal Sarpa dosha detection. */
export async function getKaalSarpaDosha(birthData: BirthData): Promise<any> {
  const res = await fetch(`${API_BASE}/vedic/kaal-sarpa-dosha`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      subject: buildSubject(birthData),
      include_remedies: true,
    }),
  });
  if (!res.ok) throw new Error(`Kaal Sarpa error: ${res.status}`);
  return unwrap(await res.json());
}

/** POST /vedic/nakshatra-predictions — Nakshatra-based predictions. */
export async function getNakshatraPredictions(
  birthData: BirthData,
): Promise<any> {
  const res = await fetch(`${API_BASE}/vedic/nakshatra-predictions`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ subject: buildSubject(birthData) }),
  });
  if (!res.ok) throw new Error(`Nakshatra predictions error: ${res.status}`);
  return unwrap(await res.json());
}

/** POST /vedic/ashtakvarga — Ashtakvarga strength analysis. */
export async function getAshtakvarga(birthData: BirthData): Promise<any> {
  const res = await fetch(`${API_BASE}/vedic/ashtakvarga`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      subject: buildSubject(birthData),
      include_sarva: true,
    }),
  });
  if (!res.ok) throw new Error(`Ashtakvarga error: ${res.status}`);
  return unwrap(await res.json());
}

// ═══════════════════════════════════════════════════════════════════════════════
//  ECLIPSES & LUNAR  (/eclipses/*, /lunar/*)
// ═══════════════════════════════════════════════════════════════════════════════

/** GET /eclipses/upcoming — Next upcoming eclipses. */
export async function getUpcomingEclipses(): Promise<any> {
  const res = await fetch(`${API_BASE}/eclipses/upcoming`, {
    method: "GET",
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error(`Eclipses error: ${res.status}`);
  return unwrap(await res.json());
}

/** POST /eclipses/natal-check — Eclipse impact on natal chart. */
export async function getEclipseNatalImpact(
  birthData: BirthData,
): Promise<any> {
  const res = await fetch(`${API_BASE}/eclipses/natal-check`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ subject: buildSubject(birthData) }),
  });
  if (!res.ok) throw new Error(`Eclipse natal check error: ${res.status}`);
  return unwrap(await res.json());
}

/** POST /lunar/phases — Precise lunar phases. */
export async function getLunarPhases(birthData: BirthData): Promise<any> {
  const res = await fetch(`${API_BASE}/lunar/phases`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ subject: buildSubject(birthData) }),
  });
  if (!res.ok) throw new Error(`Lunar phases error: ${res.status}`);
  return unwrap(await res.json());
}

/** POST /lunar/void-of-course — Void of Course moon status. */
export async function getVoidOfCourse(birthData: BirthData): Promise<any> {
  const res = await fetch(`${API_BASE}/lunar/void-of-course`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ subject: buildSubject(birthData) }),
  });
  if (!res.ok) throw new Error(`Void of course error: ${res.status}`);
  return unwrap(await res.json());
}

// ═══════════════════════════════════════════════════════════════════════════════
//  HOROSCOPE  (/horoscope/*)
// ═══════════════════════════════════════════════════════════════════════════════

/** POST /horoscope/personal/daily — Personalized daily horoscope. */
export async function getDailyHoroscope(
  birthData: BirthData,
  date?: string,
): Promise<any> {
  const targetDate = date || new Date().toISOString().split("T")[0];
  const res = await fetch(`${API_BASE}/horoscope/personal/daily`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      subject: buildSubject(birthData),
      target_date: targetDate,
      horoscope_type: "daily",
      language: "en",
      tradition: "universal",
      include_transits: true,
      include_progressions: false,
    }),
  });
  if (!res.ok) {
    console.warn("Daily horoscope error:", res.status);
    try {
      return await getDailyHoroscopeText(birthData, date);
    } catch {
      return null;
    }
  }
  return unwrap(await res.json());
}

/** POST /horoscope/personal/weekly — Personalized weekly horoscope. */
export async function getWeeklyHoroscope(
  birthData: BirthData,
  date?: string,
): Promise<any> {
  const targetDate = date || new Date().toISOString().split("T")[0];
  const res = await fetch(`${API_BASE}/horoscope/personal/weekly`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      subject: buildSubject(birthData),
      target_date: targetDate,
      horoscope_type: "weekly",
      language: "en",
      tradition: "universal",
      include_transits: true,
      include_progressions: false,
    }),
  });
  if (!res.ok) {
    console.warn("Weekly horoscope error:", res.status);
    return null;
  }
  return unwrap(await res.json());
}

/** POST /horoscope/personal/monthly — Personalized monthly horoscope. */
export async function getMonthlyHoroscope(
  birthData: BirthData,
  date?: string,
): Promise<any> {
  const targetDate = date || new Date().toISOString().split("T")[0];
  const res = await fetch(`${API_BASE}/horoscope/personal/monthly`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      subject: buildSubject(birthData),
      target_date: targetDate,
      horoscope_type: "monthly",
      language: "en",
      tradition: "universal",
      include_transits: true,
      include_progressions: false,
    }),
  });
  if (!res.ok) {
    console.warn("Monthly horoscope error:", res.status);
    return null;
  }
  return unwrap(await res.json());
}

/** POST /horoscope/personal/yearly — Personalized yearly horoscope. */
export async function getYearlyHoroscope(
  birthData: BirthData,
  date?: string,
): Promise<any> {
  const targetDate = date || new Date().toISOString().split("T")[0];
  const res = await fetch(`${API_BASE}/horoscope/personal/yearly`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      subject: buildSubject(birthData),
      target_date: targetDate,
      horoscope_type: "yearly",
      language: "en",
      tradition: "universal",
      include_transits: true,
      include_progressions: false,
      include_major_transits: true,
      include_retrograde_periods: true,
    }),
  });
  if (!res.ok) {
    console.warn("Yearly horoscope error:", res.status);
    return null;
  }
  return unwrap(await res.json());
}

/** POST /horoscope/sign/daily/text — Sign-based narrative daily text. */
export async function getDailyHoroscopeText(
  birthData: BirthData,
  date?: string,
): Promise<any> {
  const [, month, day] = birthData.dob.split("-").map(Number);
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
  const bounds = [20, 19, 21, 20, 21, 21, 23, 23, 23, 23, 22, 22];
  const sign = day < bounds[month - 1] ? signs[month - 1] : signs[month % 12];

  const res = await fetch(`${API_BASE}/horoscope/sign/daily/text`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      sign,
      date: date || new Date().toISOString().split("T")[0],
      format: "paragraph",
      emoji: false,
      language: "en",
      tradition: "universal",
    }),
  });
  if (!res.ok) return null;
  return unwrap(await res.json());
}

/** POST /horoscope/sign/weekly/text — Weekly text horoscope by sign. */
export async function getWeeklySignHoroscope(
  sign: string,
  date?: string,
): Promise<any> {
  const res = await fetch(`${API_BASE}/horoscope/sign/weekly/text`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      sign,
      date: date || new Date().toISOString().split("T")[0],
      format: "paragraph",
      language: "en",
    }),
  });
  if (!res.ok) return null;
  return unwrap(await res.json());
}

/** POST /horoscope/sign/monthly/text — Monthly text horoscope by sign. */
export async function getMonthlySignHoroscope(
  sign: string,
  date?: string,
): Promise<any> {
  const res = await fetch(`${API_BASE}/horoscope/sign/monthly/text`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      sign,
      date: date || new Date().toISOString().split("T")[0],
      format: "paragraph",
      language: "en",
    }),
  });
  if (!res.ok) return null;
  return unwrap(await res.json());
}

/** POST /horoscope/sign/yearly/text — Yearly text horoscope by sign. */
export async function getYearlySignHoroscope(
  sign: string,
  date?: string,
): Promise<any> {
  const res = await fetch(`${API_BASE}/horoscope/sign/yearly/text`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      sign,
      date: date || new Date().toISOString().split("T")[0],
      format: "long",
      language: "en",
    }),
  });
  if (!res.ok) return null;
  return unwrap(await res.json());
}

// ═══════════════════════════════════════════════════════════════════════════════
//  ANALYSIS  (/analysis/*)
// ═══════════════════════════════════════════════════════════════════════════════

/** POST /analysis/natal-transit-report — Transit predictions report. */
export async function getTransitReport(
  birthData: BirthData,
  transitDate?: string,
): Promise<any[]> {
  const res = await fetch(`${API_BASE}/analysis/natal-transit-report`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      subject: buildSubject(birthData),
      transit_time: buildTransitTime(birthData, transitDate),
      report_options: { tradition: "vedic", language: "en" },
    }),
  });
  if (!res.ok) {
    console.warn("Transit report error:", res.status);
    return [];
  }

  const result = await res.json();
  const data = result.data || result;
  return (
    data.report?.events ||
    data.events ||
    result.report?.events ||
    result.events ||
    []
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  RENDER  (/render/*)
// ═══════════════════════════════════════════════════════════════════════════════

/** POST /render/transit — Pre-rendered transit chart SVG/image. */
export async function getRenderedTransitChart(
  birthData: BirthData,
  transitDate?: string,
): Promise<string> {
  const res = await fetch(`${API_BASE}/render/transit`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      subject: buildSubject(birthData),
      transit_time: buildTransitTime(birthData, transitDate),
      options: { house_system: "W", zodiac_type: "Sidereal", precision: 2 },
      render_options: { format: "svg", theme: "dark" },
    }),
  });
  if (!res.ok) throw new Error(`Transit render error: ${res.status}`);
  const result = await res.json();
  return result.url || result.data || "";
}

// ═══════════════════════════════════════════════════════════════════════════════
//  SVG CHARTS  (/svg/*)
// ═══════════════════════════════════════════════════════════════════════════════

/** POST /svg/natal — Get natal chart as SVG. */
export async function getNatalChartSVG(birthData: BirthData): Promise<string> {
  const res = await fetch(`${API_BASE}/svg/natal`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      subject: buildSubject(birthData),
      options: { house_system: "W", zodiac_type: "Sidereal", precision: 2 },
      svg_options: { theme: "dark" },
    }),
  });
  if (!res.ok) throw new Error(`SVG natal error: ${res.status}`);
  return res.text();
}

/** POST /svg/transit — Get transit chart as SVG. */
export async function getTransitChartSVG(
  birthData: BirthData,
  transitDate?: string,
): Promise<string> {
  const res = await fetch(`${API_BASE}/svg/transit`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      subject: buildSubject(birthData),
      transit_time: buildTransitTime(birthData, transitDate),
      options: { house_system: "W", zodiac_type: "Sidereal", precision: 2 },
      svg_options: { theme: "dark" },
    }),
  });
  if (!res.ok) throw new Error(`SVG transit error: ${res.status}`);
  return res.text();
}

/** POST /render/natal — Render natal chart as PNG image. Returns image URL or data. */
export async function getRenderedNatalChart(
  birthData: BirthData,
): Promise<string> {
  const res = await fetch(`${API_BASE}/render/natal`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      subject: buildSubject(birthData),
      options: { house_system: "W", zodiac_type: "Sidereal", precision: 2 },
      render_options: { format: "png", theme: "dark", width: 1080 },
    }),
  });
  if (!res.ok) throw new Error(`Render natal error: ${res.status}`);
  const result = await res.json();
  return result.url || result.data || "";
}

/** POST /render/synastry — Render synastry chart as PNG image. */
export async function getRenderedSynastryChart(
  person1: BirthData,
  person2: BirthData,
): Promise<string> {
  const res = await fetch(`${API_BASE}/render/synastry`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      subject1: buildSubject(person1),
      subject2: buildSubject(person2),
      options: { house_system: "W", zodiac_type: "Sidereal", precision: 2 },
      render_options: { format: "png", theme: "dark" },
    }),
  });
  if (!res.ok) throw new Error(`Synastry render error: ${res.status}`);
  const result = await res.json();
  return result.url || result.data || "";
}

// ═══════════════════════════════════════════════════════════════════════════════
//  COMPATIBILITY  (multi-endpoint)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Full compatibility analysis — calls two endpoints in parallel:
 *   POST /insights/relationship/compatibility  (subjects array)
 *   POST /charts/synastry                      (subject1 / subject2)
 */
export async function getCompatibilityDetails(
  person1: BirthData,
  person2: BirthData,
): Promise<any> {
  const s1 = buildSubject(person1);
  const s2 = buildSubject(person2);

  const insightsPayload = {
    subjects: [
      { name: person1.name || "Person 1", birth_data: s1.birth_data },
      { name: person2.name || "Person 2", birth_data: s2.birth_data },
    ],
    options: { house_system: "W", zodiac_type: "Sidereal", language: "en" },
  };
  const synastryPayload = {
    subject1: s1,
    subject2: s2,
    options: { house_system: "W", zodiac_type: "Sidereal", language: "en" },
  };

  try {
    const [rIns, rSyn] = await Promise.all([
      fetch(`${API_BASE}/insights/relationship/compatibility`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(insightsPayload),
      }),
      fetch(`${API_BASE}/charts/synastry`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(synastryPayload),
      }),
    ]);

    const ins: any = rIns.ok ? unwrap(await rIns.json()) : {};
    const syn: any = rSyn.ok ? unwrap(await rSyn.json()) : {};
    if (!rIns.ok) console.error("[Compatibility] Insights error:", rIns.status);
    if (!rSyn.ok) console.error("[Compatibility] Synastry error:", rSyn.status);

    return {
      ...ins,
      ...syn,
      synastry: { ...(ins.synastry || {}), ...(syn.synastry || {}) },
      love_languages: {
        ...(ins.love_languages || {}),
        ...(syn.love_languages || {}),
      },
      dynamics: {
        ...(ins.dynamics || {}),
        ...(syn.dynamics || {}),
        ...(syn.relationship_dynamics || {}),
      },
      compatibility: {
        ...(ins.compatibility || {}),
        ...(syn.compatibility || {}),
      },
      interpretations: syn.interpretations || ins.interpretations || [],
      overall_score:
        ins.overall_score ||
        syn.overall_compatibility ||
        ins.compatibility?.overall_score ||
        0,
    };
  } catch (error) {
    console.error("[Compatibility] Error:", error);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  PDF REPORTS  (/pdf/*)
// ═══════════════════════════════════════════════════════════════════════════════

/** POST /pdf/natal-report — Generate natal chart PDF report. Returns PDF binary. */
export async function getNatalReportPDF(
  birthData: BirthData,
): Promise<ArrayBuffer | null> {
  const res = await fetch(`${API_BASE}/pdf/natal-report`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      subject: buildSubject(birthData),
      tradition: "universal",
      language: "en",
    }),
  });
  if (!res.ok) {
    console.warn("Natal report PDF error:", res.status);
    return null;
  }
  return res.arrayBuffer();
}

/** POST /pdf/horoscope/daily — Generate daily horoscope PDF. Returns PDF binary. */
export async function getDailyHoroscopePDF(
  birthData: BirthData,
  date?: string,
): Promise<ArrayBuffer | null> {
  const [, month, day] = birthData.dob.split("-").map(Number);
  const abbrevs = [
    "Cap",
    "Aqu",
    "Pis",
    "Ari",
    "Tau",
    "Gem",
    "Can",
    "Leo",
    "Vir",
    "Lib",
    "Sco",
    "Sag",
  ];
  const bounds = [20, 19, 21, 20, 21, 21, 23, 23, 23, 23, 22, 22];
  const idx = day < bounds[month - 1] ? month - 1 : month % 12;
  const sign = abbrevs[idx];

  const res = await fetch(`${API_BASE}/pdf/horoscope/daily`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      sign,
      target_date: date || new Date().toISOString().split("T")[0],
      language: "en",
    }),
  });
  if (!res.ok) {
    console.warn("Daily horoscope PDF error:", res.status);
    return null;
  }
  return res.arrayBuffer();
}

/** POST /pdf/horoscope/weekly — Generate weekly horoscope PDF. Returns PDF binary. */
export async function getWeeklyHoroscopePDF(
  birthData: BirthData,
  date?: string,
): Promise<ArrayBuffer | null> {
  const [, month, day] = birthData.dob.split("-").map(Number);
  const abbrevs = [
    "Cap",
    "Aqu",
    "Pis",
    "Ari",
    "Tau",
    "Gem",
    "Can",
    "Leo",
    "Vir",
    "Lib",
    "Sco",
    "Sag",
  ];
  const bounds = [20, 19, 21, 20, 21, 21, 23, 23, 23, 23, 22, 22];
  const idx = day < bounds[month - 1] ? month - 1 : month % 12;
  const sign = abbrevs[idx];

  const res = await fetch(`${API_BASE}/pdf/horoscope/weekly`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      sign,
      target_date: date || new Date().toISOString().split("T")[0],
      language: "en",
    }),
  });
  if (!res.ok) {
    console.warn("Weekly horoscope PDF error:", res.status);
    return null;
  }
  return res.arrayBuffer();
}

// ═══════════════════════════════════════════════════════════════════════════════
//  NUMEROLOGY  (/numerology/*)
// ═══════════════════════════════════════════════════════════════════════════════

/** POST /numerology/comprehensive — Full numerology reading. */
export async function getNumerologyReading(birthData: BirthData): Promise<any> {
  const [year, month, day] = birthData.dob.split("-").map(Number);
  const res = await fetch(`${API_BASE}/numerology/comprehensive`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      name: birthData.name || "User",
      birth_date: { year, month, day },
    }),
  });
  if (!res.ok) throw new Error(`Numerology error: ${res.status}`);
  return unwrap(await res.json());
}

/** POST /numerology/core-numbers — Life path, destiny, soul numbers. */
export async function getCoreNumbers(birthData: BirthData): Promise<any> {
  const [year, month, day] = birthData.dob.split("-").map(Number);
  const res = await fetch(`${API_BASE}/numerology/core-numbers`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      name: birthData.name || "User",
      birth_date: { year, month, day },
    }),
  });
  if (!res.ok) throw new Error(`Core numbers error: ${res.status}`);
  return unwrap(await res.json());
}

// ═══════════════════════════════════════════════════════════════════════════════
//  TAROT  (/tarot/*)
// ═══════════════════════════════════════════════════════════════════════════════

/** GET /tarot/cards/daily — Daily tarot card. */
export async function getDailyTarotCard(): Promise<any> {
  const res = await fetch(`${API_BASE}/tarot/cards/daily`, {
    method: "GET",
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error(`Daily tarot error: ${res.status}`);
  return unwrap(await res.json());
}

/** POST /tarot/reports/three-card — Three card reading. */
export async function getThreeCardReading(question?: string): Promise<any> {
  const res = await fetch(`${API_BASE}/tarot/reports/three-card`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      question: question || "What does the universe want me to know today?",
    }),
  });
  if (!res.ok) throw new Error(`Three card reading error: ${res.status}`);
  return unwrap(await res.json());
}

/** POST /tarot/cards/draw — Draw N tarot cards. */
export async function drawTarotCards(count: number = 3): Promise<any> {
  const res = await fetch(`${API_BASE}/tarot/cards/draw`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ count }),
  });
  if (!res.ok) throw new Error(`Draw tarot error: ${res.status}`);
  return unwrap(await res.json());
}

// ═══════════════════════════════════════════════════════════════════════════════
//  NUMEROLOGY COMPATIBILITY
// ═══════════════════════════════════════════════════════════════════════════════

/** POST /numerology/compatibility — Numerology compatibility between two people. */
export async function getNumerologyCompatibility(
  person1: BirthData,
  person2: BirthData,
): Promise<any> {
  const [y1, m1, d1] = person1.dob.split("-").map(Number);
  const [y2, m2, d2] = person2.dob.split("-").map(Number);
  const res = await fetch(`${API_BASE}/numerology/compatibility`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      person1: {
        name: person1.name || "Person 1",
        birth_date: { year: y1, month: m1, day: d1 },
      },
      person2: {
        name: person2.name || "Person 2",
        birth_date: { year: y2, month: m2, day: d2 },
      },
    }),
  });
  if (!res.ok) throw new Error(`Numerology compatibility error: ${res.status}`);
  return unwrap(await res.json());
}

// ═══════════════════════════════════════════════════════════════════════════════
//  ECLIPSE INTERPRETATION
// ═══════════════════════════════════════════════════════════════════════════════

/** POST /eclipses/interpretation — Interpretation for a specific eclipse date. */
export async function getEclipseInterpretation(
  eclipseDate: string,
): Promise<any> {
  const res = await fetch(`${API_BASE}/eclipses/interpretation`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ date: eclipseDate }),
  });
  if (!res.ok) throw new Error(`Eclipse interpretation error: ${res.status}`);
  return unwrap(await res.json());
}

// ═══════════════════════════════════════════════════════════════════════════════
//  ASTROCARTOGRAPHY  (/astrocartography/*)
// ═══════════════════════════════════════════════════════════════════════════════

/** POST /astrocartography/lines — Get astrocartography planetary lines. */
export async function getAstrocartographyLines(
  birthData: BirthData,
): Promise<any> {
  const res = await fetch(`${API_BASE}/astrocartography/lines`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ subject: buildSubject(birthData) }),
  });
  if (!res.ok) throw new Error(`Astrocartography lines error: ${res.status}`);
  return unwrap(await res.json());
}

/** POST /astrocartography/power-zones — Find power zones on the globe. */
export async function getPowerZones(birthData: BirthData): Promise<any> {
  const res = await fetch(`${API_BASE}/astrocartography/power-zones`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ subject: buildSubject(birthData) }),
  });
  if (!res.ok) throw new Error(`Power zones error: ${res.status}`);
  return unwrap(await res.json());
}

/** POST /astrocartography/location-analysis — Analyze a specific location. */
export async function getLocationAnalysis(
  birthData: BirthData,
  lat: number,
  lng: number,
): Promise<any> {
  const res = await fetch(`${API_BASE}/astrocartography/location-analysis`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      subject: buildSubject(birthData),
      location: { latitude: lat, longitude: lng },
    }),
  });
  if (!res.ok) throw new Error(`Location analysis error: ${res.status}`);
  return unwrap(await res.json());
}

// ═══════════════════════════════════════════════════════════════════════════════
//  WELLNESS  (/insights/wellness/*)
// ═══════════════════════════════════════════════════════════════════════════════

/** POST /insights/wellness/biorhythms — Calculate biorhythm cycles. */
export async function getBiorhythms(birthData: BirthData): Promise<any> {
  const res = await fetch(`${API_BASE}/insights/wellness/biorhythms`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      subject: buildSubject(birthData),
      target_date: new Date().toISOString().split("T")[0],
    }),
  });
  if (!res.ok) throw new Error(`Biorhythms error: ${res.status}`);
  return unwrap(await res.json());
}

/** POST /insights/wellness/wellness-score — Overall wellness score. */
export async function getWellnessScore(birthData: BirthData): Promise<any> {
  const res = await fetch(`${API_BASE}/insights/wellness/wellness-score`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ subject: buildSubject(birthData) }),
  });
  if (!res.ok) throw new Error(`Wellness score error: ${res.status}`);
  return unwrap(await res.json());
}

/** POST /insights/wellness/energy-patterns — Daily energy patterns. */
export async function getEnergyPatterns(birthData: BirthData): Promise<any> {
  const res = await fetch(`${API_BASE}/insights/wellness/energy-patterns`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ subject: buildSubject(birthData) }),
  });
  if (!res.ok) throw new Error(`Energy patterns error: ${res.status}`);
  return unwrap(await res.json());
}

// ═══════════════════════════════════════════════════════════════════════════════
//  HUMAN DESIGN  (/human-design/*)
// ═══════════════════════════════════════════════════════════════════════════════

/** POST /human-design/type — Get Human Design type. */
export async function getHumanDesignType(birthData: BirthData): Promise<any> {
  const res = await fetch(`${API_BASE}/human-design/type`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ subject: buildSubject(birthData) }),
  });
  if (!res.ok) throw new Error(`HD type error: ${res.status}`);
  return unwrap(await res.json());
}

/** POST /human-design/bodygraph — Calculate full bodygraph. */
export async function getBodygraph(birthData: BirthData): Promise<any> {
  const res = await fetch(`${API_BASE}/human-design/bodygraph`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ subject: buildSubject(birthData) }),
  });
  if (!res.ok) throw new Error(`Bodygraph error: ${res.status}`);
  return unwrap(await res.json());
}

/** POST /human-design/bodygraph-svg — Render bodygraph as SVG. */
export async function getBodygraphSVG(birthData: BirthData): Promise<string> {
  const res = await fetch(`${API_BASE}/human-design/bodygraph-svg`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ subject: buildSubject(birthData) }),
  });
  if (!res.ok) throw new Error(`Bodygraph SVG error: ${res.status}`);
  return res.text();
}

// ═══════════════════════════════════════════════════════════════════════════════
//  ADVANCED VEDIC  (/vedic/shadbala, /vedic/varshaphal)
// ═══════════════════════════════════════════════════════════════════════════════

/** POST /vedic/shadbala — Six-fold planetary strength. */
export async function getShadbala(birthData: BirthData): Promise<any> {
  const res = await fetch(`${API_BASE}/vedic/shadbala`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ subject: buildSubject(birthData) }),
  });
  if (!res.ok) throw new Error(`Shadbala error: ${res.status}`);
  return unwrap(await res.json());
}

/** POST /vedic/varshaphal — Annual solar return chart. */
export async function getVarshaphal(
  birthData: BirthData,
  year?: number,
): Promise<any> {
  const res = await fetch(`${API_BASE}/vedic/varshaphal`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      subject: buildSubject(birthData),
      year: year || new Date().getFullYear(),
    }),
  });
  if (!res.ok) throw new Error(`Varshaphal error: ${res.status}`);
  return unwrap(await res.json());
}
