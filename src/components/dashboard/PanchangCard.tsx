import React from 'react';
import { motion } from 'framer-motion';
import { Sun, Sunrise, Loader2, AlertCircle } from 'lucide-react';
import { usePanchang } from '../../hooks/usePanchang';

interface PanchangItemProps {
    label: string;
    value?: string;
    subtext?: string;
}

const PanchangItem: React.FC<PanchangItemProps> = ({ label, value, subtext }) => (
    <div className="space-y-0.5">
        <p className="text-[10px] uppercase tracking-widest text-white/40 font-medium">{label}</p>
        <p className="text-sm text-white/80 truncate">{value || '—'}</p>
        {subtext && <p className="text-[10px] text-white/30">{subtext}</p>}
    </div>
);

export const PanchangCard: React.FC = () => {
    const { panchang, loading, error } = usePanchang();

    if (loading) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass rounded-[2rem] border border-white/10 p-6 flex items-center justify-center min-h-[160px]"
            >
                <Loader2 size={20} className="text-gold animate-spin" />
            </motion.div>
        );
    }

    if (error) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass rounded-[2rem] border border-white/10 p-6"
            >
                <div className="flex items-center gap-2 text-white/40 text-sm">
                    <AlertCircle size={16} />
                    <span>Panchang unavailable</span>
                </div>
            </motion.div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-[2rem] border border-white/10 p-6"
        >
            <div className="flex items-center gap-2 mb-4">
                <div className="p-2 rounded-xl bg-amber-500/10">
                    <Sun size={18} className="text-gold" />
                </div>
                <h3 className="text-sm font-semibold text-white/90 tracking-wide">
                    Today&apos;s Panchang
                </h3>
            </div>

            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                <PanchangItem label="Tithi" value={panchang?.tithi} subtext={panchang?.tithiEnd ? `until ${panchang.tithiEnd}` : undefined} />
                <PanchangItem label="Nakshatra" value={panchang?.nakshatra} subtext={panchang?.nakshatraEnd ? `until ${panchang.nakshatraEnd}` : undefined} />
                <PanchangItem label="Yoga" value={panchang?.yoga} />
                <PanchangItem label="Karana" value={panchang?.karana} />
                <PanchangItem label="Rahu Kaal" value={panchang?.rahu_kaal} />
            </div>

            {panchang?.sunrise && panchang.sunrise !== '—' && panchang?.sunset && panchang.sunset !== '—' && (
                <div className="mt-3 pt-3 border-t border-white/5 flex items-center gap-2">
                    <Sunrise size={14} className="text-gold/60 shrink-0" />
                    <p className="text-sm text-white/60">
                        {panchang.sunrise} · {panchang.sunset}
                    </p>
                </div>
            )}
        </motion.div>
    );
};

export default PanchangCard;
