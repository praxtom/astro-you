import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Brain, 
    Calendar, 
    Heart, 
    Sparkles, 
    Check, 
    X, 
    ChevronDown,
    ChevronUp,
    Users,
    Zap,
    ShieldCheck,
    TrendingUp,
    History
} from 'lucide-react';
import { AtmanData, UserLifeEvent, WeightedPattern } from '../../types/user';
import { AtmanService } from '../../lib/atman';
import { InnerCircleManager } from './InnerCircleManager';
import { GrowthRadar } from './GrowthRadar';

interface KarmicJournalProps {
    userId: string;
    atmanState: AtmanData | undefined;
    onRefresh: () => void;
}

// Emotional state display config
const EMOTIONAL_STATES: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
    stable: { color: 'text-emerald-400', icon: <Check size={14} />, label: 'Stable' },
    anxious: { color: 'text-amber-400', icon: <Zap size={14} />, label: 'Anxious' },
    chaotic: { color: 'text-red-400', icon: <Sparkles size={14} />, label: 'Chaotic' },
    depressive: { color: 'text-blue-400', icon: <Heart size={14} />, label: 'Low' },
    energetic: { color: 'text-orange-400', icon: <Zap size={14} />, label: 'Energetic' },
    spiritual: { color: 'text-violet-400', icon: <Sparkles size={14} />, label: 'Elevated' }
};

// Event category colors
const EVENT_COLORS: Record<string, string> = {
    career: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    relationship: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
    health: 'bg-green-500/20 text-green-300 border-green-500/30',
    finance: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    spiritual: 'bg-violet-500/20 text-violet-300 border-violet-500/30'
};

/**
 * Sadhana Path Generator Internal Component
 */
const SadhanaPathGenerator: React.FC<{ atmanState: AtmanData }> = ({ atmanState }) => {
    const [path, setPath] = useState<Array<{ day: number; practice: string; intention: string }> | null>(null);
    const [loading, setLoading] = useState(false);

    const generatePath = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/sadhana-path', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ atmanData: atmanState })
            });
            const data = await response.json();
            if (data.path) setPath(data.path);
        } catch (e) {
            console.error("Failed to generate sadhana path", e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-4">
            {!path && !loading && (
                <div className="text-center py-4">
                    <p className="text-xs text-white/40 mb-3 italic">"Align your energy with a 3-day spiritual map tailored to your soul's current vibration."</p>
                    <button
                        onClick={generatePath}
                        className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-xs font-medium transition-colors shadow-lg shadow-violet-900/20"
                    >
                        Reveal My Path
                    </button>
                </div>
            )}

            {loading && (
                <div className="flex flex-col items-center py-8 gap-3">
                    <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-violet-500" />
                    <p className="text-[10px] text-violet-400 uppercase tracking-widest animate-pulse">Consulting the Oracle...</p>
                </div>
            )}

            {path && (
                <div className="space-y-3">
                    {path.map((step, idx) => (
                        <motion.div 
                            initial={{ x: -10, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ delay: idx * 0.1 }}
                            key={idx} 
                            className="bg-violet-900/10 border border-violet-500/20 rounded-lg p-3"
                        >
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] font-bold text-violet-400 uppercase tracking-widest">Day {step.day}</span>
                                <span className="text-[10px] text-white/30 italic">{step.intention}</span>
                            </div>
                            <p className="text-sm text-white/90">{step.practice}</p>
                        </motion.div>
                    ))}
                    <button
                        onClick={() => setPath(null)}
                        className="w-full py-2 text-[10px] text-violet-400/40 uppercase tracking-widest hover:text-violet-400 transition-colors"
                    >
                        Reset Path
                    </button>
                </div>
            )}
        </div>
    );
};

