import React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Shield, Loader2, AlertCircle } from 'lucide-react';
import { useSadeSati } from '../../hooks/useSadeSati';

interface SadeSatiCardProps {
    birthData: any;
}

export const SadeSatiCard: React.FC<SadeSatiCardProps> = ({ birthData }) => {
    const { sadeSati, loading, error } = useSadeSati(birthData);

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
                    <span>Sade Sati data unavailable</span>
                </div>
            </motion.div>
        );
    }

    const isActive = sadeSati?.isActive ?? false;

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/5 border border-white/10 rounded-[2rem] p-6"
        >
            <div className="flex items-center gap-2 mb-4">
                <div className={`p-2 rounded-xl ${isActive ? 'bg-amber-500/10' : 'bg-emerald-500/10'}`}>
                    {isActive
                        ? <AlertTriangle size={18} className="text-amber-400" />
                        : <Shield size={18} className="text-emerald-400" />
                    }
                </div>
                <h3 className="text-sm font-semibold text-white/90 tracking-wide">Sade Sati</h3>
            </div>

            {isActive ? (
                <div className="space-y-2">
                    <p className="text-sm text-amber-400 font-medium capitalize">
                        {sadeSati?.phase ? `${sadeSati.phase} Phase` : 'Active'}
                    </p>
                    {(sadeSati?.startDate || sadeSati?.endDate) && (
                        <p className="text-xs text-white/40">
                            {sadeSati.startDate && `From ${sadeSati.startDate}`}
                            {sadeSati.startDate && sadeSati.endDate && ' — '}
                            {sadeSati.endDate && `Until ${sadeSati.endDate}`}
                        </p>
                    )}
                    {sadeSati?.remedies?.[0] && (
                        <div className="mt-3 pt-3 border-t border-white/5">
                            <p className="text-[10px] uppercase tracking-widest text-white/40 mb-1">Top Remedy</p>
                            <p className="text-sm text-white/70">{sadeSati.remedies[0]}</p>
                        </div>
                    )}
                </div>
            ) : (
                <p className="text-sm text-emerald-400/80">No active Sade Sati period</p>
            )}
        </motion.div>
    );
};

export default SadeSatiCard;
