import { useState, useEffect } from 'react';
import type { BirthData } from '../types';

export interface Remedy {
    category: string;
    name: string;
    detail: string;
    planet?: string;
}

export interface RemediesData {
    remedies: Remedy[];
    [key: string]: unknown;
}

interface UseRemediesResult {
    remedies: RemediesData | null;
    loading: boolean;
    error: string | null;
}

export function useRemedies(birthData: BirthData | null): UseRemediesResult {
    const [remedies, setRemedies] = useState<RemediesData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!birthData || !birthData.dob || !birthData.tob) {
            return;
        }

        const controller = new AbortController();

        const fetchRemedies = async () => {
            try {
                setLoading(true);
                setError(null);

                const response = await fetch('/api/kundali', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ birthData, chartType: 'REMEDIES' }),
                    signal: controller.signal,
                });

                if (!response.ok) {
                    throw new Error('Failed to fetch remedies');
                }

                const result = await response.json();
                const raw = result.data ?? result;

                // Handle multiple possible response structures
                const remedyArray = Array.isArray(raw.remedies) ? raw.remedies
                    : Array.isArray(raw.data?.remedies) ? raw.data.remedies
                    : Array.isArray(raw) ? raw
                    : [];

                const normalized = remedyArray.map((r: any) => ({
                    category: r.category || r.type || r.remedy_type || 'Ritual',
                    name: r.name || r.title || r.remedy_name || 'Unknown',
                    detail: r.detail || r.description || r.details || r.instructions || '',
                    planet: r.planet || r.related_planet || undefined,
                }));

                setRemedies({ remedies: normalized });
            } catch (err: any) {
                if (err.name === 'AbortError') return;
                console.error('[useRemedies] Error:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchRemedies();
        return () => controller.abort();
    }, [birthData?.dob, birthData?.tob, birthData?.pob]);

    return { remedies, loading, error };
}
