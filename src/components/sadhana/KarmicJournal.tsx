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
    History,
    PenTool
} from 'lucide-react';
import { AtmanData, UserLifeEvent, WeightedPattern } from '../../types/user';
import { AtmanService, AtmanMemoryControls } from '../../lib/atman';
import { postJson } from '../../lib/apiFetch';
import { InnerCircleManager } from './InnerCircleManager';
import { GrowthRadar } from './GrowthRadar';
import { useJournalEntries, JOURNAL_ENTRY_MAX_CHARS } from '../../hooks/useJournalEntries';

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

interface JournalInsight {
    id: string;
    type: 'pattern' | 'event';
    text: string;
    category?: UserLifeEvent['category'];
}

function extractJournalInsights(text: string): JournalInsight[] {
    const trimmed = text.trim();
    if (!trimmed) return [];
    const lower = trimmed.toLowerCase();
    const firstSentence = trimmed.split(/[.!?]/)[0]?.slice(0, 120) || trimmed.slice(0, 120);
    const insights: JournalInsight[] = [];

    if (/\b(always|again|keep|often|every time|recurring)\b/i.test(trimmed)) {
        insights.push({
            id: `pattern_${Date.now()}`,
            type: 'pattern',
            text: firstSentence,
        });
    }

    const eventCategory: UserLifeEvent['category'] =
        /job|career|interview|work|boss|business/i.test(lower) ? 'career' :
        /partner|friend|family|marriage|relationship/i.test(lower) ? 'relationship' :
        /money|payment|loan|invest|finance/i.test(lower) ? 'finance' :
        /health|sleep|doctor|body|anxiety/i.test(lower) ? 'health' :
        'spiritual';

    if (/\b(interview|meeting|deadline|argument|decision|exam|trip|appointment|call)\b/i.test(lower)) {
        insights.push({
            id: `event_${Date.now()}`,
            type: 'event',
            text: firstSentence,
            category: eventCategory,
        });
    }

    if (insights.length === 0) {
        insights.push({
            id: `pattern_${Date.now()}`,
            type: 'pattern',
            text: firstSentence,
        });
    }

    return insights;
}

/**
 * Sadhana Path Generator Internal Component
 */
