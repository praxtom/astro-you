import { useState, useEffect } from 'react';
import { postJson } from "../lib/apiFetch";
import { useRequestBirthData } from './useRequestBirthData';

export interface SadeSatiData {
    isActive: boolean;
    phase?: 'rising' | 'peak' | 'setting';
    startDate?: string;
    endDate?: string;
    remedies: string[];
}

interface UseSadeSatiResult {
    sadeSati: SadeSatiData | null;
    loading: boolean;
    error: string | null;
}

export function useSadeSati(birthData: any): UseSadeSatiResult {
    const [sadeSati, setSadeSati] = useState<SadeSatiData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const requestBirthData = useRequestBirthData(birthData);

    useEffect(() => {
        if (!requestBirthData?.dob || !requestBirthData.tob) {
            setLoading(false);
            return;
        }

        const controller = new AbortController();

        const fetchSadeSati = async () => {
            try {
                setLoading(true);
                setError(null);

                const response = await postJson("/api/kundali", { birthData: requestBirthData, chartType: 'SADE_SATI' }, { signal: controller.signal });

                if (!response.ok) throw new Error('Failed to fetch Sade Sati data');

                const result = await response.json();
                const data = result.data ?? result;

                const isActive = data.is_active ?? data.isActive ?? data.active ?? false;
                const phase = data.phase || data.current_phase || undefined;
                const remedies = data.remedies || data.remedy_list || [];

                setSadeSati({
                    isActive,
                    phase: phase?.toLowerCase() as SadeSatiData['phase'],
                    startDate: data.start_date || data.startDate || undefined,
                    endDate: data.end_date || data.endDate || undefined,
                    remedies: Array.isArray(remedies) ? remedies.map((r: any) => typeof r === 'string' ? r : r.name || r.title || '') : [],
                });
            } catch (err: any) {
                if (err.name === 'AbortError') return;
                console.error('[useSadeSati] Error:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchSadeSati();
        return () => controller.abort();
    }, [requestBirthData]);

    return { sadeSati, loading, error };
}
