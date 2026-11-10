/**
 * useKundali Hook - Centralized Kundali data access
 * Fetches from API if not cached, otherwise returns cached data
 */

import { useCallback, useState, useEffect, useRef } from "react";
import { deleteField, doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { devLog } from "../lib/devLog";
import { useAuth } from "../lib/useAuth";
import type { KundaliData, BirthData, PlanetaryPosition } from "../types";
import { useRequestBirthData } from "./useRequestBirthData";
import { postJson } from "../lib/apiFetch";
import {
  createLatestRequestGate,
  isUsableCachedKundali,
} from "../lib/profile-readiness";
import { normalizeZodiacMode, type ZodiacMode } from "../lib/zodiac-mode";
import { deriveProfileSigns } from "../lib/chart-summary";

/**
 * Lazy backfill of profile.moonSign / sunSign / moonNakshatra from a Vedic D1
 * (they are read by the forecast, AI context and share text but were never
 * written). Only fills what is missing, so it writes at most once per chart.
 */
function profileSignUpdates(
  kundali: KundaliData | null | undefined,
  profile: Record<string, any> | null | undefined,
): Record<string, string> | null {
  const signs = deriveProfileSigns(kundali as any);
  if (!signs) return null;
  const updates: Record<string, string> = {};
  if (!profile?.moonSign) updates.moonSign = signs.moonSign;
  if (!profile?.sunSign && signs.sunSign) updates.sunSign = signs.sunSign;
  if (!profile?.moonNakshatra && signs.moonNakshatra)
    updates.moonNakshatra = signs.moonNakshatra;
  return Object.keys(updates).length ? updates : null;
}

/**
 * Firestore field a chart is cached under. The contract other code relies on
 * (the server's AI context and ConsultChat read it): `kundaliData` holds ONLY
 * the Vedic D1 chart in the profile's birth-time shape. A Western D1 lives in
 * `kundaliData_western`; divisional charts are Vedic-only on the server, so
 * they keep their `kundaliData_D9` / `kundaliData_D10` fields.
 */
export function kundaliCacheField(
  chartType: ChartType,
  mode: ZodiacMode,
): string {
  if (chartType !== "D1") return `kundaliData_${chartType}`;
  return mode === "western" ? "kundaliData_western" : "kundaliData";
}

/** The birth fields a cached chart was cast from. */
function birthKey(b: {
  dob?: unknown;
  tob?: unknown;
  pob?: unknown;
}): string {
  const text = (v: unknown) =>
    typeof v === "string" ? v.trim().toLowerCase() : "";
  return [text(b.dob), text(b.tob), text(b.pob)].join("|");
}

interface UseKundaliResult {
  kundaliData: KundaliData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export type ChartType = "D1" | "D9" | "D10";

export function useKundali(
  birthData: BirthData | null,
  chartType: ChartType = "D1",
  zodiacMode?: ZodiacMode,
  useProfileCache = true,
): UseKundaliResult {
  // Divisional charts are always computed sidereally (kundali.ts ignores the
  // zodiac mode for them), so only a D1 can be Western.
  const mode: ZodiacMode =
    chartType === "D1" ? normalizeZodiacMode(zodiacMode) : "vedic";
  const { user: signedInUser } = useAuth();
  const user = useProfileCache ? signedInUser : null;
  const [kundaliData, setKundaliData] = useState<KundaliData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestBirthData = useRequestBirthData(birthData);
  const requestGateRef = useRef(createLatestRequestGate());

  const fetchKundali = useCallback(
    async (signal?: AbortSignal) => {
      const request = requestGateRef.current.begin();
      const isCurrentRequest = () =>
        request.isCurrent() && signal?.aborted !== true;

      devLog("[useKundali] fetchKundali called with:", {
        birthData: requestBirthData,
        chartType,
        userId: user?.uid,
      });

      if (!requestBirthData?.dob || !requestBirthData.tob) {
        devLog("[useKundali] Missing required fields, returning early:", {
          hasBirthData: !!requestBirthData,
          dob: requestBirthData?.dob,
          tob: requestBirthData?.tob,
        });
        if (isCurrentRequest()) setLoading(false);
        return;
      }

      try {
        if (!isCurrentRequest()) return;
        setLoading(true);
        setError(null);
        setKundaliData(null);

        const cacheFieldName = kundaliCacheField(chartType, mode);
        let effectiveBirthData: BirthData = requestBirthData;

        // First, check if we have cached data in Firestore
        if (user) {
          const docRef = doc(db, "users", user.uid);
          const docSnap = await getDoc(docRef);
          if (!isCurrentRequest()) return;

          if (docSnap.exists()) {
            const data = docSnap.data();
            const savedProfile = data.profile;
            // A caller that forgot the flag must still get the profile's
            // birth-time shape when it is asking for the profile's own chart.
            if (
              requestBirthData.birthTimeUnknown === undefined &&
              savedProfile?.birthTimeUnknown === true &&
              birthKey(savedProfile) === birthKey(requestBirthData)
            ) {
              effectiveBirthData = {
                ...requestBirthData,
                birthTimeUnknown: true,
              };
            }
            const cachedData = data[cacheFieldName];

            // A chart cached before the birth time was marked unknown still
            // carries a guessed Lagna — refetch the time-unknown shape.
            const timeShapeMatches =
              Boolean(effectiveBirthData.birthTimeUnknown) ===
              Boolean(cachedData?.timeUnknown);
            // Charts written since the birth key was added must also be for
            // these exact birth details (older entries are cleared by
            // onboarding when the birth data changes).
            const birthMatches =
              typeof cachedData?._birthKey !== "string" ||
              cachedData._birthKey === birthKey(requestBirthData);
            // Only use cached data if it has actual planetary positions
            if (
              timeShapeMatches &&
              birthMatches &&
              isUsableCachedKundali(cachedData, chartType, mode)
            ) {
              devLog(
                "[useKundali] Using cached data with",
                cachedData.planetary_positions.length,
                "planets",
              );
              setKundaliData(cachedData);
              const backfill =
                chartType === "D1" && mode === "vedic"
                  ? profileSignUpdates(cachedData, data.profile)
                  : null;
              if (backfill && data.profile?.dob) {
                void setDoc(
                  docRef,
                  { profile: backfill },
                  { merge: true },
                ).catch((e) =>
                  console.warn("[useKundali] Sign backfill failed:", e),
                );
              }
              return;
            } else {
              devLog(
                "[useKundali] Cached data is empty or invalid, will fetch from API",
              );
            }
          }
        }

        devLog("[useKundali] Fetching from API...");

        // Fetch from API if not cached. The server's subject builder expects
        // flat lat/lng (see kundali.ts / astro-api.ts buildSubject), so flatten
        // profile.coordinates when present — this skips server-side geocoding
        // of the pob string. Coordinates stay optional.
        const requestPayload = effectiveBirthData.coordinates
          ? {
              ...effectiveBirthData,
              lat: effectiveBirthData.coordinates.lat,
              lng: effectiveBirthData.coordinates.lng,
            }
          : effectiveBirthData;
        const response = await postJson(
          "/api/kundali",
          { birthData: requestPayload, chartType, zodiacMode: mode },
          { signal },
        );
        if (!isCurrentRequest()) return;

        if (!response.ok) {
          // 422s carry user-facing copy (time unknown, uncalculable chart).
          let message = `Failed to fetch ${chartType} chart data (${response.status})`;
          if (response.status === 422) {
            const body = await response.json().catch(() => null);
            if (typeof body?.error === "string") message = body.error;
          }
          throw new Error(message);
        }

        const data = await response.json();
        if (!isCurrentRequest()) return;

        // Transform API response to our format
        const positions = data.planetary_positions || [];

        // Calculate Ketu from Rahu (Mean_Node) - Ketu is always exactly 180° opposite
        const rahuPos = positions.find((p: any) => p.name === "Mean_Node");
        if (
          rahuPos &&
          !positions.find((p: any) => p.name === "Mean_South_Node")
        ) {
          // Get opposite sign (6 signs away)
          const signOrder = [
            "Ari",
            "Tau",
            "Gem",
            "Can",
            "Leo",
            "Vir",
            "Lib",
            "Sco",
            "Sag",
            "Cap",
            "Aqu",
            "Pis",
          ];
          const rahuSignIdx = signOrder.indexOf(rahuPos.sign);
          const ketuSignIdx = (rahuSignIdx + 6) % 12; // 180° opposite
          const ketuHouse = ((rahuPos.house - 1 + 6) % 12) + 1; // Opposite house

          positions.push({
            name: "Mean_South_Node",
            sign: signOrder[ketuSignIdx],
            degree: rahuPos.degree, // Same degree as Rahu
            house: ketuHouse,
            is_retrograde: true, // Nodes are always retrograde
            nakshatra: "", // Will be calculated if needed
          });
          devLog(
            "[useKundali] Calculated Ketu position:",
            signOrder[ketuSignIdx],
            ketuHouse,
          );
        }

        const kundali: KundaliData = {
          planetary_positions: positions,
          house_cusps: data.house_cusps || [],
          ascendant: data.ascendant || null,
          ...(data.timeUnknown
            ? { timeUnknown: true, houseReference: data.houseReference || "moon" }
            : {}),
        };

        if (isCurrentRequest()) setKundaliData(kundali);

        // Cache in Firestore for logged-in users — but only a chart that is
        // the saved profile's own chart, in the profile's birth-time shape.
        // `kundaliData` is read by the server and ConsultChat as AI context,
        // so a noon chart for a time-unknown user (or a chart for someone
        // else's birth details) must never land there.
        if (user) {
          const docRef = doc(db, "users", user.uid);
          const profileSnap = await getDoc(docRef).catch(() => null);
          // Re-check right before writing: a newer request (mode switch,
          // edited birth data) may have started while we awaited, and a
          // stale chart must not overwrite the one it is fetching.
          if (!isCurrentRequest()) return;
          const userDoc = profileSnap?.data();
          const profileData = userDoc?.profile;
          // Legacy: Western charts used to be written into `kundaliData`.
          // Clear one when its Western replacement is saved, so the field
          // only ever holds the Vedic chart.
          const clearLegacyWestern =
            cacheFieldName === "kundaliData_western" &&
            userDoc?.kundaliData?._zodiacMode === "western";
          const isProfileChart =
            Boolean(profileData?.dob) &&
            birthKey(profileData) === birthKey(requestBirthData) &&
            Boolean(profileData?.birthTimeUnknown) ===
              Boolean(kundali.timeUnknown);
          if (isProfileChart) {
            // Sidereal signs only — a Western chart's signs are tropical.
            const backfill =
              chartType === "D1" && mode === "vedic"
                ? profileSignUpdates(kundali, profileData)
                : null;
            await setDoc(
              docRef,
              {
                [cacheFieldName]: {
                  ...kundali,
                  _chartType: chartType,
                  // Tagged so a mode switch misses this cache instead of
                  // silently serving the other zodiac's signs.
                  _zodiacMode: mode,
                  _birthKey: birthKey(requestBirthData),
                },
                ...(backfill ? { profile: backfill } : {}),
                ...(clearLegacyWestern ? { kundaliData: deleteField() } : {}),
              },
              { merge: true },
            );
          }
        }
      } catch (err: any) {
        if (err.name === "AbortError" || !isCurrentRequest()) return;
        console.error(`Error fetching ${chartType} Kundali:`, err);
        setError(err.message);
      } finally {
        if (isCurrentRequest()) setLoading(false);
      }
    },
    [chartType, requestBirthData, user, mode],
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchKundali(controller.signal);
    return () => controller.abort();
  }, [fetchKundali]);

  return {
    kundaliData,
    loading,
    error,
    refetch: fetchKundali,
  };
}

/**
 * Generate a text summary of Kundali for AI context
 */
export function getKundaliSummary(kundaliData: KundaliData | null): string {
  if (!kundaliData || !kundaliData.planetary_positions.length) {
    return "Planetary data currently veiled.";
  }

  return kundaliData.planetary_positions
    .map(
      (p: PlanetaryPosition) =>
        `${p.name} in ${p.sign} (${p.house}th House)${p.is_retrograde ? " [Retrograde]" : ""}`,
    )
    .join(", ");
}
