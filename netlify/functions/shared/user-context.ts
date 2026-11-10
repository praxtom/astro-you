import { db } from "./firebase-admin.js";
import { getCachedOrFetch } from "./cache.js";
import {
  clampedTodayKey,
  panchangCacheDocId as placePanchangCacheDocId,
  resolvePanchangPlace,
  stripPanchangLocation,
} from "./chart-cache.js";
import { canonicalNakshatraName, canonicalSignName } from "./vedic-names.js";
import { getPanchang, getTransitReport } from "./astro-api.js";
import {
  chartBirthData,
  getCachedDashaPeriods,
  getCachedYogaAnalysis,
} from "./astro-cached.js";
import type { UserContext } from "./gemini.js";
import {
  getWeeklyAstrologyContext,
  type WeeklyAstrologyCacheRecord,
  type WeeklyAstrologyContextData,
  type WeeklyAstrologyContextStore,
} from "./weekly-astrology-context.js";
import { normalizePlatformLanguage } from "./languages.js";
import { selectBrainContext } from "./atman-brain.js";
import { resolveAtmanContextSource } from "./user-context-source.js";
import { sanitizeAtmanContext, sanitizePromptText } from "./sanitize.js";
import type { AtmanData } from "../../../src/types/user.js";

/** Prompt-input caps for the free-text fields we interpolate verbatim. */
const MAX_NAME_CHARS = 80;
const MAX_SUMMARY_TITLE_CHARS = 120;
const MAX_SUMMARY_CHARS = 600;
/** Caps for context a guest's client sends (signed-in users: server-loaded). */
export const MAX_RECENT_SUMMARIES = 3;
export const MAX_CLIENT_PLANETS = 15;
const MAX_PLANET_FIELD_CHARS = 24;
const MAX_CLIENT_YOGAS = 5;
const MAX_YOGA_NAME_CHARS = 60;
const MAX_CONTEXT_FIELD_CHARS = 80;
const MAX_BIRTH_FIELD_CHARS = 40;
const MAX_PLACE_CHARS = 120;

/**
 * Chat titles and summaries are model output over user text — they are replayed
 * into the next prompt as "what we talked about before", so a crafted message
 * could otherwise smuggle instructions across conversations. Sanitize and cap
 * them; `date` is derived server-side and passes through.
 */
export function sanitizeRecentSummaries<
  T extends { title?: unknown; summary?: unknown },
>(summaries: T[]): T[] {
  return summaries.map((entry) => ({
    ...entry,
    title: sanitizePromptText(entry.title, MAX_SUMMARY_TITLE_CHARS),
    summary: sanitizePromptText(entry.summary, MAX_SUMMARY_CHARS),
  }));
}

/**
 * A chart sent by the client (guest path only): keep just the fields the
 * prompt uses, bounded in count and length, so a crafted payload can neither
 * inflate the prompt nor smuggle instructions into it.
 */
export function sanitizeClientKundali(
  value: unknown,
):
  | {
      planetary_positions: Array<{
        name: string;
        sign: string;
        house?: number;
        is_retrograde?: true;
      }>;
      timeUnknown?: true;
    }
  | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = (value as { planetary_positions?: unknown }).planetary_positions;
  if (!Array.isArray(raw)) return undefined;
  const planetary_positions = raw
    .slice(0, MAX_CLIENT_PLANETS)
    .filter((planet) => planet && typeof planet === "object")
    .map((planet: any) => {
      const house = Number(planet.house);
      return {
        name: sanitizePromptText(planet.name, MAX_PLANET_FIELD_CHARS),
        sign: sanitizePromptText(planet.sign, MAX_PLANET_FIELD_CHARS),
        ...(Number.isInteger(house) && house >= 1 && house <= 12
          ? { house }
          : {}),
        ...(planet.is_retrograde === true
          ? { is_retrograde: true as const }
          : {}),
      };
    })
    .filter((planet) => planet.name && planet.sign);
  if (planetary_positions.length === 0) return undefined;
  return {
    planetary_positions,
    ...((value as { timeUnknown?: unknown }).timeUnknown === true
      ? { timeUnknown: true as const }
      : {}),
  };
}

