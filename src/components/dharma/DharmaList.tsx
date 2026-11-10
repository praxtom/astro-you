import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Sun, Moon, Repeat, Clock, ChevronDown } from 'lucide-react';
import { UserRoutine } from '../../types/user';
import { AtmanService } from '../../lib/atman';

interface DharmaListProps {
    routines: UserRoutine[];
    userId: string;
    onComplete?: () => void;
}

export const DharmaList: React.FC<DharmaListProps> = ({ routines, userId, onComplete }) => {
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const handleComplete = async (routineId: string) => {
        await AtmanService.completeRoutine(userId, routineId);
        if (onComplete) onComplete();
    };

    if (!routines || routines.length === 0) {
        return (
            <div className="text-white/60 text-sm text-center py-4">
                No practices yet. When your guide suggests one in a chat, you can add it here and tick it off each day.
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <h3 className="mb-3 border-b border-white/10 pb-2 text-[0.6875rem] font-bold uppercase tracking-[0.28em] text-gold/70">
                Daily Practices
            </h3>

            <AnimatePresence>
                {routines.map((routine) => {
                    const isCompletedToday = routine.lastCompletedAt &&
                        new Date(routine.lastCompletedAt).toDateString() === new Date().toDateString();
                    const isExpanded = expandedId === routine.id;

                    return (
                        <motion.div
                            key={routine.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, height: 0 }}
                            className={`
                                relative rounded-xl border transition-all duration-300
                                ${isCompletedToday
                                    ? 'bg-gold/10 border-gold/30'
                                    : 'bg-white/5 border-white/10 hover:border-gold/30 hover:bg-white/10'
                                }
                            `}
                        >
                            <div className="p-4">
                                <div className="flex items-center justify-between">
                                    <button
                                        type="button"
                                        onClick={() => setExpandedId(isExpanded ? null : routine.id)}
                                        aria-expanded={isExpanded}
                                        aria-controls={`routine-details-${routine.id}`}
                                        className="flex items-center gap-3 flex-1 min-w-0 text-left"
                                    >
                                        <div className={`
                                            p-2 rounded-lg
                                            ${routine.type === 'morning' ? 'text-amber-300 bg-amber-500/10' :
                                                routine.type === 'evening' ? 'text-indigo-300 bg-indigo-500/10' :
                                                    'text-emerald-300 bg-emerald-500/10'}
                                        `}>
                                            {routine.type === 'morning' && <Sun size={18} />}
                                            {routine.type === 'evening' && <Moon size={18} />}
                                            {routine.type === 'habit' && <Repeat size={18} />}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <h4 className={`font-medium ${isCompletedToday ? 'text-gold line-through' : 'text-white'}`}>
                                                {routine.title}
                                            </h4>
                                            <div className="flex items-center gap-2 text-xs text-white/55 mt-1">
                                                <span className="flex items-center gap-1">
                                                    <Clock size={10} /> {routine.durationMinutes} min
                                                </span>
                                                <span>•</span>
                                                <span className="text-gold/80">{routine.streak} {routine.streak === 1 ? 'day' : 'days'} in a row</span>
                                            </div>
                                        </div>

                                        <ChevronDown
                                            size={14}
                                            className={`text-white/50 transition-transform duration-200 shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
                                        />
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => !isCompletedToday && handleComplete(routine.id)}
                                        disabled={!!isCompletedToday}
                                        aria-label={isCompletedToday ? `${routine.title}: done today` : `Mark ${routine.title} done for today`}
                                        className={`
                                            w-11 h-11 rounded-full flex items-center justify-center transition-all ml-3 shrink-0
                                            ${isCompletedToday
                                                ? 'bg-gold text-black scale-100'
                                                : 'bg-white/10 text-white/50 hover:bg-gold/20 hover:text-gold hover:scale-110'
                                            }
                                        `}
                                    >
                                        <Check size={16} />
                                    </button>
                                </div>
                            </div>

                            {/* Expandable instructions */}
                            <AnimatePresence>
                                {isExpanded && (routine.description || (routine.steps && routine.steps.length > 0)) && (
                                    <motion.div
                                        id={`routine-details-${routine.id}`}
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.2 }}
                                        className="overflow-hidden"
                                    >
                                        <div className="px-4 pb-4 pt-1 border-t border-white/5">
                                            {routine.description && (
                                                <p className="text-white/65 text-sm leading-relaxed mb-3">
                                                    {routine.description}
                                                </p>
                                            )}
                                            {routine.steps && routine.steps.length > 0 && (
                                                <div className="space-y-2">
                                                    {routine.steps.map((step, i) => (
                                                        <div key={i} className="flex gap-2 text-sm">
                                                            <span className="text-gold/70 font-medium shrink-0">{i + 1}.</span>
                                                            <span className="text-white/70">{step}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    );
                })}
            </AnimatePresence>
        </div>
    );
};