const SadhanaPathGenerator: React.FC = () => {
    const [path, setPath] = useState<Array<{ day: number; practice: string; intention: string }> | null>(null);
    const [loading, setLoading] = useState(false);

    const generatePath = async () => {
        setLoading(true);
        try {
            const response = await postJson('/api/sadhana-path');
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
                    <p className="text-sm text-white/65 mb-3">A three-day plan with one simple practice and intention for each day.</p>
                    <button
                        type="button"
                        onClick={generatePath}
                        className="min-h-11 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-xs font-medium transition-colors shadow-lg shadow-violet-900/20"
                    >
                        Create my 3-day plan
                    </button>
                </div>
            )}

            {loading && (
                <div className="flex flex-col items-center py-8 gap-3">
                    <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-violet-500" />
                    <p className="text-[0.6875rem] text-violet-400 uppercase tracking-widest animate-pulse">Preparing your plan…</p>
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
                            <span className="text-[0.6875rem] font-bold text-violet-300 uppercase tracking-widest">Day {step.day}</span>
                            <p className="mt-1 text-sm text-white/90">{step.practice}</p>
                            {step.intention && (
                                <p className="mt-1 text-xs text-white/60">{step.intention}</p>
                            )}
                        </motion.div>
                    ))}
                    <button
                        type="button"
                        onClick={() => setPath(null)}
                        className="w-full min-h-11 py-2 text-[0.6875rem] text-violet-300/80 uppercase tracking-widest hover:text-violet-300 transition-colors"
                    >
                        Start over
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
    const [journalText, setJournalText] = useState('');
    const [journalInsights, setJournalInsights] = useState<JournalInsight[]>([]);
    const journal = useJournalEntries(userId);
    const [savingEntry, setSavingEntry] = useState(false);
    const [entrySaved, setEntrySaved] = useState(false);
    const [removingThread, setRemovingThread] = useState<string | null>(null);

    const handleRemoveThread = async (thread: string) => {
        setRemovingThread(thread);
        try {
            await AtmanMemoryControls.forgetItem(userId, { group: 'karmicThreads', text: thread });
            onRefresh();
        } catch (err) {
            console.error('[KarmicJournal] Failed to remove karmic thread:', err);
        } finally {
            setRemovingThread(null);
        }
    };

    if (!atmanState) {
        return (
            <div className="text-center text-white/55 py-8">
                <Brain size={32} className="mx-auto mb-3 opacity-50" aria-hidden="true" />
                <p className="text-sm">Your guide is still learning about you.</p>
                <p className="text-xs mt-1">As you chat, the patterns, people and life events you mention show up here for you to confirm or remove.</p>
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
        await AtmanService.updateLifeEventStatus(userId, eventId, status);
        onRefresh();
    };

    const handleSaveEntry = async () => {
        setSavingEntry(true);
        const ok = await journal.saveEntry(journalText);
        setSavingEntry(false);
        if (ok) {
            setJournalText('');
            setJournalInsights([]);
            setEntrySaved(true);
        }
    };

    const handleReviewJournal = () => {
        setJournalInsights(extractJournalInsights(journalText));
    };

    const updateInsightText = (id: string, text: string) => {
        setJournalInsights((items) =>
            items.map((item) => item.id === id ? { ...item, text } : item),
        );
    };

    const rejectInsight = (id: string) => {
        setJournalInsights((items) => items.filter((item) => item.id !== id));
    };

    const acceptInsight = async (insight: JournalInsight) => {
        if (!insight.text.trim()) return;
        if (insight.type === 'pattern') {
            await AtmanService.addPattern(userId, insight.text);
        } else {
            await AtmanService.addLifeEvent(userId, {
                title: insight.text,
                status: 'pending',
                category: insight.category || 'spiritual',
                confidence: 0.7,
                date: new Date(),
            });
        }
        rejectInsight(insight.id);
        setJournalText('');
        onRefresh();
    };

    const emotionalConfig = EMOTIONAL_STATES[atmanState.emotionalState] || EMOTIONAL_STATES.stable;

    return (
        <div className="space-y-4">
            {/* Header with Current State */}
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <h3 className="text-gold text-sm font-semibold uppercase tracking-wider flex items-center gap-2">
                        <Brain size={16} aria-hidden="true" />
                        Karmic Journal
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-white/55">
                        Your private notes, plus the patterns your guide has noticed in your chats. Confirm, edit or remove anything.
                    </p>
                </div>
                {/* Only show a mood once the guide has actually read one from a
                    conversation; a default "Stable" on a new account is made up. */}
                {atmanState.emotionalHistory && atmanState.emotionalHistory.length > 0 && (
                    <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full bg-white/5 ${emotionalConfig.color}`}>
                        {emotionalConfig.icon}
                        {emotionalConfig.label}
                    </div>
                )}
            </div>

            {/* Consent-Based Journal Capture */}
            <div className="bg-white/5 rounded-2xl border border-white/10 p-4">
                <div className="flex items-center gap-2 text-gold mb-3">
                    <PenTool size={16} />
                    <h4 id="journal-entry-label" className="text-sm font-semibold uppercase tracking-widest">Journal entry</h4>
                </div>
                <textarea
                    aria-labelledby="journal-entry-label"
                    value={journalText}
                    maxLength={JOURNAL_ENTRY_MAX_CHARS}
                    onChange={(event) => { setJournalText(event.target.value); setEntrySaved(false); }}
                    placeholder="Write what happened, how you felt, or what you are noticing..."
                    className="w-full min-h-24 rounded-xl bg-black/20 border border-white/10 px-4 py-3 text-sm text-white/80 outline-none focus:border-gold/40 resize-none placeholder:text-white/50"
                />
                <div className="flex flex-col gap-3 mt-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs leading-relaxed text-white/60">
                        Save keeps the entry in your private journal. The guide only remembers a pattern if you accept it.
                    </p>
                    <div className="flex shrink-0 items-center gap-2">
                        <button
                            type="button"
                            onClick={handleReviewJournal}
                            disabled={journalText.trim().length < 12}
                            className="min-h-11 px-3 py-2 rounded-xl border border-white/15 text-white/70 text-xs font-bold uppercase tracking-widest disabled:opacity-40"
                        >
                            Notice Patterns
                        </button>
                        <button
                            type="button"
                            onClick={handleSaveEntry}
                            disabled={savingEntry || journalText.trim().length === 0}
                            className="min-h-11 px-3 py-2 rounded-xl bg-gold text-black text-xs font-bold uppercase tracking-widest disabled:opacity-40"
                        >
                            {savingEntry ? 'Saving…' : 'Save Entry'}
                        </button>
                    </div>
                </div>
                <div role="status" aria-live="polite">
                    {entrySaved && <p className="mt-2 text-xs text-emerald-400">Entry saved.</p>}
                    {journal.error && <p className="mt-2 text-xs text-amber-400">{journal.error}</p>}
                </div>
                {journal.entries.length > 0 && (
                    <div className="mt-4 space-y-2">
                        <p className="text-xs uppercase tracking-widest text-white/55">Your recent entries</p>
                        {journal.entries.slice(0, 5).map((entry) => (
                            <div key={entry.id} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                                <div className="flex items-center justify-between gap-3">
                                    <span className="text-xs text-white/55">
                                        {entry.createdAt
                                            ? entry.createdAt.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
                                            : 'Just now'}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => journal.deleteEntry(entry.id)}
                                        className="min-h-8 px-2 text-xs text-white/55 hover:text-white"
                                    >
                                        Delete
                                    </button>
                                </div>
                                <p className="mt-1 whitespace-pre-wrap text-sm text-white/80">{entry.text}</p>
                            </div>
                        ))}
                    </div>
                )}
                {journalInsights.length > 0 && (
                    <div className="mt-4 space-y-2">
                        <p className="text-xs uppercase tracking-widest text-white/55">
                            What I noticed about you
                        </p>
                        {journalInsights.map((insight) => (
                            <div key={insight.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                                <p className="text-[0.6875rem] uppercase tracking-widest text-white/55 mb-2">
                                    {insight.type === 'pattern' ? 'Pattern' : 'Life Event'}
                                </p>
                                <input
                                    aria-label={insight.type === 'pattern' ? 'Edit pattern' : 'Edit life event'}
                                    value={insight.text}
                                    onChange={(event) => updateInsightText(insight.id, event.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-gold/40"
                                />
                                <div className="flex justify-end gap-2 mt-3">
                                    <button
                                        type="button"
                                        onClick={() => rejectInsight(insight.id)}
                                        className="min-h-10 px-3 py-1.5 rounded-lg border border-white/10 text-white/60 text-xs"
                                    >
                                        Reject
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => acceptInsight(insight)}
                                        className="min-h-10 px-3 py-1.5 rounded-lg bg-gold text-black text-xs font-bold"
                                    >
                                        Accept
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Growth Radar (Soul Map) */}
            <div className="bg-white/5 rounded-2xl border border-white/10 p-6 backdrop-blur-xl">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h4 className="text-white font-medium text-sm">Your balance at a glance</h4>
                        <p className="text-xs text-white/55 mt-0.5">Four scores out of 100, built from your routines, the patterns you confirm, your people and today&rsquo;s intention.</p>
                    </div>
                </div>
                <GrowthRadar atmanData={atmanState} size={240} />
            </div>

            {/* Emotional Pulse (Last 7 states) */}
            {atmanState.emotionalHistory && atmanState.emotionalHistory.length > 0 && (
                <div className="bg-white/5 rounded-xl border border-white/10 p-4">
                    <div className="flex justify-between items-center mb-3">
                        <span className="text-[0.6875rem] text-white/55 uppercase tracking-widest font-medium">Your mood lately</span>
                        <span className="text-[0.6875rem] text-white/50 uppercase tracking-wide">Last 7 chats</span>
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
                    type="button"
                    aria-expanded={expandedSection === 'patterns'}
                    aria-controls="karmic-patterns"
                    onClick={() => toggleSection('patterns')}
                    className="w-full p-4 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
                >
                    <div className="flex items-center gap-2">
                        <Sparkles size={16} className="text-violet-400" />
                        <span className="text-white font-medium">Patterns noticed</span>
                        <span className="text-white/55 text-xs">
                            ({atmanState.knownPatterns?.length || 0})
                        </span>
                    </div>
                    {expandedSection === 'patterns' ? 
                        <ChevronUp size={16} className="text-white/55" aria-hidden="true" /> : 
                        <ChevronDown size={16} className="text-white/55" aria-hidden="true" />
                    }
                </button>
                
                <AnimatePresence>
                    {expandedSection === 'patterns' && (
                        <motion.div id="karmic-patterns"
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
                                        const isArchived = isWeighted ? patternObj.archived : false;

                                        return (
                                            <div
                                                key={isWeighted ? patternObj.id : idx}
                                                className={`p-3 border rounded-lg group transition-all ${
                                                    isArchived
                                                        ? 'bg-white/[0.02] border-white/5'
                                                        : isVerified
                                                            ? 'bg-emerald-500/5 border-emerald-500/20'
                                                            : 'bg-violet-500/5 border-violet-500/10'
                                                }`}
                                            >
                                                <div className="flex items-start justify-between gap-2 mb-2">
                                                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                                                        <span className={`text-sm ${isArchived ? 'text-white/50' : isVerified ? 'text-emerald-300' : 'text-white/80'}`}>
                                                            {patternText}
                                                        </span>
                                                        {isArchived && (
                                                            <span className="text-[0.6875rem] uppercase text-white/50">
                                                                Archived
                                                            </span>
                                                        )}
                                                        {isVerified && (
                                                            <div title="Verified by you">
                                                                <ShieldCheck size={12} className="text-emerald-400" />
                                                            </div>
                                                        )}
                                                    </div>
                                                    
                                                    <div className="flex shrink-0 gap-1 opacity-100 [@media(hover:hover)]:opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                                                        {isWeighted && !isVerified && (
                                                            <>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleDismissPattern(patternObj.id)}
                                                                    className="p-2 rounded hover:bg-red-500/20 text-red-400/70 hover:text-red-400"
                                                                    title="This doesn't describe me"
                                                                    aria-label="This doesn't describe me"
                                                                >
                                                                    <X size={14} />
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleVerifyPattern(patternObj.id)}
                                                                    className="p-2 rounded hover:bg-green-500/20 text-green-400/70 hover:text-green-400"
                                                                    title={isArchived ? "Bring this pattern back" : "Yes, this is accurate"}
                                                                    aria-label={isArchived ? "Bring this pattern back" : "Yes, this is accurate"}
                                                                >
                                                                    <Check size={14} />
                                                                </button>
                                                            </>
                                                        )}
                                                        {isWeighted && isVerified && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDismissPattern(patternObj.id)}
                                                                className="p-2 rounded hover:bg-white/5 text-white/50 hover:text-white/80"
                                                                title="Remove pattern"
                                                                aria-label="Remove pattern"
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
                                                        <span className="text-[0.6875rem] text-white/50 uppercase tracking-wide flex items-center gap-1">
                                                            <TrendingUp size={10} aria-hidden="true" />
                                                            How strongly it shows up
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })
                                ) : (
                                    <p className="text-white/55 text-sm text-center py-4">
                                        No patterns noticed yet. They appear as you chat and journal.
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
                    type="button"
                    aria-expanded={expandedSection === 'events'}
                    aria-controls="karmic-events"
                    onClick={() => toggleSection('events')}
                    className="w-full p-4 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
                >
                    <div className="flex items-center gap-2">
                        <Calendar size={16} className="text-blue-400" />
                        <span className="text-white font-medium">Life Events</span>
                        <span className="text-white/55 text-xs">
                            ({atmanState.activeEvents?.length || 0})
                        </span>
                    </div>
                    {expandedSection === 'events' ? 
                        <ChevronUp size={16} className="text-white/55" aria-hidden="true" /> : 
                        <ChevronDown size={16} className="text-white/55" aria-hidden="true" />
                    }
                </button>
                
                <AnimatePresence>
                    {expandedSection === 'events' && (
                        <motion.div id="karmic-events"
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
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex min-w-0 flex-wrap items-center gap-2">
                                                    <span className="font-medium">{event.title}</span>
                                                    {showAnniversaryBadge && (
                                                        <span className="text-[0.6875rem] px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30 font-bold uppercase tracking-wider">
                                                            Reflect · {daysSince} days ago
                                                        </span>
                                                    )}
                                                </div>
                                                <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full ${
                                                    event.status === 'pending' ? 'bg-amber-500/20 text-amber-300' :
                                                    event.status === 'completed' ? 'bg-green-500/20 text-green-300' :
                                                    'bg-red-500/20 text-red-300'
                                                }`}>
                                                    {event.status === 'pending' ? 'Upcoming' : event.status === 'completed' ? 'Happened' : "Didn't happen"}
                                                </span>
                                            </div>
                                            {event.status === 'pending' && (
                                                <div className="mt-2 flex gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleUpdateEventStatus(event.id, 'completed')}
                                                        className="min-h-9 text-xs px-3 py-1.5 rounded bg-green-500/20 text-green-300 hover:bg-green-500/30"
                                                    >
                                                        ✓ It happened
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleUpdateEventStatus(event.id, 'cancelled')}
                                                        className="min-h-9 text-xs px-3 py-1.5 rounded bg-red-500/20 text-red-300 hover:bg-red-500/30"
                                                    >
                                                        ✗ Didn&rsquo;t happen
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )})
                                ) : (
                                    <p className="text-white/55 text-sm text-center py-4">
                                        No life events yet. When you mention something coming up, like an interview or a move, it appears here so your guide can ask how it went.
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
                        type="button"
                        aria-expanded={expandedSection === 'evolution'}
                        aria-controls="karmic-evolution"
                        onClick={() => toggleSection('evolution')}
                        className="w-full p-4 flex items-center justify-between text-left hover:bg-emerald-500/10 transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <History size={16} className="text-emerald-400" />
                            <span className="text-emerald-300 font-medium">Growth & Evolution</span>
                            <span className="text-emerald-400/70 text-xs">
                                ({atmanState.contradictedPatterns.length})
                            </span>
                        </div>
                        {expandedSection === 'evolution' ? 
                            <ChevronUp size={16} className="text-emerald-400/70" aria-hidden="true" /> : 
                            <ChevronDown size={16} className="text-emerald-400/70" aria-hidden="true" />
                        }
                    </button>
                    
                    <AnimatePresence>
                        {expandedSection === 'evolution' && (
                            <motion.div id="karmic-evolution"
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="border-t border-emerald-500/10"
                            >
                                <div className="p-4 space-y-3">
                                    <p className="text-[0.6875rem] text-emerald-300/80 uppercase tracking-widest mb-1">Where you have outgrown an old pattern</p>
                                    {atmanState.contradictedPatterns.map((contradiction, idx) => (
                                        <div 
                                            key={idx}
                                            className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-sm text-emerald-100 italic"
                                        >
                                            “{contradiction}”
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
                    type="button"
                    aria-expanded={expandedSection === 'path'}
                    aria-controls="karmic-path"
                    onClick={() => toggleSection('path')}
                    className="w-full p-4 flex items-center justify-between text-left hover:bg-violet-500/10 transition-colors"
                >
                    <div className="flex items-center gap-2">
                        <TrendingUp size={16} className="text-violet-400" />
                        <span className="text-violet-300 font-medium">3-day practice plan</span>
                    </div>
                    {expandedSection === 'path' ? 
                        <ChevronUp size={16} className="text-violet-400/70" aria-hidden="true" /> : 
                        <ChevronDown size={16} className="text-violet-400/70" aria-hidden="true" />
                    }
                </button>
                
                <AnimatePresence>
                    {expandedSection === 'path' && (
                        <motion.div id="karmic-path"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="border-t border-violet-500/10"
                        >
                            <div className="p-4">
                                <SadhanaPathGenerator />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
	            </div>

	            {/* Recent Nudges Section */}
	            <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
	                <button
	                    type="button"
	                    aria-expanded={expandedSection === 'nudges'}
	                    aria-controls="karmic-nudges"
	                    onClick={() => toggleSection('nudges')}
	                    className="w-full p-4 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
	                >
	                    <div className="flex items-center gap-2">
	                        <History size={16} className="text-gold" />
	                        <span className="text-white font-medium">Check-ins from your guide</span>
	                        <span className="text-white/55 text-xs">
	                            ({atmanState.nudgeHistory?.length || 0})
	                        </span>
	                    </div>
	                    {expandedSection === 'nudges' ?
	                        <ChevronUp size={16} className="text-white/55" aria-hidden="true" /> :
	                        <ChevronDown size={16} className="text-white/55" aria-hidden="true" />
	                    }
	                </button>

	                <AnimatePresence>
	                    {expandedSection === 'nudges' && (
	                        <motion.div id="karmic-nudges"
	                            initial={{ height: 0, opacity: 0 }}
	                            animate={{ height: 'auto', opacity: 1 }}
	                            exit={{ height: 0, opacity: 0 }}
	                            className="border-t border-white/5"
	                        >
	                            <div className="p-4 space-y-2">
	                                {atmanState.nudgeHistory && atmanState.nudgeHistory.length > 0 ? (
	                                    atmanState.nudgeHistory.slice(-6).reverse().map((nudge, idx) => (
	                                        <div
	                                            key={`${nudge.triggerType}_${nudge.date}_${idx}`}
	                                            className="p-3 bg-white/[0.03] border border-white/10 rounded-lg"
	                                        >
	                                            <div className="flex items-center justify-between gap-3 mb-1">
	                                                <p className="text-sm text-white/85 font-medium">{nudge.title}</p>
	                                                <span className="text-[0.6875rem] text-white/50">
	                                                    {new Date(nudge.date).toLocaleDateString()}
	                                                </span>
	                                            </div>
	                                            <p className="text-sm text-white/55 leading-relaxed">{nudge.message}</p>
	                                        </div>
	                                    ))
	                                ) : (
	                                    <p className="text-white/55 text-sm text-center py-4">
	                                        No check-ins yet. Your guide sends one when something in your chart or your chats seems worth a word.
	                                    </p>
	                                )}
	                            </div>
	                        </motion.div>
	                    )}
	                </AnimatePresence>
	            </div>

	            {/* Relationships Section (The Sangha) */}
	            <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
                <button
                    type="button"
                    aria-expanded={expandedSection === 'relationships'}
                    aria-controls="karmic-relationships"
                    onClick={() => toggleSection('relationships')}
                    className="w-full p-4 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
                >
                    <div className="flex items-center gap-2">
                        <Users size={16} className="text-pink-400" />
                        <span className="text-white font-medium">Inner Circle</span>
                        <span className="text-white/55 text-xs">
                            ({atmanState.keyRelationships?.length || 0})
                        </span>
                    </div>
                    {expandedSection === 'relationships' ? 
                        <ChevronUp size={16} className="text-white/55" aria-hidden="true" /> : 
                        <ChevronDown size={16} className="text-white/55" aria-hidden="true" />
                    }
                </button>
                
                <AnimatePresence>
                    {expandedSection === 'relationships' && (
                        <motion.div id="karmic-relationships"
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
                        type="button"
                        aria-expanded={expandedSection === 'threads'}
                        aria-controls="karmic-threads"
                        onClick={() => toggleSection('threads')}
                        className="w-full p-4 flex items-center justify-between text-left hover:bg-violet-500/10 transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <Zap size={16} className="text-violet-400" />
                            <span className="text-violet-300 font-medium">Threads across your life</span>
                            <span className="text-violet-300/70 text-xs">
                                ({atmanState.karmicThreads.length})
                            </span>
                        </div>
                        {expandedSection === 'threads' ? 
                            <ChevronUp size={16} className="text-violet-400/70" aria-hidden="true" /> : 
                            <ChevronDown size={16} className="text-violet-400/70" aria-hidden="true" />
                        }
                    </button>
                    
                    <AnimatePresence>
                        {expandedSection === 'threads' && (
                            <motion.div id="karmic-threads"
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="border-t border-violet-500/10"
                            >
                                <div className="p-4 space-y-3">
                                    <p className="text-[0.6875rem] text-violet-300/80 uppercase tracking-widest mb-1">Links your guide sees between different parts of your life</p>
                                    {atmanState.karmicThreads.map((thread, idx) => (
                                        <div 
                                            key={`${idx}-${thread}`}
                                            className="flex items-start justify-between gap-2 p-3 bg-violet-500/10 border border-violet-500/20 rounded-lg text-sm text-violet-100 italic"
                                        >
                                            <span className="min-w-0">“{thread}”</span>
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveThread(thread)}
                                                disabled={removingThread !== null}
                                                aria-label="Remove this karmic thread"
                                                title="Remove"
                                                className="shrink-0 p-2 rounded-md not-italic text-violet-300/70 hover:text-red-300 disabled:opacity-40"
                                            >
                                                <X size={12} />
                                            </button>
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
                    <div className="text-xs text-white/55 uppercase tracking-wider">Days in a row of practice</div>
                </div>
                <div className="bg-white/5 rounded-xl border border-white/10 p-4 text-center">
                    <div className="text-2xl font-display text-violet-400 capitalize">
                        {atmanState.preferredPractice || 'Not yet known'}
                    </div>
                    <div className="text-xs text-white/55 uppercase tracking-wider">Practice you return to most</div>
                </div>
            </div>
        </div>
    );
};
