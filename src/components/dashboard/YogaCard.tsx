import React, { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { useYogas } from '../../hooks/useYogas';
import type { BirthData, Yoga } from '../../types';

interface YogaCardProps {
    birthData: BirthData | null;
}

const strengthColor: Record<string, string> = {
    strong: 'bg-emerald-400/20 text-emerald-300',
    moderate: 'bg-amber-400/20 text-amber-300',
    weak: 'bg-white/10 text-white/50',
};

function StrengthBadge({ strength }: { strength?: Yoga['strength'] }) {
    if (!strength) return null;
    return (
        <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wide font-semibold ${strengthColor[strength] ?? strengthColor.weak}`}>
            {strength}
        </span>
    );
}

export const YogaCard: React.FC<YogaCardProps> = ({ birthData }) => {
    const { yogas, loading, error } = useYogas(birthData);
    const [expanded, setExpanded] = useState(false);

    const displayedYogas = expanded ? yogas : yogas.slice(0, 3);

    return (
        <div className="bg-white/5 border border-white/10 rounded-[2rem] p-6">
            {/* Header */}
            <div className="flex items-center gap-3 mb-5">
                <div className="p-2 rounded-xl bg-yellow-500/10">
                    <Sparkles size={20} className="text-gold" />
                </div>
                <h3 className="text-gold font-semibold tracking-wide text-sm uppercase">
                    Planetary Yogas
                </h3>
            </div>

            {/* Loading state */}
            {loading && (
                <div className="flex items-center justify-center py-8">
                    <Loader2 size={24} className="animate-spin text-white/30" />
                </div>
            )}

            {/* Error / empty state */}
            {!loading && (error || !yogas?.length) && (
                <p className="text-white/40 text-sm italic text-center py-6">
                    Chart analysis pending...
                </p>
            )}

            {/* Yoga list */}
            {!loading && yogas?.length > 0 && (
                <>
                    <ul className="space-y-4">
                        {displayedYogas.map((yoga, i) => (
                            <li key={yoga.name || i} className="border-b border-white/5 pb-3 last:border-0 last:pb-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-white font-medium text-sm">{yoga.name}</span>
                                    <StrengthBadge strength={yoga.strength} />
                                    {(yoga.category || yoga.type) && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/30 ml-2">{yoga.category || yoga.type}</span>
                                    )}
                                    {yoga.isAuspicious && (
                                        <span className="text-emerald-400 text-xs">&#x2726;</span>
                                    )}
                                </div>
                                <p className="text-white/50 text-xs leading-relaxed line-clamp-2">
                                    {yoga.description}
                                </p>
                                {yoga.planets?.length > 0 && (
                                    <p className="text-white/30 text-[10px] mt-1">
                                        {yoga.planets.join(' \u00b7 ')}
                                    </p>
                                )}
                            </li>
                        ))}
                    </ul>
                    {yogas.length > 3 && (
                        <button
                            onClick={() => setExpanded(!expanded)}
                            className="w-full mt-3 py-2 text-[10px] text-white/30 hover:text-gold uppercase tracking-widest transition-colors"
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