export const KarmicJournal: React.FC<KarmicJournalProps> = ({ 
    userId, 
    atmanState, 
    onRefresh 
}) => {
    const [expandedSection, setExpandedSection] = useState<string | null>('patterns');

    if (!atmanState) {
        return (
            <div className="text-center text-white/40 py-8">
                <Brain size={32} className="mx-auto mb-3 opacity-50" />
                <p className="text-sm">The Guru is still learning about you...</p>
                <p className="text-xs mt-1">Chat more to build your Karmic profile.</p>
            </div>
        );
    }

    const toggleSection = (section: string) => {
        setExpandedSection(expandedSection === section ? null : section);
    };

    const handleDismissPattern = async (patternId: string) => {
        await AtmanService.dismissPattern(userId, patternId);
        onRefresh();
    };

    const handleVerifyPattern = async (patternId: string) => {
        await AtmanService.verifyPattern(userId, patternId);
        onRefresh();
    };

    const isWeightedPattern = (p: any): p is WeightedPattern => {
        return typeof p !== 'string' && 'id' in p;
    };

    const handleUpdateEventStatus = async (eventId: string, status: UserLifeEvent['status']) => {
        // TODO: Implement event status update in AtmanService
        console.log(`[KarmicJournal] User ${userId} updated event ${eventId} to ${status}`);
        onRefresh(); // Refresh after action
    };

    const emotionalConfig = EMOTIONAL_STATES[atmanState.emotionalState] || EMOTIONAL_STATES.stable;

    return (
        <div className="space-y-4">
            {/* Header with Current State */}
            <div className="flex items-center justify-between">
                <h3 className="text-gold font-display text-sm uppercase tracking-wider flex items-center gap-2">
                    <Brain size={16} />
                    Karmic Journal
                </h3>
                <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full bg-white/5 ${emotionalConfig.color}`}>
                    {emotionalConfig.icon}
                    {emotionalConfig.label}
                </div>
            </div>

            {/* Growth Radar (Soul Map) */}
            <div className="bg-white/5 rounded-2xl border border-white/10 p-6 backdrop-blur-xl">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h4 className="text-white font-medium text-sm">Spiritual Evolution</h4>
                        <p className="text-[10px] text-white/40 uppercase tracking-widest mt-0.5">Your Current Soul Map</p>
                    </div>
                </div>
                <GrowthRadar atmanData={atmanState} size={240} />
            </div>

            {/* Emotional Pulse (Last 7 states) */}
            {atmanState.emotionalHistory && atmanState.emotionalHistory.length > 0 && (
                <div className="bg-white/5 rounded-xl border border-white/10 p-4">
                    <div className="flex justify-between items-center mb-3">
                        <span className="text-[10px] text-white/40 uppercase tracking-widest font-medium">Emotional Pulse</span>
                        <span className="text-[10px] text-white/20 uppercase tracking-tighter">Last 7 Sessions</span>
                    </div>
                    <div className="flex items-center gap-2">
                        {atmanState.emotionalHistory.slice(-7).map((entry, idx) => {
                            const config = EMOTIONAL_STATES[entry.state] || EMOTIONAL_STATES.stable;
                            const isLast = idx === Math.min(6, atmanState.emotionalHistory!.slice(-7).length - 1);
                            
                            return (
                                <div key={idx} className="flex items-center flex-1">
                                    <motion.div 
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        className={`h-2 w-2 rounded-full ${config.color.replace('text-', 'bg-')} shadow-[0_0_8px] ${config.color.replace('text-', 'shadow-')}/20`}
                                        title={`${config.label} (${new Date(entry.date).toLocaleDateString()})`}
                                    />
                                    {!isLast && (
                                        <div className="flex-1 h-px bg-white/5 mx-1" />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Known Patterns Section */}
            <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
                <button
                    onClick={() => toggleSection('patterns')}
                    className="w-full p-4 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
                >
                    <div className="flex items-center gap-2">
                        <Sparkles size={16} className="text-violet-400" />
                        <span className="text-white font-medium">Known Patterns</span>
                        <span className="text-white/40 text-xs">
                            ({atmanState.knownPatterns?.length || 0})
                        </span>
                    </div>
                    {expandedSection === 'patterns' ? 
                        <ChevronUp size={16} className="text-white/40" /> : 
                        <ChevronDown size={16} className="text-white/40" />
                    }
                </button>
                
                <AnimatePresence>
                    {expandedSection === 'patterns' && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="border-t border-white/5"
                        >
                            <div className="p-4 space-y-2">
                                {atmanState.knownPatterns && atmanState.knownPatterns.length > 0 ? (
                                    atmanState.knownPatterns.map((patternObj, idx) => {
                                        const isWeighted = isWeightedPattern(patternObj);
                                        const patternText = isWeighted ? patternObj.pattern : patternObj;
                                        const isVerified = isWeighted ? patternObj.verified : false;
                                        const weightScore = isWeighted ? patternObj.weightScore : 1.0;
                                        
                                        return (
                                            <div 
                                                key={isWeighted ? patternObj.id : idx}
                                                className={`p-3 border rounded-lg group transition-all ${
                                                    isVerified 
                                                        ? 'bg-emerald-500/5 border-emerald-500/20' 
                                                        : 'bg-violet-500/5 border-violet-500/10'
                                                }`}
                                            >
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-sm ${isVerified ? 'text-emerald-300' : 'text-white/80'}`}>
                                                            {patternText}
                                                        </span>
                                                        {isVerified && (
                                                            <div title="Verified by you">
                                                                <ShieldCheck size={12} className="text-emerald-400" />
                                                            </div>
                                                        )}
                                                    </div>
                                                    
                                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        {isWeighted && !isVerified && (
                                                            <>
                                                                <button
                                                                    onClick={() => handleDismissPattern(patternObj.id)}
                                                                    className="p-1 rounded hover:bg-red-500/20 text-red-400/50 hover:text-red-400"
                                                                    title="This doesn't describe me"
                                                                >
                                                                    <X size={14} />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleVerifyPattern(patternObj.id)}
                                                                    className="p-1 rounded hover:bg-green-500/20 text-green-400/50 hover:text-green-400"
                                                                    title="Yes, this is accurate"
                                                                >
                                                                    <Check size={14} />
                                                                </button>
                                                            </>
                                                        )}
                                                        {isWeighted && isVerified && (
                                                            <button
                                                                onClick={() => handleDismissPattern(patternObj.id)}
                                                                className="p-1 rounded hover:bg-white/5 text-white/20 hover:text-white/40"
                                                                title="Remove pattern"
                                                            >
                                                                <X size={12} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Strength Indicator */}
                                                {isWeighted && (
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                                                            <motion.div 
                                                                initial={{ width: 0 }}
                                                                animate={{ width: `${(weightScore / 5) * 100}%` }}
                                                                className={`h-full ${isVerified ? 'bg-emerald-500/40' : 'bg-violet-500/40'}`}
                                                            />
                                                        </div>
                                                        <span className="text-[10px] text-white/20 uppercase tracking-tighter flex items-center gap-1">
                                                            <TrendingUp size={8} />
                                                            Strength
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })
                                ) : (
                                    <p className="text-white/40 text-sm text-center py-4">
                                        No patterns discovered yet. Keep chatting with the Guru.
                                    </p>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Active Life Events Section */}
            <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
                <button
                    onClick={() => toggleSection('events')}
                    className="w-full p-4 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
                >
                    <div className="flex items-center gap-2">
                        <Calendar size={16} className="text-blue-400" />
                        <span className="text-white font-medium">Life Events</span>
                        <span className="text-white/40 text-xs">
                            ({atmanState.activeEvents?.length || 0})
                        </span>
                    </div>
                    {expandedSection === 'events' ? 
                        <ChevronUp size={16} className="text-white/40" /> : 
                        <ChevronDown size={16} className="text-white/40" />
                    }
                </button>
                
                <AnimatePresence>
                    {expandedSection === 'events' && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="border-t border-white/5"
                        >
                            <div className="p-4 space-y-2">
                                {atmanState.activeEvents && atmanState.activeEvents.length > 0 ? (
                                    atmanState.activeEvents.map((event) => {
                                        // Calculate days since event
                                        let daysSince: number | null = null;
                                        if (event.status === 'completed' && event.date) {
                                            const eventDate = new Date(event.date);
                                            const now = new Date();
                                            daysSince = Math.floor((now.getTime() - eventDate.getTime()) / (1000 * 60 * 60 * 24));
                                        }
                                        const showAnniversaryBadge = daysSince === 7 || daysSince === 30;

                                        return (
                                        <div 
                                            key={event.id}
                                            className={`p-3 rounded-lg border ${EVENT_COLORS[event.category] || 'bg-white/5 border-white/10'}`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium">{event.title}</span>
                                                    {showAnniversaryBadge && (
                                                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30 font-bold uppercase tracking-wider">
                                                            Reflect: {daysSince}d
                                                        </span>
                                                    )}
                                                </div>
                                                <span className={`text-xs px-2 py-0.5 rounded-full ${
                                                    event.status === 'pending' ? 'bg-amber-500/20 text-amber-300' :
                                                    event.status === 'completed' ? 'bg-green-500/20 text-green-300' :
                                                    'bg-red-500/20 text-red-300'
                                                }`}>
                                                    {event.status}
                                                </span>
                                            </div>
                                            {event.status === 'pending' && (
                                                <div className="mt-2 flex gap-2">
                                                    <button
                                                        onClick={() => handleUpdateEventStatus(event.id, 'completed')}
                                                        className="text-xs px-2 py-1 rounded bg-green-500/20 text-green-300 hover:bg-green-500/30"
                                                    >
                                                        ✓ Completed
                                                    </button>
                                                    <button
                                                        onClick={() => handleUpdateEventStatus(event.id, 'cancelled')}
                                                        className="text-xs px-2 py-1 rounded bg-red-500/20 text-red-300 hover:bg-red-500/30"
                                                    >
                                                        ✗ Cancelled
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )})
                                ) : (
                                    <p className="text-white/40 text-sm text-center py-4">
                                        No active life events tracked.
                                    </p>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Growth & Evolution Section */}
            {atmanState.contradictedPatterns && atmanState.contradictedPatterns.length > 0 && (
                <div className="bg-emerald-500/5 rounded-xl border border-emerald-500/20 overflow-hidden">
                    <button
                        onClick={() => toggleSection('evolution')}
                        className="w-full p-4 flex items-center justify-between text-left hover:bg-emerald-500/10 transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <History size={16} className="text-emerald-400" />
                            <span className="text-emerald-300 font-medium">Growth & Evolution</span>
                            <span className="text-emerald-500/40 text-xs">
                                ({atmanState.contradictedPatterns.length})
                            </span>
                        </div>
                        {expandedSection === 'evolution' ? 
                            <ChevronUp size={16} className="text-emerald-400/40" /> : 
                            <ChevronDown size={16} className="text-emerald-400/40" />
                        }
                    </button>
                    
                    <AnimatePresence>
                        {expandedSection === 'evolution' && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="border-t border-emerald-500/10"
                            >
                                <div className="p-4 space-y-3">
                                    <p className="text-[10px] text-emerald-400/60 uppercase tracking-widest mb-1">Evidences of your transformation</p>
                                    {atmanState.contradictedPatterns.map((contradiction, idx) => (
                                        <div 
                                            key={idx}
                                            className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-sm text-emerald-100 italic"
                                        >
                                            " {contradiction} "
                                        </div>
                                    ))}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            )}

            {/* Your Sadhana Path Section */}
            <div className="bg-violet-500/5 rounded-xl border border-violet-500/20 overflow-hidden">
                <button
                    onClick={() => toggleSection('path')}
                    className="w-full p-4 flex items-center justify-between text-left hover:bg-violet-500/10 transition-colors"
                >
                    <div className="flex items-center gap-2">
                        <TrendingUp size={16} className="text-violet-400" />
                        <span className="text-violet-300 font-medium">Your Sadhana Path</span>
                    </div>
                    {expandedSection === 'path' ? 
                        <ChevronUp size={16} className="text-violet-400/40" /> : 
                        <ChevronDown size={16} className="text-violet-400/40" />
                    }
                </button>
                
                <AnimatePresence>
                    {expandedSection === 'path' && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="border-t border-violet-500/10"
                        >
                            <div className="p-4">
                                <SadhanaPathGenerator atmanState={atmanState} />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Relationships Section (The Sangha) */}
            <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
                <button
                    onClick={() => toggleSection('relationships')}
                    className="w-full p-4 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
                >
                    <div className="flex items-center gap-2">
                        <Users size={16} className="text-pink-400" />
                        <span className="text-white font-medium">The Sangha (Inner Circle)</span>
                        <span className="text-white/40 text-xs">
                            ({atmanState.keyRelationships?.length || 0})
                        </span>
                    </div>
                    {expandedSection === 'relationships' ? 
                        <ChevronUp size={16} className="text-white/40" /> : 
                        <ChevronDown size={16} className="text-white/40" />
                    }
                </button>
                
                <AnimatePresence>
                    {expandedSection === 'relationships' && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="border-t border-white/5"
                        >
                            <div className="p-4">
                                <InnerCircleManager
                                    userId={userId}
                                    keyRelationships={atmanState.keyRelationships || []}
                                    onRefresh={onRefresh}
                                />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Karmic Threads Section (NEW) */}
            {atmanState.karmicThreads && atmanState.karmicThreads.length > 0 && (
                <div className="bg-violet-500/5 rounded-xl border border-violet-500/20 overflow-hidden">
                    <button
                        onClick={() => toggleSection('threads')}
                        className="w-full p-4 flex items-center justify-between text-left hover:bg-violet-500/10 transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <Zap size={16} className="text-violet-400" />
                            <span className="text-violet-300 font-medium">Karmic Threads</span>
                            <span className="text-violet-500/40 text-xs">
                                ({atmanState.karmicThreads.length})
                            </span>
                        </div>
                        {expandedSection === 'threads' ? 
                            <ChevronUp size={16} className="text-violet-400/40" /> : 
                            <ChevronDown size={16} className="text-violet-400/40" />
                        }
                    </button>
                    
                    <AnimatePresence>
                        {expandedSection === 'threads' && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="border-t border-violet-500/10"
                            >
                                <div className="p-4 space-y-3">
                                    <p className="text-[10px] text-violet-400/60 uppercase tracking-widest mb-1">Connections across life domains</p>
                                    {atmanState.karmicThreads.map((thread, idx) => (
                                        <div 
                                            key={idx}
                                            className="p-3 bg-violet-500/10 border border-violet-500/20 rounded-lg text-sm text-violet-100 italic"
                                        >
                                            " {thread} "
                                        </div>
                                    ))}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            )}

            {/* Spiritual Practice Stats */}
            <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/5 rounded-xl border border-white/10 p-4 text-center">
                    <div className="text-2xl font-display text-gold">{atmanState.meditationStreak || 0}</div>
                    <div className="text-xs text-white/40 uppercase tracking-wider">Day Streak</div>
                </div>
                <div className="bg-white/5 rounded-xl border border-white/10 p-4 text-center">
                    <div className="text-2xl font-display text-violet-400 capitalize">
                        {atmanState.preferredPractice || 'Unknown'}
                    </div>
                    <div className="text-xs text-white/40 uppercase tracking-wider">Preferred Practice</div>
                </div>
            </div>
        </div>
    );
};
