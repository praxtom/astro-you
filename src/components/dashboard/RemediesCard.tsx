import React, { useId, useState } from 'react';
import { TileHead } from './WeatherTiles';
import { Gem, Moon, Flame, HandHeart, Plus, Check, Leaf } from 'lucide-react';
import { FactSkeleton } from './primitives';
import { Link } from 'react-router-dom';
import { useRemedies, type Remedy } from '../../hooks/useRemedies';
import { PersonalCardNotice } from './PersonalCardNotice';
import { useAuth } from '../../lib/useAuth';
import { AtmanService } from '../../lib/atman';
import { useToast } from '../ui/toast-context';
import type { BirthData } from '../../types';

interface RemediesCardProps {
    birthData: BirthData | null;
}

const categoryConfig: Record<string, { icon: React.ReactNode; color: string }> = {
    Gemstone:  { icon: <Gem size={11} />,       color: 'bg-purple-500/20 text-purple-300/75' },
    Mantra:    { icon: <Flame size={11} />,      color: 'bg-amber-500/20 text-amber-300/75' },
    Fast:      { icon: <Moon size={11} />,       color: 'bg-sky-500/20 text-sky-300/75' },
    Ritual:    { icon: <HandHeart size={11} />,  color: 'bg-emerald-500/20 text-emerald-300/75' },
    Donation:  { icon: <HandHeart size={11} />,  color: 'bg-rose-500/20 text-rose-300/75' },
};

const REMEDY_ROUTINE_MAP: Record<string, { type: 'morning' | 'evening' | 'habit'; durationMinutes: number }> = {
    Mantra:   { type: 'habit',      durationMinutes: 10 },
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
    canAddRoutine: boolean;
}

function RemedyItem({ remedy, onAddRoutine, addedRoutines, canAddRoutine }: RemedyItemProps) {
    const style = getCategoryStyle(remedy.category);
    const showButton = canAddRoutine && canBeRoutine(remedy.category);
    const isAdded = addedRoutines.has(remedy.name);

    return (
        <div className="group flex items-start gap-3">
            <div className="flex-1 min-w-0">
                <p className={`flex items-center gap-1.5 text-[0.7rem] font-bold uppercase tracking-[0.18em] ${style.color.split(' ').filter(c => c.startsWith('text-')).join(' ')}`}>
                    {style.icon}
                    {remedy.category}
                </p>
                <p className="mt-1 font-display text-[1.3rem] leading-snug text-white/90">{remedy.name}</p>
                <p className="mt-0.5 text-white/50 text-[0.95rem] leading-relaxed">{remedy.detail}</p>
            </div>
            {showButton && (
                <button
                    type="button"
                    onClick={() => !isAdded && onAddRoutine(remedy)}
                    disabled={isAdded}
                    title={isAdded ? 'Added to daily sadhana' : 'Add to daily routine'}
                    aria-label={isAdded ? `${remedy.name} added to your daily sadhana` : `Add ${remedy.name} to your daily routine`}
                    className={`
                        flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-full
                        transition-all duration-200
                        ${isAdded
                            ? 'bg-emerald-500/20 text-emerald-400 opacity-100'
                            : 'bg-white/5 text-white/60 hover:bg-amber-500/20 hover:text-amber-300 md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100'
                        }
                    `}
                >
                    {isAdded ? <Check size={14} aria-hidden="true" /> : <Plus size={14} aria-hidden="true" />}
                </button>
            )}
        </div>
    );
}

const foundationalRemedies: Remedy[] = [
    {
        category: 'Mantra',
        name: 'One focused mantra cycle',
        detail: 'Choose one short mantra and repeat it with steady breath for ten minutes.',
    },
    {
        category: 'Ritual',
        name: 'Evening light practice',
        detail: 'Light a diya or candle, sit quietly, and name one action you will release today.',
    },
    {
        category: 'Donation',
        name: 'Small act of seva',
        detail: 'Offer food, time, or help without expecting anything back.',
    },
];

export const RemediesCard: React.FC<RemediesCardProps> = ({ birthData }) => {
    const { remedies, loading, error, errorKind, retry } = useRemedies(birthData);
    const { user } = useAuth();
    const { addToast } = useToast();
    const [addedRoutines, setAddedRoutines] = useState<Set<string>>(new Set());
    const [expanded, setExpanded] = useState(false);
    const listId = useId();

    const allRemedies: Remedy[] = (
        Array.isArray(remedies?.remedies) ? remedies.remedies
        : Array.isArray(remedies) ? (remedies as any)
        : []
    );
    const displayedRemedies = expanded ? allRemedies : allRemedies.slice(0, 3);
    const hasBirthProfile = Boolean(birthData?.dob && birthData?.tob);
    const showFoundation = !loading && (!hasBirthProfile || error || allRemedies.length === 0);

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
            steps: [remedy.detail],
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
        <div>
            <TileHead icon={<Leaf />}>{showFoundation ? 'Daily practice' : 'Your remedies'}</TileHead>

            {loading && (
                <div className="mt-3"><FactSkeleton /></div>
            )}

            {showFoundation && (
                <>
                    <div className="mt-3 space-y-4">
                        {foundationalRemedies.map((remedy) => (
                            <RemedyItem
                                key={remedy.name}
                                remedy={remedy}
                                onAddRoutine={handleAddRoutine}
                                addedRoutines={addedRoutines}
                                canAddRoutine={false}
                            />
                        ))}
                    </div>
                    {hasBirthProfile && error && errorKind ? (
                        <div className="mt-3">
                            <PersonalCardNotice kind={errorKind} thing="personal remedies" onRetry={retry} />
                        </div>
                    ) : (
                        <p className="mt-3 text-xs leading-relaxed text-white/50">
                            {hasBirthProfile
                                ? 'Your chart did not call for specific remedies right now — these daily practices suit every chart.'
                                : 'Add birth details to receive chart-specific remedies.'}
                        </p>
                    )}
                    <Link
                        to="/remedies"
                        className="mt-4 min-h-11 inline-flex items-center gap-1.5 text-[0.85rem] font-semibold text-gold/85 hover:text-gold transition-colors"
                    >
                        Open remedy studio
                    </Link>
                </>
            )}

            {!loading && displayedRemedies.length > 0 && (
                <>
                    <div id={listId} className="mt-3 space-y-4">
                        {displayedRemedies.map((remedy, i) => (
                            <RemedyItem
                                key={i}
                                remedy={remedy}
                                onAddRoutine={handleAddRoutine}
                                addedRoutines={addedRoutines}
                                canAddRoutine={Boolean(user)}
                            />
                        ))}
                    </div>
                    {allRemedies.length > 3 && (
                        <button
                            type="button"
                            aria-expanded={expanded}
                            aria-controls={listId}
                            onClick={() => setExpanded(!expanded)}
                            className="mt-3 block min-h-11 text-[0.85rem] font-semibold text-white/60 hover:text-gold transition-colors"
                        >
                            {expanded ? 'Show less' : `View all ${allRemedies.length} remedies`}
                        </button>
                    )}
                    <Link
                        to="/remedies"
                        className="mt-4 min-h-11 inline-flex items-center gap-1.5 text-[0.85rem] font-semibold text-gold/85 hover:text-gold transition-colors"
                    >
                        Open remedy studio
                    </Link>
                </>
            )}
        </div>
    );
};

export default RemediesCard;
