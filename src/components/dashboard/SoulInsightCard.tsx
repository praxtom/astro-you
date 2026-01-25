import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, TrendingUp, Zap, Heart, ArrowRight } from 'lucide-react';
import { AtmanData } from '../../types/user';

interface SoulInsightCardProps {
    atmanState: AtmanData | undefined;
    onOpenSadhanaPath: () => void;
}

/**
 * Dynamic card that surfaces one key brain insight per day on the Dashboard.
 * Prioritizes: Contradictions > Vibe Shifts > Sadhana Prompt
 */
export const SoulInsightCard: React.FC<SoulInsightCardProps> = ({ 
    atmanState, 
    onOpenSadhanaPath 
}) => {
    if (!atmanState) return null;

    // Priority 1: Growth Celebration (Contradictions)
    if (atmanState.contradictedPatterns && atmanState.contradictedPatterns.length > 0) {
        const latestGrowth = atmanState.contradictedPatterns[atmanState.contradictedPatterns.length - 1];
        return (
            <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 rounded-2xl border border-emerald-500/20 p-5 mb-8"
            >
                <div className="flex items-start gap-4">
                    <div className="p-2 rounded-xl bg-emerald-500/20">
                        <Sparkles size={20} className="text-emerald-400" />
                    </div>
                    <div className="flex-1">
                        <p className="text-[10px] uppercase tracking-widest text-emerald-400 font-bold mb-1">🎉 Soul Growth</p>
                        <p className="text-white/90 text-sm leading-relaxed">{latestGrowth}</p>
                    </div>
                </div>
            </motion.div>
        );
    }

    // Priority 2: Vibe Shift Detection
    if (atmanState.emotionalHistory && atmanState.emotionalHistory.length >= 3) {
        const recent = atmanState.emotionalHistory.slice(-3);
        const vibeChanged = recent[0].state !== recent[2].state;
        
        if (vibeChanged) {
            const fromState = recent[0].state;
            const toState = recent[2].state;
            return (
                <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-gradient-to-r from-violet-500/10 to-indigo-500/10 rounded-2xl border border-violet-500/20 p-5 mb-8"
                >
                    <div className="flex items-start gap-4">
                        <div className="p-2 rounded-xl bg-violet-500/20">
                            <TrendingUp size={20} className="text-violet-400" />
                        </div>
                        <div className="flex-1">
                            <p className="text-[10px] uppercase tracking-widest text-violet-400 font-bold mb-1">Vibe Shift</p>
                            <p className="text-white/90 text-sm leading-relaxed">
                                Your energy has shifted from <span className="text-violet-300 font-medium capitalize">{fromState}</span> to <span className="text-violet-300 font-medium capitalize">{toState}</span> over the past few sessions.
                            </p>
                        </div>
                    </div>
                </motion.div>
            );
        }
    }

    // Priority 3: Sadhana Path CTA (When unstable)
    const isUnstable = atmanState.emotionalState === 'anxious' || atmanState.emotionalState === 'chaotic' || atmanState.emotionalState === 'reactive';
    if (isUnstable) {
        return (
            <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-2xl border border-amber-500/20 p-5 mb-8"
            >
                <div className="flex items-start gap-4">
                    <div className="p-2 rounded-xl bg-amber-500/20">
                        <Zap size={20} className="text-amber-400" />
                    </div>
                    <div className="flex-1">
                        <p className="text-[10px] uppercase tracking-widest text-amber-400 font-bold mb-1">Soul Nudge</p>
                        <p className="text-white/90 text-sm leading-relaxed mb-3">
                            Your recent vibe suggests a moment of stillness might help. Would you like a personalized 3-day path?
                        </p>
                        <button 
                            onClick={onOpenSadhanaPath}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 rounded-lg text-amber-300 text-xs font-medium transition-colors"
                        >
                            Reveal My Path <ArrowRight size={14} />
                        </button>
                    </div>
                </div>
            </motion.div>
        );
    }

    // Priority 4: Gentle Affirmation (Stable state)
    if (atmanState.emotionalState === 'stable' || atmanState.emotionalState === 'spiritual') {
        return (
            <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-r from-sky-500/5 to-cyan-500/5 rounded-2xl border border-sky-500/10 p-5 mb-8"
            >
                <div className="flex items-start gap-4">
                    <div className="p-2 rounded-xl bg-sky-500/10">
                        <Heart size={20} className="text-sky-400" />
                    </div>
                    <div className="flex-1">
                        <p className="text-[10px] uppercase tracking-widest text-sky-400/60 font-bold mb-1">Soul State</p>
                        <p className="text-white/60 text-sm leading-relaxed italic">
                            Your energy is flowing with clarity. Continue walking your path with awareness.
                        </p>
                    </div>
                </div>
            </motion.div>
        );
    }

    return null;
};

export default SoulInsightCard;
