import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Sun, Moon, Repeat, Clock } from 'lucide-react';
import { UserRoutine } from '../../types/user';
import { AtmanService } from '../../lib/atman';

interface DharmaListProps {
    routines: UserRoutine[];
    userId: string;
    onComplete?: () => void; // Callback to refresh data
}

export const DharmaList: React.FC<DharmaListProps> = ({ routines, userId, onComplete }) => {
    
    const handleComplete = async (routineId: string) => {
        await AtmanService.completeRoutine(userId, routineId);
        if (onComplete) onComplete();
    };

    if (!routines || routines.length === 0) {
        return (
            <div className="text-white/40 text-sm text-center py-4 italic">
                No active routines. Ask the Guru for a plan.
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <h3 className="text-gold font-display text-sm uppercase tracking-wider mb-4 border-b border-white/10 pb-2">
                Daily Dharma
            </h3>
            
            <AnimatePresence>
                {routines.map((routine) => {
                    const isCompletedToday = routine.lastCompletedAt && 
                        new Date(routine.lastCompletedAt).toDateString() === new Date().toDateString();

                    return (
                        <motion.div
                            key={routine.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, height: 0 }}
                            className={`
                                relative p-4 rounded-xl border transition-all duration-300
                                ${isCompletedToday 
                                    ? 'bg-gold/10 border-gold/30' 
                                    : 'bg-white/5 border-white/10 hover:border-gold/30 hover:bg-white/10'
                                }
                            `}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
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
                                    
                                    <div>
                                        <h4 className={`font-medium ${isCompletedToday ? 'text-gold line-through' : 'text-white'}`}>
                                            {routine.title}
                                        </h4>
                                        <div className="flex items-center gap-2 text-xs text-white/40 mt-1">
                                            <span className="flex items-center gap-1">
                                                <Clock size={10} /> {routine.durationMinutes}m
                                            </span>
                                            <span>•</span>
                                            <span className="text-gold/80">🔥 {routine.streak} day streak</span>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={() => !isCompletedToday && handleComplete(routine.id)}
                                    disabled={!!isCompletedToday}
                                    className={`
                                        w-8 h-8 rounded-full flex items-center justify-center transition-all
                                        ${isCompletedToday 
                                            ? 'bg-gold text-black scale-100' 
                                            : 'bg-white/10 text-white/20 hover:bg-gold/20 hover:text-gold hover:scale-110'
                                        }
                                    `}
                                >
                                    <Check size={16} />
                                </button>
                            </div>
                        </motion.div>
                    );
                })}
            </AnimatePresence>
        </div>
    );
};
