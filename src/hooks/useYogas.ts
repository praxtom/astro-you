import { useState, useEffect } from 'react';
import type { BirthData, Yoga } from '../types';

function normalizeStrength(val: any): 'strong' | 'moderate' | 'weak' | undefined {
    if (!val) return undefined;
    const s = String(val).toLowerCase();
    if (s === 'strong' || s === 'high' || s === 'powerful') return 'strong';
    if (s === 'moderate' || s === 'medium' || s === 'average') return 'moderate';
    if (s === 'weak' || s === 'low' || s === 'mild') return 'weak';
    return undefined;
}

interface UseYogasResult {
    yogas: Yoga[];
    loading: boolean;
    error: string | null;
}

export function useYogas(birthData: BirthData | null): UseYogasResult {
    const [yogas, setYogas] = useState<Yoga[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!birthData || !birthData.dob || !birthData.tob) {
            setLoading(false);
            return;
        }

        const controller = new AbortController();

        const fetchYogas = async () => {
            try {
                setLoading(true);
                setError(null);

                const response = await fetch('/api/kundali', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ birthData, chartType: 'YOGAS' }),
                    signal: controller.signal,
                });

                if (!response.ok) {
                    throw new Error('Failed to fetch yoga data');
                }

                const result = await response.json();
                const data = result.data ?? result;
                const rawYogas = data.yogas || data.yoga_analysis || data.yoga_results || data.results || (Array.isArray(data) ? data : []);

                const normalized = (Array.isArray(rawYogas) ? rawYogas : []).map((y: any) => ({
                    name: y.name || y.yoga_name || y.title || 'Unknown Yoga',
                    description: y.description || y.yoga_description || y.meaning || y.interpretation || '',
                    strength: normalizeStrength(y.strength || y.yoga_strength || y.power),
                    planets: Array.isArray(y.planets) ? y.planets : Array.isArray(y.planets_involved) ? y.planets_involved : [],
                    isAuspicious: y.isAuspicious ?? y.is_auspicious ?? y.auspicious ?? true,
                    category: y.category || y.yoga_category || undefined,
                    type: y.type || y.yoga_type || undefined,
                }));
                setYogas(normalized);
            } catch (err: any) {
                if (err.name === 'AbortError') return;
                console.error('[useYogas] Error:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchYogas();
        return () => controller.abort();
    }, [birthData?.dob, birthData?.tob, birthData?.pob]);

    return { yogas, loading, error };
}
