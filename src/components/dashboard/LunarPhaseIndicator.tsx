import React from 'react';
import { useLunarPhase } from '../../hooks/useLunarPhase';

interface LunarPhaseIndicatorProps {
    birthData: any;
}

export const LunarPhaseIndicator: React.FC<LunarPhaseIndicatorProps> = ({ birthData }) => {
    const { lunar, loading, error } = useLunarPhase(birthData);

    if (loading || error || !lunar) return null;

    return (
        <div className="flex items-center gap-2 text-sm">
            <span className="text-lg leading-none">{lunar.emoji}</span>
            <span className="text-white/60">{lunar.phase}</span>
            <span className="text-white/30 text-xs">
                {Math.round(lunar.illumination)}%
            </span>
        </div>
    );
};

export default LunarPhaseIndicator;
