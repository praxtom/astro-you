import React, { useId, useState } from 'react';
import { Sparkle } from 'lucide-react';
import { TileHead } from './WeatherTiles';
import { FactSkeleton } from './primitives';
import { useYogas } from '../../hooks/useYogas';
import { PersonalCardNotice } from './PersonalCardNotice';
import type { BirthData, Yoga } from '../../types';

interface YogaCardProps {
    birthData: BirthData | null;
}

const strengthColor: Record<string, string> = {
    strong: 'text-emerald-300/80',
    moderate: 'text-amber-300/80',
    weak: 'text-white/55',
};

function StrengthBadge({ strength }: { strength?: Yoga['strength'] }) {
    if (!strength) return null;
    return (
        <span className={`text-[0.7rem] uppercase tracking-[0.18em] font-bold ${strengthColor[strength] ?? strengthColor.weak}`}>
            {strength}
        </span>
    );
}

export const YogaCard: React.FC<YogaCardProps> = ({ birthData }) => {
    const { yogas, loading, error, errorKind, retry } = useYogas(birthData);
    const [expanded, setExpanded] = useState(false);
    const listId = useId();

    const displayedYogas = expanded ? yogas : yogas.slice(0, 3);

    return (
        <div>
            <TileHead icon={<Sparkle />}>Yogas in your chart</TileHead>
            {loading && <FactSkeleton />}

            {/* Error / empty state */}
            {!loading && error && errorKind && (
                <div className="mt-3"><PersonalCardNotice kind={errorKind} thing="planetary yogas" onRetry={retry} /></div>
            )}
            {!loading && !error && !yogas?.length && (
                <p className="mt-2 text-[0.98rem] leading-relaxed text-white/50">
                    {birthData?.dob
                        ? 'No major yogas stand out in your chart — its strength lies in the balance of its placements.'
                        : 'Add your birth details to see the yogas in your chart.'}
                </p>
            )}

            {/* Yoga list */}
            {!loading && yogas?.length > 0 && (
                <>
                    <ul id={listId} className="mt-3 space-y-4">
                        {displayedYogas.map((yoga, i) => (
                            <li key={yoga.name || i} className="">
                                <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 mb-1">
                                    <span className="font-display text-[1.3rem] leading-snug text-white/90">{yoga.name}</span>
                                    <StrengthBadge strength={yoga.strength} />
                                    {(yoga.category || yoga.type) && (
                                        <span className="text-[0.85rem] text-white/50">{yoga.category || yoga.type}</span>
                                    )}
                                    {yoga.isAuspicious && (
                                        <span className="text-emerald-400 text-xs" aria-label="Auspicious" role="img">&#x2726;</span>
                                    )}
                                </div>
                                <p className="text-white/55 text-[0.98rem] leading-relaxed">
                                    {yoga.description}
                                </p>
                                {yoga.planets?.length > 0 && (
                                    <p className="text-white/50 text-[0.85rem] mt-1">
                                        {yoga.planets.join(' \u00b7 ')}
                                    </p>
                                )}
                            </li>
                        ))}
                    </ul>
                    {yogas.length > 3 && (
                        <button
                            type="button"
                            aria-expanded={expanded}
                            aria-controls={listId}
                            onClick={() => setExpanded(!expanded)}
                            className="mt-3 min-h-11 text-[0.85rem] font-semibold text-gold/85 hover:text-gold transition-colors"
                        >
                            {expanded ? 'Show less' : `View all ${yogas.length} yogas`}
                        </button>
                    )}
                </>
            )}
        </div>
    );
};

export default YogaCard;