/** Client-sent yogas (guest path only), bounded and sanitized. */
export function sanitizeClientYogas(
  value: unknown,
): UserContext["yogaData"] | undefined {
  if (!Array.isArray(value)) return undefined;
  const yogas = value
    .slice(0, MAX_CLIENT_YOGAS)
    .filter((yoga) => yoga && typeof yoga === "object")
    .map((yoga: any) => {
      const strength = sanitizePromptText(yoga.strength, 20);
      const planets = Array.isArray(yoga.planets)
        ? yoga.planets
            .slice(0, 9)
            .map((planet: unknown) =>
              sanitizePromptText(planet, MAX_PLANET_FIELD_CHARS),
            )
            .filter(Boolean)
        : [];
      return {
        name: sanitizePromptText(yoga.name, MAX_YOGA_NAME_CHARS),
        ...(strength ? { strength } : {}),
        ...(planets.length ? { planets } : {}),
      };
    })
    .filter((yoga) => yoga.name);
  return yogas.length ? yogas : undefined;
}

/** Client-sent panchang (guest path only), each field bounded. */
export function sanitizeClientPanchang(
  value: unknown,
): UserContext["panchangData"] | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  const field = (v: unknown) =>
    sanitizePromptText(v, MAX_CONTEXT_FIELD_CHARS) || undefined;
  const panchang = {
    tithi: field(raw.tithi),
    nakshatra: field(raw.nakshatra),
    yoga: field(raw.yoga),
    karana: field(raw.karana),
    rahu_kaal: field(raw.rahu_kaal),
  };
  return Object.values(panchang).some(Boolean) ? panchang : undefined;
}

/** Client-sent diary entries (guest path only): at most 3, sanitized. */
export function sanitizeClientRecentSummaries(
  value: unknown,
): UserContext["recentSummaries"] | undefined {
  if (!Array.isArray(value)) return undefined;
  const summaries = sanitizeRecentSummaries(
    value
      .filter((entry) => entry && typeof entry === "object")
      .slice(0, MAX_RECENT_SUMMARIES),
  )
    .filter((entry: any) => entry.summary)
    .map((entry: any) => ({
      title: entry.title || "Untitled",
      summary: entry.summary,
      date: sanitizePromptText(entry.date, 20),
    }));
  return summaries.length ? summaries : undefined;
}

interface BuildUserContextOptions {
  uid?: string;
  birthData?: any;
  kundaliData?: any;
  /**
   * Accepted for call-site compatibility only. Context is built in full on
   * EVERY turn: the Interactions API does not carry system_instruction across
   * previous_interaction_id, so a follow-up turn built without dasha/transit/
   * yoga/memory would answer blind.
   */
  previousInteractionId?: string;
  /** Caller's local YYYY-MM-DD (for the daily panchang cache key). */
  localDate?: string;
  atmanData?: UserContext["atman"];
  recentSummaries?: UserContext["recentSummaries"];
  yogaData?: UserContext["yogaData"];
  panchangData?: UserContext["panchangData"];
}

export interface BuiltUserContext {
  userContext: UserContext;
  kundaliSummary: string;
}

const withTimeout = <T>(
  promise: Promise<T>,
  ms: number,
  fallback: T,
): Promise<T> =>
  Promise.race([
    promise,
    new Promise<T>((resolve) => {
      const timer = setTimeout(() => resolve(fallback), ms);
      if (typeof timer === "object" && "unref" in timer) {
        (timer as any).unref();
      }
    }),
  ]);

const weeklyAstrologyContextStore: WeeklyAstrologyContextStore = {
  async get(docId) {
    const snapshot = await db
      .collection("weeklyAstrologyContext")
      .doc(docId)
      .get();
    if (!snapshot.exists) return null;
    return snapshot.data() as WeeklyAstrologyCacheRecord;
  },
  async set(docId, record) {
    await db.collection("weeklyAstrologyContext").doc(docId).set(record);
  },
};

export interface PanchangLocation {
  city?: string;
  lat?: number;
  lng?: number;
}

/** Data loaders, injectable so the context assembly is unit-testable. */
export interface UserContextDeps {
  loadUserDoc(uid: string): Promise<Record<string, any>>;
  loadRecentSummaries(uid: string): Promise<UserContext["recentSummaries"]>;
  loadWeeklyContext(input: {
    uid?: string;
    birthData: any;
  }): Promise<WeeklyAstrologyContextData>;
  loadDailyPanchang(input: {
    dateKey: string;
    location?: PanchangLocation;
  }): Promise<UserContext["panchangData"]>;
}

