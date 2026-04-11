import { useState, useEffect } from 'react';

export interface LunarPhaseData {
    phase: string;
    illumination: number;
    emoji: string;
}

const PHASE_EMOJIS: Record<string, string> = {
    'new moon': '\u{1F311}',
    'waxing crescent': '\u{1F312}',
    'first quarter': '\u{1F313}',
    'waxing gibbous': '\u{1F314}',
    'full moon': '\u{1F315}',
    'waning gibbous': '\u{1F316}',
    'last quarter': '\u{1F317}',
    'third quarter': '\u{1F317}',
    'waning crescent': '\u{1F318}',
};

function getPhaseEmoji(phase: string): string {
    const lower = phase.toLowerCase();
    for (const [key, emoji] of Object.entries(PHASE_EMOJIS)) {
        if (lower.includes(key)) return emoji;
    }
    return '\u{1F315}';
}

interface UseLunarPhaseResult {
    lunar: LunarPhaseData | null;
    loading: boolean;
    error: string | null;
}

export function useLunarPhase(birthData: any): UseLunarPhaseResult {
    const [lunar, setLunar] = useState<LunarPhaseData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!birthData || !birthData.dob || !birthData.tob) {
            setLoading(false);
            return;
        }

        const controller = new AbortController();

        const fetchLunar = async () => {
            try {
                setLoading(true);
                setError(null);

                const response = await fetch('/api/kundali', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ birthData, chartType: 'LUNAR_PHASES' }),
                    signal: controller.signal,
                });

                if (!response.ok) throw new Error('Failed to fetch lunar phase');

                const result = await response.json();
                const data = result.data ?? result;

                const phase = data.phase || data.moon_phase || data.lunar_phase || data.current_phase || 'Unknown';
                const illumination = data.illumination ?? data.illumination_pct ?? data.percent ?? 0;

                setLunar({
                    phase,
                    illumination: typeof illumination === 'number' ? illumination : parseFloat(illumination) || 0,
                    emoji: getPhaseEmoji(phase),
                });
            } catch (err: any) {
                if (err.name === 'AbortError') return;
                console.error('[useLunarPhase] Error:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchLunar();
        return () => controller.abort();
    }, [birthData?.dob, birthData?.tob, birthData?.pob]);

    return { lunar, loading, error };
}
