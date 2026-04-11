import React from 'react';
import { motion } from 'framer-motion';
import { Star, Loader2, AlertCircle } from 'lucide-react';
import { useNakshatra } from '../../hooks/useNakshatra';

interface NakshatraCardProps {
    birthData: any;
}

export const NakshatraCard: React.FC<NakshatraCardProps> = ({ birthData }) => {
    const { nakshatra, loading, error } = useNakshatra(birthData);

    if (loading) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white/5 border border-white/10 rounded-[2rem] p-6 flex items-center justify-center min-h-[140px]"
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
                className="bg-white/5 border border-white/10 rounded-[2rem] p-6"
            >
                <div className="flex items-center gap-2 text-white/40 text-sm">
                    <AlertCircle size={16} />
                    <span>Nakshatra data unavailable</span>
                </div>
            </motion.div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/5 border border-white/10 rounded-[2rem] p-6"
        >
            <div className="flex items-center gap-2 mb-4">
                <div className="p-2 rounded-xl bg-gold/10">
                    <Star size={18} className="text-gold" />
                </div>
                <h3 className="text-sm font-semibold text-gold tracking-wide">Birth Nakshatra</h3>
            </div>

            <p className="text-lg text-white/90 font-display">{nakshatra?.name}</p>

            {nakshatra?.deity && (
                <p className="text-xs text-white/40 mt-1">
                    Deity: <span className="text-white/60">{nakshatra.deity}</span>
                    {nakshatra.ruler && <> &middot; Ruler: <span className="text-white/60">{nakshatra.ruler}</span></>}
                </p>
            )}

            {nakshatra?.prediction && (
                <div className="mt-3 pt-3 border-t border-white/5">
                    <p className="text-[10px] uppercase tracking-widest text-white/40 mb-1">Today</p>
                    <p className="text-sm text-white/70 leading-relaxed line-clamp-3">{nakshatra.prediction}</p>
                </div>
            )}
        </motion.div>
    );
};

export default NakshatraCard;