const defaultDeps: UserContextDeps = {
  async loadUserDoc(uid) {
    const snapshot = await db.collection("users").doc(uid).get();
    return snapshot.data() || {};
  },
  loadRecentSummaries,
  async loadWeeklyContext({ uid, birthData }) {
    const weeklyContext = await getWeeklyAstrologyContext({
      uid,
      birthData,
      store: weeklyAstrologyContextStore,
      fetchFresh: () => fetchFreshAstrologyContext(birthData),
    });
    if (weeklyContext.source !== "cache") {
      console.info(
        `[UserContext] Weekly astrology context source: ${weeklyContext.source}`,
      );
    }
    return weeklyContext.data;
  },
  loadDailyPanchang,
};

export async function buildUserContext(
  options: BuildUserContextOptions,
  deps: UserContextDeps = defaultDeps,
): Promise<BuiltUserContext> {
  const userData = options.uid ? await deps.loadUserDoc(options.uid) : {};
  const profile = userData.profile || {};
  const birthData = options.birthData || toBirthData(profile);
  // Signed-in users: chart, diary, yogas and panchang come from the server
  // only — client copies are ignored (they are unbounded, can be a D9 chart,
  // and are an injection path). Guests: the client copy, sanitized and capped.
  const signedIn = Boolean(options.uid);
  const kundaliData = signedIn
    ? userData.kundaliData
    : sanitizeClientKundali(options.kundaliData);
  const clientRecentSummaries = signedIn
    ? undefined
    : sanitizeClientRecentSummaries(options.recentSummaries);
  const clientYogaData = signedIn
    ? undefined
    : sanitizeClientYogas(options.yogaData);
  const clientPanchangData = signedIn
    ? undefined
    : sanitizeClientPanchang(options.panchangData);
  // "I don't know my birth time": the chart was cast for noon, so there is
  // no Lagna, houses are counted from the Moon, and dasha dates are rough.
  const birthTimeUnknown =
    options.birthData?.birthTimeUnknown === true ||
    // The profile flag applies when the chat is about the profile's own chart.
    (profile.birthTimeUnknown === true &&
      (!options.birthData || options.birthData.dob === profile.dob)) ||
    kundaliData?.timeUnknown === true;
  const kundaliSummary = buildKundaliSummary(
    birthTimeUnknown && kundaliData && !kundaliData.timeUnknown
      ? { ...kundaliData, timeUnknown: true }
      : kundaliData,
  );
  const atmanSource = resolveAtmanContextSource({
    uid: options.uid,
    clientAtman: options.atmanData,
    serverAtman: userData.atman as UserContext["atman"] | undefined,
  }) as Partial<AtmanData> | undefined;
  // Sanitize free-text atman fields before they reach any prompt. Critical for
  // the guest path where atman data comes straight from the request body.
  const atmanContext = sanitizeAtmanContext(selectBrainContext(atmanSource));

  // Every turn gets the full context (weekly-cached astrology, daily-cached
  // panchang, recent diary entries) — loaded in parallel, each failure-safe.
  const [recentSummaries, weeklyAstrologyContext, dailyPanchang] =
    await Promise.all([
      clientRecentSummaries
        ? Promise.resolve(clientRecentSummaries)
        : options.uid
          ? deps.loadRecentSummaries(options.uid).catch((error) => {
              console.warn(
                "[UserContext] Recent summaries unavailable:",
                error,
              );
              return undefined;
            })
          : Promise.resolve(undefined),
      birthData?.dob && birthData?.tob
        ? deps
            .loadWeeklyContext({ uid: options.uid, birthData })
            .catch((error): WeeklyAstrologyContextData => {
              console.warn(
                "[UserContext] Weekly astrology context unavailable:",
                error,
              );
              return {};
            })
        : Promise.resolve({} as WeeklyAstrologyContextData),
      // Same gate as the astrology context: no chart, no paid lookups.
      clientPanchangData || !(birthData?.dob && birthData?.tob)
        ? Promise.resolve(undefined)
        : deps
            .loadDailyPanchang({
              dateKey: clampedTodayKey(options.localDate),
              location: resolvePanchangLocation(profile, birthData),
            })
            .catch((error) => {
              console.warn("[UserContext] Panchang unavailable:", error);
              return undefined;
            }),
    ]);
  const dashaInfo =
    birthTimeUnknown && weeklyAstrologyContext.dashaInfo
      ? { ...weeklyAstrologyContext.dashaInfo, approximate: true }
      : weeklyAstrologyContext.dashaInfo;
  const transitContext = weeklyAstrologyContext.transitContext;

  const userContext: UserContext = {
    // The display name is interpolated into every prompt. It is user-supplied
    // (and on the guest path comes straight off the request body), so it is
    // sanitized like any other untrusted prompt input.
    name:
      sanitizePromptText(
        birthData?.name || profile.name || userData.name,
        MAX_NAME_CHARS,
      ) || "Jataka",
    language: normalizePlatformLanguage(profile.language || userData.language),
    // Interpolated into the prompt; on the guest path straight off the body.
    birthData: birthData
      ? {
          dob: sanitizePromptText(birthData.dob, MAX_BIRTH_FIELD_CHARS),
          tob: sanitizePromptText(birthData.tob, MAX_BIRTH_FIELD_CHARS),
          pob: sanitizePromptText(birthData.pob, MAX_PLACE_CHARS),
        }
      : undefined,
    kundaliSummary,
    // Owner-writable profile fields interpolated into the system prompt:
    // only a recognized sign/nakshatra name gets through, never free text.
    moonSign: canonicalSignName(profile.moonSign || userData.moonSign),
    sunSign: canonicalSignName(profile.sunSign || userData.sunSign),
    moonNakshatra: canonicalNakshatraName(profile.moonNakshatra),
    // A noon-cast Lagna is a guess — never hand it to the model.
    ascendant: birthTimeUnknown
      ? undefined
      : normalizeAscendant(profile.ascendant || userData.ascendant),
    birthTimeUnknown: birthTimeUnknown || undefined,
    credits: userData.credits,
    subscriptionTier: userData.subscription?.tier,
    dashaInfo,
    atman: atmanContext,
    recentSummaries,
    transitContext,
    recentAdvice:
      atmanContext?.adviceHistory?.slice(-5) ||
      atmanContext?.savedAdvice?.slice(-5) ||
      undefined,
    yogaData: clientYogaData || weeklyAstrologyContext.yogaData || undefined,
    panchangData:
      clientPanchangData ||
      dailyPanchang ||
      // Legacy weekly cache records still carry a (stale) panchang snapshot.
      weeklyAstrologyContext.panchangData ||
      undefined,
  };

  return { userContext: stripUndefinedFields(userContext), kundaliSummary };
}

