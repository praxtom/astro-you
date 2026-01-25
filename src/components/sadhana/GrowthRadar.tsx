import React from 'react';
import { motion } from 'framer-motion';
import { AtmanData } from '../../types/user';

interface GrowthRadarProps {
    atmanData: AtmanData;
    size?: number;
}

export const GrowthRadar: React.FC<GrowthRadarProps> = ({ atmanData, size = 300 }) => {
    // Calculate Scores (0-100)
    
    // 1. Groundedness: Routine consistency + Meditation streaks
    const routineCount = atmanData.routines?.length || 0;
    const avgStreak = atmanData.routines?.reduce((acc, r) => acc + r.streak, 0) || 0;
    const groundedness = Math.min(100, (routineCount * 10) + (avgStreak * 5) + (atmanData.meditationStreak * 2));

    // 2. Awareness: Pattern recognition weight
    const verifiedPatterns = atmanData.knownPatterns?.filter(p => p.verified).length || 0;
    const totalPatterns = atmanData.knownPatterns?.length || 1;
    const awareness = Math.min(100, (verifiedPatterns / totalPatterns) * 100 + (totalPatterns * 5));

    // 3. Harmony: Relationship dynamics (Supportive vs Conflict)
    const relationships = atmanData.keyRelationships || [];
    const supportiveRatio = relationships.filter(r => r.dynamic === 'supportive' || r.dynamic === 'teacher').length / (relationships.length || 1);
    const harmony = Math.min(100, supportiveRatio * 100);

    // 4. Intention: Intentions vs Gratitude consistency
    const hasIntention = atmanData.dailyIntention ? 50 : 0;
    const hasGratitude = atmanData.dailyGratitude ? 50 : 0;
    const intention = hasIntention + hasGratitude;

    const scores = [
        { label: 'Groundedness', value: groundedness },
        { label: 'Awareness', value: awareness },
        { label: 'Harmony', value: harmony },
        { label: 'Intention', value: intention }
    ];

    const center = size / 2;
    const radius = size * 0.4;
    
    // Convert scores to points
    const points = scores.map((s, i) => {
        const angle = (Math.PI * 2 * i) / scores.length - Math.PI / 2;
        const val = (s.value / 100) * radius;
        return {
            x: center + val * Math.cos(angle),
            y: center + val * Math.sin(angle)
        };
    });

    const pointsStr = points.map(p => `${p.x},${p.y}`).join(' ');

    return (
        <div className="relative flex flex-col items-center">
            <svg width={size} height={size} className="overflow-visible">
                {/* Background Circles */}
                {[0.2, 0.4, 0.6, 0.8, 1].map((p, i) => (
                    <circle
                        key={i}
                        cx={center}
                        cy={center}
                        r={radius * p}
                        fill="none"
                        stroke="rgba(255, 255, 255, 0.1)"
                        strokeDasharray="4 4"
                    />
                ))}

                {/* Axes */}
                {scores.map((_, i) => {
                    const angle = (Math.PI * 2 * i) / scores.length - Math.PI / 2;
                    return (
                        <line
                            key={i}
                            x1={center}
                            y1={center}
                            x2={center + radius * Math.cos(angle)}
                            y2={center + radius * Math.sin(angle)}
                            stroke="rgba(255, 255, 255, 0.2)"
                        />
                    );
                })}

                {/* Growth Polygon */}
                <motion.polygon
                    points={pointsStr}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    fill="rgba(147, 51, 234, 0.3)"
                    stroke="#9333ea"
                    strokeWidth="2"
                    className="drop-shadow-[0_0_8px_rgba(147,51,234,0.5)]"
                />

                {/* Labels */}
                {scores.map((s, i) => {
                    const angle = (Math.PI * 2 * i) / scores.length - Math.PI / 2;
                    const labelRadius = radius + 30;
                    return (
                        <text
                            key={i}
                            x={center + labelRadius * Math.cos(angle)}
                            y={center + labelRadius * Math.sin(angle)}
                            fill="rgba(255, 255, 255, 0.7)"
                            fontSize="10"
                            textAnchor="middle"
                            className="uppercase tracking-widest font-light"
                        >
                            {s.label}
                        </text>
                    );
                })}
            </svg>
            
            <div className="mt-4 grid grid-cols-2 gap-4 w-full px-6">
                {scores.map((s, i) => (
                    <div key={i} className="flex flex-col items-center">
                        <span className="text-[10px] text-zinc-500 uppercase">{s.label}</span>
                        <span className="text-xl font-display text-white">{s.value}%</span>
                    </div>
                ))}
            </div>
        </div>
    );
};
