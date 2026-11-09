import { db } from "./firebase-admin.js";
import { getCachedOrFetch } from "./cache.js";
import {
  clampedTodayKey,
  panchangCacheDocId as placePanchangCacheDocId,
  resolvePanchangPlace,
  stripPanchangLocation,
} from "./chart-cache.js";
import { canonicalNakshatraName, canonicalSignName } from "./vedic-names.js";
import {
  getDashaPeriods,
  getPanchang,
  getTransitReport,
  getYogaAnalysis,
} from "./astro-api.js";
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
  const kundaliData = options.kundaliData || userData.kundaliData;
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
      options.recentSummaries
        ? Promise.resolve(options.recentSummaries)
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
      options.panchangData || !(birthData?.dob && birthData?.tob)
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
    birthData: birthData
      ? { dob: birthData.dob, tob: birthData.tob, pob: birthData.pob }
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
    yogaData: options.yogaData || weeklyAstrologyContext.yogaData || undefined,
    panchangData:
      options.panchangData ||
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
  const [dashas, transitEvents, yogasResult] = await Promise.all([
    readAstrologyPart("Dasha", getDashaPeriods(birthData), []),
    readAstrologyPart("Transit report", getTransitReport(birthData), []),
    readAstrologyPart("Yoga analysis", getYogaAnalysis(birthData), null),
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

  return {
    tithi: toOptionalString(value.tithi || value.tithi_name),
    nakshatra: toOptionalString(value.nakshatra || value.nakshatra_name),
    yoga: toOptionalString(value.yoga || value.yoga_name),
    karana: toOptionalString(value.karana || value.karana_name),
    rahu_kaal: toOptionalString(
      value.rahu_kaal || value.rahukaal || value.rahuKaal,
    ),
  };
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