/** Drop undefined top-level fields so no prompt ever renders "undefined". */
function stripUndefinedFields<T extends object>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined),
  ) as T;
}

/**
 * Where to compute today's panchang for this user. Only returns a location
 * when we have real coordinates for it — getPanchang otherwise pairs any city
 * name with New Delhi's coordinates, which would be silently wrong.
 */
export function resolvePanchangLocation(
  profile: Record<string, any> | undefined,
  birthData?: any,
): PanchangLocation | undefined {
  const current =
    typeof profile?.currentLocation === "string"
      ? profile.currentLocation.trim()
      : "";
  const currentCoords = readCoords(
    profile?.currentCoordinates ?? profile?.currentLocationCoordinates,
  );
  if (current && currentCoords) return { city: current, ...currentCoords };

  const pob =
    typeof (birthData?.pob ?? profile?.pob) === "string"
      ? String(birthData?.pob ?? profile?.pob).trim()
      : "";
  const birthCoords =
    readCoords(birthData?.coordinates) ??
    readCoords({ lat: birthData?.lat, lng: birthData?.lng }) ??
    readCoords(profile?.coordinates);
  // Birth coordinates only stand in when the user lives where they were born
  // (or never told us otherwise).
  if (birthCoords && pob && (!current || current === pob)) {
    return { city: pob, ...birthCoords };
  }
  return undefined;
}

function readCoords(value: any): { lat: number; lng: number } | undefined {
  const lat = Number(value?.lat);
  const lng = Number(value?.lng);
  if (
    value?.lat == null ||
    value?.lng == null ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng)
  ) {
    return undefined;
  }
  return { lat, lng };
}

/**
 * Shared panchang cache doc id — the same key kundali.ts PANCHANG uses
 * (shared/chart-cache.ts: date + city label + coordinates), so the dashboard
 * card and chat context share one cached API call per day/place.
 */
