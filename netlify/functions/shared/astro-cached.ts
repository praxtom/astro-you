/**
 * Cached reads of astrology data that several endpoints need, keyed exactly
 * like /api/kundali so the endpoints share one upstream call:
 *
 * - panchang: the shared `panchang` collection, same doc id as
 *   kundali.ts PANCHANG (date + HMAC of the place).
 * - dashas: `chart_cache`, same doc id as kundali.ts DASHAS.
 * - yogas: `chart_cache`, same doc id as kundali.ts YOGAS.
 *
 * A dashboard visit that already loaded DASHAS/PANCHANG therefore makes the
 * daily forecast and chat context free for those parts.
 */
import { getCachedOrFetch } from "./cache.js";
import {
  CHART_CACHE_COLLECTION,
  NATAL_TTL_HOURS,
  birthChartCacheKey,
  panchangCacheDocId,
  refreshDashaCurrentFlags,
  resolvePanchangPlace,
  stripEchoedBirthInputs,
  stripPanchangLocation,
} from "./chart-cache.js";
import {
  getDashaPeriods,
  getPanchang,
  getYogaAnalysis,
  type BirthData,
  type DashaPeriod,
} from "./astro-api.js";
import {
  localDashaPeriods,
  localPanchang,
  tryLocalEngine,
} from "./astro-engine.js";

/** Panchang for a day and place through the shared cache (location-stripped). */
export async function getCachedPanchang(
  dateKey: string,
  placeInput: { city?: unknown; lat?: unknown; lng?: unknown },
  fetchPanchang: typeof getPanchang = getPanchang,
): Promise<any> {
  const place = resolvePanchangPlace(placeInput);
  // ASTRO_ENGINE=local: computed in-house, no upstream call, no cache needed.
  const local = tryLocalEngine("panchang", () => localPanchang(dateKey, place));
  if (local) return local;
  // Sanitized on write AND on read: entries cached before the sanitizer
  // existed may still carry the requester's location.
  return stripPanchangLocation(
    await getCachedOrFetch(
      "panchang",
      panchangCacheDocId(dateKey, place),
      async () =>
        stripPanchangLocation(
          await fetchPanchang(dateKey, place.city, place.lat, place.lng),
        ),
    ),
  );
}

/**
 * Lift profile-shaped `{ coordinates: { lat, lng } }` to top-level lat/lng —
 * the same normalization kundali.ts applies, so cache keys match.
 */
export function chartBirthData(birthData: Record<string, any>): BirthData {
  const coords = birthData.coordinates;
  const lift =
    (birthData.lat === undefined || birthData.lat === null) &&
    coords &&
    typeof coords.lat === "number" &&
    typeof coords.lng === "number" &&
    Math.abs(coords.lat) <= 90 &&
    Math.abs(coords.lng) <= 180;
  return {
    name: birthData.name,
    dob: birthData.dob,
    tob: birthData.tob,
    pob: birthData.pob,
    lat: lift ? coords.lat : birthData.lat,
    lng: lift ? coords.lng : birthData.lng,
    ...(birthData.birthTimeUnknown === true ? { birthTimeUnknown: true } : {}),
  };
}

/** Dasha periods through chart_cache (the kundali DASHAS entry), flags refreshed. */
export async function getCachedDashaPeriods(
  bd: BirthData,
): Promise<DashaPeriod[]> {
  const local = tryLocalEngine("dashas", () => localDashaPeriods(bd));
  if (local) return local;
  const periods = stripEchoedBirthInputs(
    await getCachedOrFetch(
      CHART_CACHE_COLLECTION,
      birthChartCacheKey("DASHAS", bd),
      async () => stripEchoedBirthInputs(await getDashaPeriods(bd)),
      NATAL_TTL_HOURS,
    ),
  );
  return refreshDashaCurrentFlags(Array.isArray(periods) ? periods : []);
}

/** Yoga analysis through chart_cache (the kundali YOGAS entry). */
export async function getCachedYogaAnalysis(bd: BirthData): Promise<any> {
  return stripEchoedBirthInputs(
    await getCachedOrFetch(
      CHART_CACHE_COLLECTION,
      birthChartCacheKey("YOGAS", bd),
      async () => stripEchoedBirthInputs(await getYogaAnalysis(bd)),
      NATAL_TTL_HOURS,
    ),
  );
}
