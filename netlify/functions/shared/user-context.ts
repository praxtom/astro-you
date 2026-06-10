import { db } from "./firebase-admin.js";
import {
  getDashaPeriods,
  getPanchang,
  getTransitReport,
  getYogaAnalysis,
} from "./astro-api.js";
import type { UserContext } from "./gemini.js";
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
  let yogasResult: any = null;
  let panchangResult: any = null;

  if (!options.previousInteractionId && birthData?.dob && birthData?.tob) {
    try {
      const [dashas, transitEvents, yogasRes, panchangRes] = await Promise.all([
        withTimeout(getDashaPeriods(birthData), 5000, []),
        withTimeout(getTransitReport(birthData), 5000, []),
        withTimeout(getYogaAnalysis(birthData), 5000, null),
        withTimeout(getPanchang(), 5000, null),
      ]);

      yogasResult = yogasRes;
      panchangResult = panchangRes;

      if (Array.isArray(dashas) && dashas.length > 0) {
        const dashaList = dashas as any[];
        const currentMaha = dashaList.find((d: any) => d.isCurrent);
        const currentAntar = currentMaha?.subPeriods?.find(
          (s: any) => s.isCurrent,
        );
        dashaInfo = {
          currentMahadasha: currentMaha?.planet || currentMaha?.planetName,
          currentAntardasha: currentAntar?.planet || currentAntar?.planetName,
          mahadashaEnd: currentMaha?.endDate,
          antardashaEnd: currentAntar?.endDate,
        };
      }

      if (Array.isArray(transitEvents) && transitEvents.length > 0) {
        transitContext = transitEvents
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
    } catch (error) {
      console.warn("[UserContext] Astrology enrichment failed:", error);
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
      normalizeYogas(yogasResult?.yogas || yogasResult) ||
      undefined,
    panchangData: options.panchangData || panchangResult || undefined,
  };

  return { userContext, kundaliSummary };
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

function normalizeYogas(value: any): UserContext["yogaData"] | undefined {
  const yogas = Array.isArray(value) ? value : value?.yogas;
  if (!Array.isArray(yogas)) return undefined;
  return yogas.slice(0, 5).map((yoga: any) => ({
    name: yoga.name || yoga.yoga_name || yoga.title || "Yoga",
    strength: yoga.strength,
    planets: Array.isArray(yoga.planets) ? yoga.planets : undefined,
  }));
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