export function panchangCacheDocId(
  dateKey: string,
  location?: PanchangLocation,
): string {
  return placePanchangCacheDocId(dateKey, resolvePanchangPlace(location ?? {}));
}

async function loadDailyPanchang(input: {
  dateKey: string;
  location?: PanchangLocation;
}): Promise<UserContext["panchangData"]> {
  const { dateKey, location } = input;
  const place = resolvePanchangPlace(location ?? {});
  const raw = await withTimeout(
    getCachedOrFetch(
      "panchang",
      placePanchangCacheDocId(dateKey, place),
      async () =>
        stripPanchangLocation(
          await getPanchang(dateKey, place.city, place.lat, place.lng),
        ),
    ).then(stripPanchangLocation),
    5000,
    null,
  );
  return normalizePanchang(raw);
}

async function fetchFreshAstrologyContext(
  birthData: any,
): Promise<WeeklyAstrologyContextData> {
  // Panchang is daily data — it is fetched per day via loadDailyPanchang,
  // not frozen into this weekly record.
  // Dashas and yogas are natal: read them through the same chart_cache
  // entries /api/kundali fills, so a refresh after a dashboard visit is free.
  const bd = chartBirthData(birthData);
  const [dashas, transitEvents, yogasResult] = await Promise.all([
    readAstrologyPart("Dasha", getCachedDashaPeriods(bd), []),
    readAstrologyPart("Transit report", getTransitReport(birthData), []),
    readAstrologyPart("Yoga analysis", getCachedYogaAnalysis(bd), null),
  ]);

  const context = {
    dashaInfo: extractDashaInfo(dashas),
    transitContext: buildTransitContext(transitEvents),
    yogaData: normalizeYogas(yogasResult?.yogas || yogasResult),
  };

  if (!hasAstrologyContextData(context)) {
    throw new Error("Astrology context pull returned no usable data.");
  }

  return context;
}

async function readAstrologyPart<T>(
  label: string,
  promise: Promise<T>,
  fallback: T,
): Promise<T> {
  try {
    return await withTimeout(promise, 5000, fallback);
  } catch (error) {
    console.warn(`[UserContext] ${label} unavailable:`, error);
    return fallback;
  }
}

function toBirthData(profile: Record<string, any>) {
  if (!profile?.dob || !profile?.tob) return undefined;
  return {
    name: profile.name,
    dob: profile.dob,
    tob: profile.tob,
    pob: profile.pob,
    lat: profile.lat ?? profile.coordinates?.lat,
    lng: profile.lng ?? profile.coordinates?.lng,
    coordinates: profile.coordinates,
    ...(profile.birthTimeUnknown === true ? { birthTimeUnknown: true } : {}),
  };
}

export function buildKundaliSummary(kundaliData: any) {
  // Time unknown: house numbers are counted from the Moon (Chandra Lagna).
  const fromMoon = kundaliData?.timeUnknown === true;
  const houseLabel = (house: unknown) => {
    if (!fromMoon) return formatHouse(house);
    const ordinal = formatOrdinal(house);
    return ordinal && ordinal !== "0th" ? `${ordinal} from the Moon` : "";
  };
  return (
    kundaliData?.planetary_positions
      ?.filter(
        (planet: any) =>
          !(fromMoon && /^(ascendant|lagna|asc)$/i.test(String(planet?.name))),
      )
      ?.map(
        (planet: any) =>
          `${planet.name} in ${planet.sign}${
            houseLabel(planet.house) ? ` (${houseLabel(planet.house)})` : ""
          }${planet.is_retrograde ? " [Retrograde]" : ""}`,
      )
      .join(", ") || "Planetary data currently veiled."
  );
}

/** 1 → "1st", 2 → "2nd", 11 → "11th", 22 → "22nd". */
export function formatOrdinal(value: unknown): string {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(n) || n < 0) return "";
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

/** "1st House", or "" when the house number is missing/unparseable. */
export function formatHouse(value: unknown): string {
  if (value === undefined || value === null || value === "") return "";
  const ordinal = formatOrdinal(value);
  return ordinal ? `${ordinal} House` : "";
}

