import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Loader2, AlertCircle } from 'lucide-react';

interface Festival {
    name: string;
    date: string;
    significance?: string;
}

export const FestivalCard: React.FC = () => {
    const [festivals, setFestivals] = useState<Festival[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        const controller = new AbortController();

        const fetchFestivals = async () => {
            try {
                setLoading(true);
                const res = await fetch('/api/kundali', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ chartType: 'FESTIVALS' }),
                    signal: controller.signal,
                });
                if (!res.ok) throw new Error('Failed');
                const result = await res.json();
                const raw = result.data ?? result;
                const list: Festival[] = (Array.isArray(raw) ? raw : raw.festivals || raw.events || []).map((f: any) => ({
                    name: f.name || f.title || f.festival || '—',
                    date: f.date || f.start_date || f.startDate || '',
                    significance: f.significance || f.description || f.details || undefined,
                }));

                const today = new Date().toISOString().split('T')[0];
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
    }, []);

    if (loading) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white/5 border border-white/10 rounded-[2rem] p-6 flex items-center justify-center min-h-[120px]"
            >
                <Loader2 size={20} className="text-gold animate-spin" />
            </motion.div>
        );
    }

    if (error || festivals.length === 0) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white/5 border border-white/10 rounded-[2rem] p-6"
            >
                <div className="flex items-center gap-2 text-white/40 text-sm">
                    <AlertCircle size={16} />
                    <span>Festival calendar unavailable</span>
                </div>
            </motion.div>
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
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/5 border border-white/10 rounded-[2rem] p-6"
        >
            <div className="flex items-center gap-2 mb-4">
                <div className="p-2 rounded-xl bg-violet-500/10">
                    <Calendar size={18} className="text-violet-400" />
                </div>
                <h3 className="text-sm font-semibold text-white/90 tracking-wide">
                    Upcoming Festivals
                </h3>
            </div>

            <div className="space-y-3">
                {festivals.map((f, i) => (
                    <div key={i} className="flex items-start gap-3">
                        <span className="text-xs text-white/40 font-medium min-w-[48px] pt-0.5">
                            {formatDate(f.date)}
                        </span>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm text-white/80 truncate">{f.name}</p>
                            {f.significance && (
                                <p className="text-[10px] text-white/30 truncate">{f.significance}</p>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </motion.div>
    );
};

export default FestivalCard;
