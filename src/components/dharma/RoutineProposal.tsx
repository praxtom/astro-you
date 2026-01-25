import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sun, Moon, Check, X, Clock, Repeat } from 'lucide-react';
import { UserRoutine } from '../../types/user';
import { AtmanService } from '../../lib/atman';

interface RoutineProposalProps {
    isOpen: boolean;
    routine: UserRoutine | null;
    userId: string;
    onClose: () => void;
    onAccepted: () => void;
}

export const RoutineProposal: React.FC<RoutineProposalProps> = ({
    isOpen,
    routine,
    userId,
    onClose,
    onAccepted
}) => {
    if (!isOpen || !routine) return null;

    const handleAccept = async () => {
        await AtmanService.addRoutine(userId, routine);
        onAccepted();
        onClose();
    };

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            >
                <motion.div
                    initial={{ scale: 0.9, y: 20 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.9, y: 20 }}
                    className="bg-[#0A0A0F] border border-gold/30 rounded-2xl p-8 max-w-md w-full shadow-2xl relative overflow-hidden"
                >
                    {/* Background Glow */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-gold/10 blur-[50px] rounded-full pointer-events-none" />

                    <div className="relative z-10 text-center">
                        <div className="w-16 h-16 mx-auto bg-gold/10 rounded-full flex items-center justify-center mb-6 text-gold">
                            {routine.type === 'morning' ? <Sun size={32} /> :
                                routine.type === 'evening' ? <Moon size={32} /> :
                                    <Repeat size={32} />}
                        </div>

                        <h2 className="text-2xl font-display text-gold mb-2">New Practice Suggested</h2>
                        <p className="text-white/60 text-sm mb-6">
                            Based on our conversation, the Guru suggests adding this to your daily Dharma.
                        </p>

                        <div className="bg-white/5 rounded-xl p-4 mb-8 text-left border border-white/5">
                            <h3 className="text-lg font-medium text-white mb-1">{routine.title}</h3>
                            <div className="flex items-center gap-4 text-xs text-white/40 mt-2">
                                <span className="flex items-center gap-1">
                                    <Clock size={12} /> {routine.durationMinutes} mins
                                </span>
                                <span className="capitalize border border-white/10 px-2 py-0.5 rounded-full">
                                    {routine.frequency}
                                </span>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={onClose}
                                className="flex-1 py-3 rounded-xl border border-white/10 text-white/60 hover:bg-white/5 hover:text-white transition-all flex items-center justify-center gap-2"
                            >
                                <X size={18} />
                                Dismiss
                            </button>
                            <button
                                onClick={handleAccept}
                                className="flex-1 py-3 rounded-xl bg-gold text-black font-medium hover:bg-gold/90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-gold/20"
                            >
                                <Check size={18} />
                                Accept Dharma
                            </button>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};
