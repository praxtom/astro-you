import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sun, Moon, PenTool, Heart, Sparkles, Brain } from 'lucide-react';
import { AtmanData } from '../../types/user';
import { AtmanService } from '../../lib/atman';
import { DharmaList } from '../dharma/DharmaList';
import { KarmicJournal } from './KarmicJournal';
import { viewerDateKey } from "../../lib/viewer-timezone";
import { useDialog } from "../../hooks/useDialog";

interface DailyAltarProps {
    isOpen: boolean;
    onClose: () => void;
    userId: string;
    atmanState: AtmanData | undefined;
    onRefresh: () => void;
}

export const DailyAltar: React.FC<DailyAltarProps> = ({ 
    isOpen, 
    onClose, 
    userId, 
    atmanState, 
    onRefresh 
}) => {
    const [intention, setIntention] = useState('');
    const [gratitude, setGratitude] = useState('');
    const [activeTab, setActiveTab] = useState<'morning' | 'evening'>('morning');
    const [activeSection, setActiveSection] = useState<'practice' | 'journal'>('practice');

    // Reset state when opened or data changes
    useEffect(() => {
        if (atmanState) {
            const today = viewerDateKey();
            
            // Sync Intention
            if (atmanState.dailyIntentionDate === today && atmanState.dailyIntention) {
                setIntention(atmanState.dailyIntention);
            } else {
                setIntention('');
            }

            // Sync Gratitude
            if (atmanState.dailyGratitudeDate === today && atmanState.dailyGratitude) {
                setGratitude(atmanState.dailyGratitude);
            } else {
                setGratitude('');
            }
        }
    }, [atmanState, isOpen]);

    // Auto-set tab based on time of day
    useEffect(() => {
        const hour = new Date().getHours();
        setActiveTab(hour < 17 ? 'morning' : 'evening');
    }, []);

    const handleSaveIntention = async () => {
        if (!intention.trim()) return;
        await AtmanService.setDailyIntention(userId, intention);
        onRefresh();
    };

    const handleSaveGratitude = async () => {
        if (!gratitude.trim()) return;
        await AtmanService.setDailyGratitude(userId, gratitude);
        onRefresh();
    };

    const dialogRef = useRef<HTMLDivElement>(null);
    useDialog(dialogRef, onClose, isOpen);

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
            >
                <motion.div
                    ref={dialogRef}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="daily-altar-title"
                    initial={{ scale: 0.95, y: 20 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.95, y: 20 }}
                    className="bg-[#0A0A0F] border border-white/10 rounded-3xl w-full max-w-2xl h-[85dvh] flex flex-col relative overflow-hidden shadow-2xl"
                >
                    {/* Atmospheric Background */}
                    <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
                        <div className={`absolute top-0 left-0 w-full h-64 opacity-20 transition-colors duration-1000 ${activeTab === 'morning' ? 'bg-gradient-to-b from-amber-500/30' : 'bg-gradient-to-b from-indigo-900/40'}`} />
                        <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] bg-gold/5 rounded-full blur-[100px]" />
                    </div>

                    {/* Header */}
                    <div className="flex items-center justify-between gap-3 p-4 sm:p-6 border-b border-white/5 relative z-10">
                        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                            <div className="min-w-0">
                                <h2 id="daily-altar-title" className="text-2xl font-display text-gold tracking-wide">Daily Altar</h2>
                                <p className="text-xs text-white/55">Your daily check-in. Saves as you go.</p>
                            </div>
                            {/* Time of Day Toggle */}
                            <div className="flex p-1 bg-white/5 rounded-lg">
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('morning')}
                                    aria-label="Morning"
                                    title="Morning"
                                    aria-pressed={activeTab === 'morning'}
                                    className={`p-2 rounded-md transition-all ${activeTab === 'morning' ? 'bg-gold/20 text-gold' : 'text-white/60 hover:text-white'}`}
                                >
                                    <Sun size={18} aria-hidden="true" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('evening')}
                                    aria-label="Evening"
                                    title="Evening"
                                    aria-pressed={activeTab === 'evening'}
                                    className={`p-2 rounded-md transition-all ${activeTab === 'evening' ? 'bg-indigo-500/20 text-indigo-300' : 'text-white/60 hover:text-white'}`}
                                >
                                    <Moon size={18} aria-hidden="true" />
                                </button>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            aria-label="Close"
                            className="shrink-0 p-2 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                        >
                            <X size={24} aria-hidden="true" />
                        </button>
                    </div>

                    {/* Section Tabs */}
                    <div className="flex border-b border-white/5 relative z-10">
                        <button
                            type="button"
                            aria-pressed={activeSection === 'practice'}
                            onClick={() => setActiveSection('practice')}
                            className={`flex-1 p-3 text-sm font-medium transition-all ${activeSection === 'practice' ? 'text-gold border-b-2 border-gold' : 'text-white/60 hover:text-white'}`}
                        >
                            <Sparkles size={14} className="inline mr-2" aria-hidden="true" />
                            Practice
                        </button>
                        <button
                            type="button"
                            aria-pressed={activeSection === 'journal'}
                            onClick={() => setActiveSection('journal')}
                            className={`flex-1 p-3 text-sm font-medium transition-all ${activeSection === 'journal' ? 'text-violet-400 border-b-2 border-violet-400' : 'text-white/60 hover:text-white'}`}
                        >
                            <Brain size={14} className="inline mr-2" aria-hidden="true" />
                            Karmic Journal
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-8 relative z-10 custom-scrollbar">
                        
                        {activeSection === 'practice' ? (
                            <>
                                {/* 1. Sankalpa (Intention) */}
                                <section>
                                    <div className="flex items-center gap-2 mb-4 text-gold/80">
                                        <Sparkles size={18} aria-hidden="true" />
                                        <h3 id="altar-intention-label" className="text-sm font-semibold uppercase tracking-widest">Today&rsquo;s intention (Sankalpa)</h3>
                                    </div>
                                    <div className="relative group">
                                        <textarea
                                            aria-labelledby="altar-intention-label"
                                            value={intention}
                                            onChange={(e) => setIntention(e.target.value)}
                                            onBlur={handleSaveIntention}
                                            placeholder="Today, I want to focus on…"
                                            className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-base leading-relaxed text-white/90 focus:outline-none focus:border-gold/30 focus:bg-white/10 transition-all resize-none min-h-[100px] placeholder:text-white/50"
                                        />
                                        <div className="absolute bottom-3 right-3 text-white/30" aria-hidden="true">
                                            <PenTool size={14} />
                                        </div>
                                    </div>
                                </section>

                                {/* 2. Dharma (Routines) */}
                                <section>
                                    <DharmaList 
                                        routines={atmanState?.routines || []}
                                        userId={userId}
                                        onComplete={onRefresh}
                                    />
                                </section>

                                {/* 3. Gratitude (Evening Reflection) */}
                                <section>
                                    <div className="flex items-center gap-2 mb-4 text-indigo-300/80">
                                        <Heart size={18} aria-hidden="true" />
                                        <h3 id="altar-gratitude-label" className="text-sm font-semibold uppercase tracking-widest">Evening gratitude</h3>
                                    </div>
                                    <div className="relative">
                                        <textarea
                                            aria-labelledby="altar-gratitude-label"
                                            value={gratitude}
                                            onChange={(e) => setGratitude(e.target.value)}
                                            onBlur={handleSaveGratitude}
                                            disabled={activeTab === 'morning'}
                                            placeholder={activeTab === 'morning' ? "Tap the moon above to write this in the evening" : "I am grateful for..."}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-base leading-relaxed text-white/90 focus:outline-none focus:border-indigo-500/30 focus:bg-white/10 transition-all resize-none min-h-[100px] placeholder:text-white/50 disabled:cursor-not-allowed disabled:bg-white/[0.02] disabled:border-white/5"
                                        />
                                    </div>
                                </section>
                            </>
                        ) : (
                            /* Karmic Journal Section */
                            <KarmicJournal
                                userId={userId}
                                atmanState={atmanState}
                                onRefresh={onRefresh}
                            />
                        )}

                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};
