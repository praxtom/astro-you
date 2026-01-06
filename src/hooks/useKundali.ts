/**
 * useKundali Hook - Centralized Kundali data access
 * Fetches from API if not cached, otherwise returns cached data
 */

import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import type { KundaliData, BirthData, PlanetaryPosition } from '../types';

interface UseKundaliResult {
    kundaliData: KundaliData | null;
    loading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
}

export type ChartType = 'D1' | 'D9' | 'D10';

export function useKundali(birthData: BirthData | null, chartType: ChartType = 'D1'): UseKundaliResult {
    const { user } = useAuth();
    const [kundaliData, setKundaliData] = useState<KundaliData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchKundali = async () => {
        console.log('[useKundali] fetchKundali called with:', { birthData, chartType, userId: user?.uid });

        if (!birthData || !birthData.dob || !birthData.tob) {
            console.log('[useKundali] Missing required fields, returning early:', {
                hasBirthData: !!birthData,
                dob: birthData?.dob,
                tob: birthData?.tob
            });
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError(null);

            // First, check if we have cached data in Firestore
            if (user) {
                const docRef = doc(db, 'users', user.uid);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const data = docSnap.data();
                    const cachedData = chartType === 'D1' ? data.kundaliData : data[`kundaliData_${chartType}`];

                    // Only use cached data if it has actual planetary positions
                    if (cachedData && cachedData.planetary_positions && cachedData.planetary_positions.length > 0) {
                        console.log('[useKundali] Using cached data with', cachedData.planetary_positions.length, 'planets');
                        setKundaliData(cachedData);
                        setLoading(false);
                        return;
                    } else {
                        console.log('[useKundali] Cached data is empty or invalid, will fetch from API');
                    }
                }
            }

            console.log('[useKundali] Fetching from API...');

            // Fetch from API if not cached
            const response = await fetch('/api/kundali', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ birthData, chartType }),
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch ${chartType} chart data`);
            }

            const data = await response.json();

            // Transform API response to our format
            const positions = data.planetary_positions || [];

            // Calculate Ketu from Rahu (Mean_Node) - Ketu is always exactly 180° opposite
            const rahuPos = positions.find((p: any) => p.name === 'Mean_Node');
            if (rahuPos && !positions.find((p: any) => p.name === 'Mean_South_Node')) {
                // Get opposite sign (6 signs away)
                const signOrder = ['Ari', 'Tau', 'Gem', 'Can', 'Leo', 'Vir', 'Lib', 'Sco', 'Sag', 'Cap', 'Aqu', 'Pis'];
                const rahuSignIdx = signOrder.indexOf(rahuPos.sign);
                const ketuSignIdx = (rahuSignIdx + 6) % 12; // 180° opposite
                const ketuHouse = ((rahuPos.house - 1 + 6) % 12) + 1; // Opposite house

                positions.push({
                    name: 'Mean_South_Node',
                    sign: signOrder[ketuSignIdx],
                    degree: rahuPos.degree, // Same degree as Rahu
                    house: ketuHouse,
                    is_retrograde: true, // Nodes are always retrograde
                    nakshatra: '' // Will be calculated if needed
                });
                console.log('[useKundali] Calculated Ketu position:', signOrder[ketuSignIdx], ketuHouse);
            }

            const kundali: KundaliData = {
                planetary_positions: positions,
                house_cusps: data.house_cusps || [],
                ascendant: data.ascendant || null
            };

            setKundaliData(kundali);

            // Cache in Firestore for logged-in users
            if (user) {
                const docRef = doc(db, 'users', user.uid);
                const cacheFieldName = chartType === 'D1' ? 'kundaliData' : `kundaliData_${chartType}`;
                await setDoc(docRef, { [cacheFieldName]: kundali }, { merge: true });
            }
        } catch (err: any) {
            console.error(`Error fetching ${chartType} Kundali:`, err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchKundali();
    }, [birthData?.dob, birthData?.tob, birthData?.pob, user?.uid, chartType]);

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
        return 'Planetary data currently veiled.';
    }

    return kundaliData.planetary_positions
        .map((p: PlanetaryPosition) => `${p.name} in ${p.sign} (${p.house}th House)${p.is_retrograde ? ' [Retrograde]' : ''}`)
        .join(', ');
}
