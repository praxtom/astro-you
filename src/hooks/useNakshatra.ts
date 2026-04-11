import { useState, useEffect } from 'react';

export interface NakshatraData {
    name: string;
    deity?: string;
    prediction?: string;
    ruler?: string;
    symbol?: string;
}

interface UseNakshatraResult {
    nakshatra: NakshatraData | null;
    loading: boolean;
    error: string | null;
}

export function useNakshatra(birthData: any): UseNakshatraResult {
    const [nakshatra, setNakshatra] = useState<NakshatraData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!birthData || !birthData.dob || !birthData.tob) {
            setLoading(false);
            return;
        }

        const controller = new AbortController();

        const fetchNakshatra = async () => {
            try {
                setLoading(true);
                setError(null);

                const response = await fetch('/api/kundali', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ birthData, chartType: 'NAKSHATRA' }),
                    signal: controller.signal,
                });

                if (!response.ok) throw new Error('Failed to fetch Nakshatra data');

                const result = await response.json();
                const data = result.data ?? result;

                setNakshatra({
                    name: data.name || data.nakshatra_name || data.nakshatra || 'Unknown',
                    deity: data.deity || data.devata || data.ruling_deity || undefined,
                    prediction: data.prediction || data.today_prediction || data.daily_prediction || data.interpretation || undefined,
                    ruler: data.ruler || data.ruling_planet || data.lord || undefined,
                    symbol: data.symbol || undefined,
                });
            } catch (err: any) {
                if (err.name === 'AbortError') return;
                console.error('[useNakshatra] Error:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchNakshatra();
        return () => controller.abort();
    }, [birthData?.dob, birthData?.tob, birthData?.pob]);

    return { nakshatra, loading, error };
}
