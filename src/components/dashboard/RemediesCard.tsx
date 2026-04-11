import React, { useState } from 'react';
import { Gem, Loader2, Moon, Flame, HandHeart, Plus, Check } from 'lucide-react';
import { useRemedies, type Remedy } from '../../hooks/useRemedies';
import { useAuth } from '../../lib/AuthContext';
import { AtmanService } from '../../lib/atman';
import { useToast } from '../ui/Toast';
import type { BirthData } from '../../types';

interface RemediesCardProps {
    birthData: BirthData | null;
}

const categoryConfig: Record<string, { icon: React.ReactNode; color: string }> = {
    Gemstone:  { icon: <Gem size={14} />,       color: 'bg-purple-500/20 text-purple-300' },
    Mantra:    { icon: <Flame size={14} />,      color: 'bg-amber-500/20 text-amber-300' },
    Fast:      { icon: <Moon size={14} />,       color: 'bg-sky-500/20 text-sky-300' },
    Ritual:    { icon: <HandHeart size={14} />,  color: 'bg-emerald-500/20 text-emerald-300' },
    Donation:  { icon: <HandHeart size={14} />,  color: 'bg-rose-500/20 text-rose-300' },
};

const REMEDY_ROUTINE_MAP: Record<string, { type: 'morning' | 'evening' | 'meditation' | 'exercise'; durationMinutes: number }> = {
    Mantra:   { type: 'meditation', durationMinutes: 10 },
    Fast:     { type: 'morning',    durationMinutes: 0  },
    Ritual:   { type: 'evening',    durationMinutes: 15 },
    Donation: { type: 'morning',    durationMinutes: 5  },
};

function canBeRoutine(category: string): boolean {
    return Object.keys(REMEDY_ROUTINE_MAP).some(k => category.toLowerCase().includes(k.toLowerCase()));
}

function getRoutineConfig(category: string) {
    const key = Object.keys(REMEDY_ROUTINE_MAP).find(k => category.toLowerCase().includes(k.toLowerCase()));
    return key ? REMEDY_ROUTINE_MAP[key] : null;
}

function getCategoryStyle(category: string) {
    const key = Object.keys(categoryConfig).find(k =>
        category.toLowerCase().includes(k.toLowerCase())
    );
    return categoryConfig[key ?? ''] ?? categoryConfig.Ritual;
}

interface RemedyItemProps {
    remedy: Remedy;
    onAddRoutine: (remedy: Remedy) => void;
    addedRoutines: Set<string>;
}

function RemedyItem({ remedy, onAddRoutine, addedRoutines }: RemedyItemProps) {
    const style = getCategoryStyle(remedy.category);
    const showButton = canBeRoutine(remedy.category);
    const isAdded = addedRoutines.has(remedy.name);

    return (
        <div className="group flex items-start gap-3 py-2">
            <span className={`mt-0.5 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${style.color}`}>
                {style.icon}
                {remedy.category}
            </span>
            <div className="flex-1 min-w-0">
                <p className="text-white/90 text-sm font-medium truncate">{remedy.name}</p>
                <p className="text-white/50 text-xs leading-relaxed">{remedy.detail}</p>
            </div>
            {showButton && (
                <button
                    onClick={() => !isAdded && onAddRoutine(remedy)}
                    disabled={isAdded}
                    title={isAdded ? 'Added to daily sadhana' : 'Add to daily routine'}
                    className={`
                        mt-0.5 flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full
                        transition-all duration-200
                        ${isAdded
                            ? 'bg-emerald-500/20 text-emerald-400 opacity-100'
                            : 'bg-white/5 text-white/40 hover:bg-amber-500/20 hover:text-amber-300 opacity-0 group-hover:opacity-100'
                        }
                    `}
                >
                    {isAdded ? <Check size={12} /> : <Plus size={12} />}
                </button>
            )}
        </div>
    );
}

export const RemediesCard: React.FC<RemediesCardProps> = ({ birthData }) => {
    const { remedies, loading, error } = useRemedies(birthData);
    const { user } = useAuth();
    const { addToast } = useToast();
    const [addedRoutines, setAddedRoutines] = useState<Set<string>>(new Set());
    const [expanded, setExpanded] = useState(false);

    const allRemedies: Remedy[] = (
        Array.isArray(remedies?.remedies) ? remedies.remedies
        : Array.isArray(remedies) ? (remedies as any)
        : []
    );
    const displayedRemedies = expanded ? allRemedies : allRemedies.slice(0, 3);

    async function handleAddRoutine(remedy: Remedy) {
        if (!user) return;

        const config = getRoutineConfig(remedy.category);
        if (!config) return;

        const result = await AtmanService.addRoutine(user.uid, {
            title: remedy.name,
            type: config.type,
            durationMinutes: config.durationMinutes,
            frequency: 'daily',
            description: remedy.detail,
        });

        if (result) {
            setAddedRoutines(prev => new Set(prev).add(remedy.name));
            addToast({
                type: 'success',
                title: 'Added to Sadhana',
                message: `'${remedy.name}' is now part of your daily sadhana.`,
                duration: 4000,
            });
        }
    }

    return (
        <div className="bg-white/5 border border-white/10 rounded-[2rem] p-5">
            <div className="flex items-center gap-2 mb-4">
                <div className="p-2 rounded-xl bg-yellow-500/10">
                    <Gem size={18} className="text-gold" />
                </div>
                <h3 className="text-gold text-sm font-bold tracking-wide uppercase">
                    Your Remedies
                </h3>
            </div>

            {loading && (
                <div className="flex items-center justify-center py-6 gap-2 text-white/40 text-sm">
                    <Loader2 size={16} className="animate-spin" />
                    Calculating remedies...
                </div>
            )}

            {!loading && (error || allRemedies.length === 0) && (
                <p className="text-white/40 text-sm text-center py-6">
                    Calculating remedies...
                </p>
            )}

            {!loading && displayedRemedies.length > 0 && (
                <>
                    <div className="divide-y divide-white/5">
                        {displayedRemedies.map((remedy, i) => (
                            <RemedyItem
                                key={i}
                                remedy={remedy}
                                onAddRoutine={handleAddRoutine}
                                addedRoutines={addedRoutines}
                            />
                        ))}
                    </div>
                    {allRemedies.length > 3 && (
                        <button
                            onClick={() => setExpanded(!expanded)}
                            className="w-full mt-3 py-2 text-[10px] text-white/30 hover:text-gold uppercase tracking-widest transition-colors"
                        >
                            {expanded ? 'Show less' : `View all ${allRemedies.length} remedies`}
                        </button>
                    )}
                </>
            )}
        </div>
    );
};

export default RemediesCard;
