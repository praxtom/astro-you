import React, { useState, useEffect } from 'react';
import { postJson } from "../../lib/apiFetch";
import { FactLabel, FactSkeleton } from './primitives';
import { viewerDateKey } from "../../lib/viewer-timezone";
import { normalizeFestivalRegion, type FestivalRegion } from "../../lib/festival-regions";

interface Festival {
    name: string;
    date: string;
    significance?: string;
}

interface FestivalCardProps {
    region?: FestivalRegion;
}

export const FestivalCard: React.FC<FestivalCardProps> = ({ region }) => {
    const festivalRegion = normalizeFestivalRegion(region);
    const [festivals, setFestivals] = useState<Festival[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (festivalRegion === "off") {
            setLoading(false);
            return;
        }
        const controller = new AbortController();

        const fetchFestivals = async () => {
            try {
                setLoading(true);
                const res = await postJson("/api/kundali", { chartType: 'FESTIVALS', region: festivalRegion }, { signal: controller.signal });
                if (!res.ok) throw new Error('Failed');
                const result = await res.json();
                const raw = result.data ?? result;
                const list: Festival[] = (Array.isArray(raw) ? raw : raw.festivals || raw.events || []).map((f: any) => ({
                    name: f.name || f.title || f.festival || '—',
                    date: f.date || f.start_date || f.startDate || '',
                    significance: f.significance || f.description || f.details || undefined,
                }));

                const today = viewerDateKey();
                const upcoming = list
                    .filter((f) => f.date >= today)
                    .sort((a, b) => a.date.localeCompare(b.date))
                    .slice(0, 4);

                setFestivals(upcoming);
            } catch (err: any) {
                if (err.name === 'AbortError') return;
                console.error('[FestivalCard] Error:', err);
                setError(true);
            } finally {
                setLoading(false);
            }
        };

        fetchFestivals();
        return () => controller.abort();
    }, [festivalRegion]);

    // Hidden entirely when off — an empty festival card is worse than none.
    if (festivalRegion === "off") return null;

    if (loading) return <FactSkeleton />;

    if (error || festivals.length === 0) {
        return (
            <div>
                <FactLabel>Upcoming festivals</FactLabel>
                <p className="mt-2 text-[0.98rem] leading-relaxed text-white/50">
                    The festival calendar couldn't load right now. It will appear here once it does.
                </p>
            </div>
        );
    }

    const formatDate = (dateStr: string) => {
        try {
            const d = new Date(dateStr + 'T00:00:00');
            return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
        } catch {
            return dateStr;
        }
    };

    return (
        <div>
            <FactLabel>Upcoming festivals</FactLabel>
            <div className="mt-3 space-y-3">
                {festivals.map((f, i) => (
                    <div key={i} className="flex items-baseline gap-4">
                        <span className="text-[0.9rem] text-white/45 min-w-14 tabular-nums">
                            {formatDate(f.date)}
                        </span>
                        <div className="flex-1 min-w-0">
                            <p className="font-display text-[1.3rem] leading-snug text-white/85">{f.name}</p>
                            {f.significance && (
                                <p className="text-[0.92rem] leading-relaxed text-white/45">{f.significance}</p>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default FestivalCard;