function normalizeAscendant(value: unknown) {
  if (typeof value === "string") return canonicalSignName(value);
  if (value && typeof value === "object" && "sign" in value) {
    return canonicalSignName((value as { sign?: unknown }).sign);
  }
  return undefined;
}

function extractDashaInfo(value: any): UserContext["dashaInfo"] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;

  const currentMaha = value.find((dasha: any) => dasha.isCurrent);
  const currentAntar = currentMaha?.subPeriods?.find(
    (period: any) => period.isCurrent,
  );

  return {
    currentMahadasha: currentMaha?.planet || currentMaha?.planetName,
    currentAntardasha: currentAntar?.planet || currentAntar?.planetName,
    mahadashaEnd: currentMaha?.endDate,
    antardashaEnd: currentAntar?.endDate,
  };
}

function buildTransitContext(value: any): string | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;

  return value
    .slice(0, 6)
    .map((event: any) => {
      const planet = event.transit_planet || event.planet || "Planet";
      const aspect = event.aspect_type || event.aspect || "aspecting";
      const target =
        event.natal_planet || event.natal_body || event.target || "point";
      const text =
        event.interpretation ||
        event.description ||
        event.text ||
        "Active transit";
      return `${planet} ${aspect} natal ${target}: ${text}`;
    })
    .join("\n");
}

function normalizeYogas(value: any): UserContext["yogaData"] | undefined {
  const yogas = Array.isArray(value) ? value : value?.yogas;
  if (!Array.isArray(yogas)) return undefined;
  return yogas.slice(0, 5).map((yoga: any) => ({
    name: yoga.name || yoga.yoga_name || yoga.title || "Yoga",
    strength: yoga.strength,
    planets: Array.isArray(yoga.planets) ? yoga.planets : undefined,
  }));
}

function normalizePanchang(
  value: any,
): UserContext["panchangData"] | undefined {
  if (!value || typeof value !== "object") return undefined;

  // Each limb arrives either as a plain string or as an object
  // ({ name, end_time, ... }); a time window as a string or { start, end }.
  const label = (field: any): string | undefined => {
    if (typeof field === "string") return toOptionalString(field);
    if (field && typeof field === "object") {
      return toOptionalString(field.name || field.label || field.title);
    }
    return undefined;
  };
  const window = (field: any): string | undefined => {
    if (typeof field === "string") return toOptionalString(field);
    if (field && typeof field === "object") {
      const start = toOptionalString(field.start || field.start_time);
      const end = toOptionalString(field.end || field.end_time);
      return start && end ? `${start} - ${end}` : undefined;
    }
    return undefined;
  };
  const result = {
    tithi: label(value.tithi) || toOptionalString(value.tithi_name),
    nakshatra:
      label(value.nakshatra) || toOptionalString(value.nakshatra_name),
    yoga: label(value.yoga) || toOptionalString(value.yoga_name),
    karana: label(value.karana) || toOptionalString(value.karana_name),
    rahu_kaal: window(
      value.inauspicious_periods?.rahu_kalam ||
        value.rahu_kaal ||
        value.rahukaal ||
        value.rahuKaal ||
        value.rahu_kalam,
    ),
  };
  // Nothing readable: omit the block rather than tell the model "Unknown".
  return Object.values(result).some(Boolean) ? result : undefined;
}

function hasAstrologyContextData(context: WeeklyAstrologyContextData) {
  return Boolean(
    context.dashaInfo ||
    context.transitContext ||
    context.yogaData?.length ||
    (context.panchangData &&
      Object.values(context.panchangData).some((value) => Boolean(value))),
  );
}

function toOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

async function loadRecentSummaries(
  uid: string,
): Promise<UserContext["recentSummaries"]> {
  try {
    const snapshot = await db
      .collection("users")
      .doc(uid)
      .collection("chats")
      .orderBy("lastUpdatedAt", "desc")
      .limit(3)
      .get();

    const docs = snapshot.docs as Array<{ data(): any }>;

    return sanitizeRecentSummaries(
      docs
        .filter((doc) => doc.data().summary)
        .map((doc) => ({
          title: doc.data().title || "Untitled",
          summary: doc.data().summary,
          date:
            doc.data().lastUpdatedAt?.toDate?.()?.toLocaleDateString?.() || "",
        })),
    );
  } catch (error) {
    console.warn("[UserContext] Recent summaries unavailable:", error);
    return undefined;
  }
}
