import { db } from "./firebase-admin.js";
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
import { sanitizeAtmanContext } from "./sanitize.js";
import type { AtmanData } from "../../../src/types/user.js";

interface BuildUserContextOptions {
  uid?: string;
  birthData?: any;
  kundaliData?: any;
  previousInteractionId?: string;
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
    const snapshot = await db.collection("weeklyAstrologyContext").doc(docId).get();
    if (!snapshot.exists) return null;
    return snapshot.data() as WeeklyAstrologyCacheRecord;
  },
  async set(docId, record) {
    await db.collection("weeklyAstrologyContext").doc(docId).set(record);
  },
};

export async function buildUserContext(
  options: BuildUserContextOptions,
): Promise<BuiltUserContext> {
  const userDoc = options.uid
    ? await db.collection("users").doc(options.uid).get()
    : null;
  const userData = userDoc?.data() || {};
  const profile = userData.profile || {};
  const birthData = options.birthData || toBirthData(profile);
  const kundaliData = options.kundaliData || userData.kundaliData;
  const kundaliSummary = buildKundaliSummary(kundaliData);
  const recentSummaries =
    options.recentSummaries ||
    (options.uid && !options.previousInteractionId
      ? await loadRecentSummaries(options.uid)
      : undefined);
  const atmanSource = resolveAtmanContextSource({
    uid: options.uid,
    clientAtman: options.atmanData,
    serverAtman: userData.atman as UserContext["atman"] | undefined,
  }) as Partial<AtmanData> | undefined;
  // Sanitize free-text atman fields before they reach any prompt. Critical for
  // the guest path where atman data comes straight from the request body.
  const atmanContext = sanitizeAtmanContext(selectBrainContext(atmanSource));

  let dashaInfo: UserContext["dashaInfo"] = undefined;
  let transitContext: string | undefined = undefined;
  let weeklyAstrologyContext: WeeklyAstrologyContextData = {};

  if (!options.previousInteractionId && birthData?.dob && birthData?.tob) {
    try {
      const weeklyContext = await getWeeklyAstrologyContext({
        uid: options.uid,
        birthData,
        store: weeklyAstrologyContextStore,
        fetchFresh: () => fetchFreshAstrologyContext(birthData),
      });

      weeklyAstrologyContext = weeklyContext.data;
      dashaInfo = weeklyAstrologyContext.dashaInfo;
      transitContext = weeklyAstrologyContext.transitContext;

      if (weeklyContext.source !== "cache") {
        console.info(
          `[UserContext] Weekly astrology context source: ${weeklyContext.source}`,
        );
      }
    } catch (error) {
      console.warn("[UserContext] Weekly astrology context unavailable:", error);
    }
  }

  const userContext: UserContext = {
    name: birthData?.name || profile.name || userData.name || "Jataka",
    language: normalizePlatformLanguage(profile.language || userData.language),
    birthData: birthData
      ? { dob: birthData.dob, tob: birthData.tob, pob: birthData.pob }
      : undefined,
    kundaliSummary,
    moonSign: profile.moonSign || userData.moonSign,
    ascendant: normalizeAscendant(profile.ascendant || userData.ascendant),
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
    yogaData:
      options.yogaData ||
      weeklyAstrologyContext.yogaData ||
      undefined,
    panchangData:
      options.panchangData || weeklyAstrologyContext.panchangData || undefined,
  };

  return { userContext, kundaliSummary };
}

async function fetchFreshAstrologyContext(
  birthData: any,
): Promise<WeeklyAstrologyContextData> {
  const [dashas, transitEvents, yogasResult, panchangResult] =
    await Promise.all([
      readAstrologyPart("Dasha", getDashaPeriods(birthData), []),
      readAstrologyPart("Transit report", getTransitReport(birthData), []),
      readAstrologyPart("Yoga analysis", getYogaAnalysis(birthData), null),
      readAstrologyPart("Panchang", getPanchang(), null),
    ]);

  const context = {
    dashaInfo: extractDashaInfo(dashas),
    transitContext: buildTransitContext(transitEvents),
    yogaData: normalizeYogas(yogasResult?.yogas || yogasResult),
    panchangData: normalizePanchang(panchangResult),
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
  };
}

function buildKundaliSummary(kundaliData: any) {
  return (
    kundaliData?.planetary_positions
      ?.map(
        (planet: any) =>
          `${planet.name} in ${planet.sign} (${planet.house}th House)${
            planet.is_retrograde ? " [Retrograde]" : ""
          }`,
      )
      .join(", ") || "Planetary data currently veiled."
  );
}

function normalizeAscendant(value: unknown) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "sign" in value) {
    return String((value as { sign?: unknown }).sign || "");
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

function normalizePanchang(value: any): UserContext["panchangData"] | undefined {
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

    return docs
      .filter((doc) => doc.data().summary)
      .map((doc) => ({
        title: doc.data().title || "Untitled",
        summary: doc.data().summary,
        date:
          doc.data().lastUpdatedAt?.toDate?.()?.toLocaleDateString?.() || "",
      }));
  } catch (error) {
    console.warn("[UserContext] Recent summaries unavailable:", error);
    return undefined;
  }
}
