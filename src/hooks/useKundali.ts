/**
 * useKundali Hook - Centralized Kundali data access
 * Fetches from API if not cached, otherwise returns cached data
 */

import { useCallback, useState, useEffect, useRef } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
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
): UseKundaliResult {
  const mode = normalizeZodiacMode(zodiacMode);
  const { user } = useAuth();
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

        // First, check if we have cached data in Firestore
        if (user) {
          const docRef = doc(db, "users", user.uid);
          const docSnap = await getDoc(docRef);
          if (!isCurrentRequest()) return;

          if (docSnap.exists()) {
            const data = docSnap.data();
            const cachedData =
              chartType === "D1"
                ? data.kundaliData
                : data[`kundaliData_${chartType}`];

            // A chart cached before the birth time was marked unknown still
            // carries a guessed Lagna — refetch the time-unknown shape.
            const timeShapeMatches =
              Boolean(requestBirthData.birthTimeUnknown) ===
              Boolean(cachedData?.timeUnknown);
            // Only use cached data if it has actual planetary positions
            if (
              timeShapeMatches &&
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
        const requestPayload = requestBirthData.coordinates
          ? {
              ...requestBirthData,
              lat: requestBirthData.coordinates.lat,
              lng: requestBirthData.coordinates.lng,
            }
          : requestBirthData;
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

        // Cache in Firestore for logged-in users
        if (user) {
          const docRef = doc(db, "users", user.uid);
          const cacheFieldName =
            chartType === "D1" ? "kundaliData" : `kundaliData_${chartType}`;
          // Sidereal signs only — a Western chart's signs are tropical.
          const profileSnap =
            chartType === "D1" && mode === "vedic"
              ? await getDoc(docRef).catch(() => null)
              : null;
          const profileData = profileSnap?.data()?.profile;
          const backfill = profileData?.dob
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
              },
              ...(backfill ? { profile: backfill } : {}),
            },
            { merge: true },
          );
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
