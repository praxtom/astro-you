import { Clock } from 'lucide-react';
import { GlossaryTerm } from "../ui/GlossaryTerm";
import { PersonalCardNotice } from './PersonalCardNotice';
import type { DashaPeriodSummary } from '../../hooks/useDashaPeriods';
import type { PersonalDataErrorKind } from '../../lib/personal-data-error';

interface DashaCardProps {
    /** Shared result of the Dashboard's single useDashaPeriods call. */
    periods: DashaPeriodSummary[];
    loading: boolean;
    errorKind: PersonalDataErrorKind | null;
    onRetry?: () => void;
    hasBirthData: boolean;
}

export function DashaCard({ periods, loading, errorKind, onRetry, hasBirthData }: DashaCardProps) {
    const maha = periods.find(p => p.isCurrent) ?? null;
    const antar = maha?.subPeriods?.find(s => s.isCurrent) ?? null;

    const timeLeft = (dateStr: string) => {
        const diff = new Date(dateStr).getTime() - Date.now();
        if (diff <= 0) return 'ended';
        const days = Math.floor(diff / 86400000);
        if (days > 365) return `${Math.floor(days / 365)}y ${Math.floor((days % 365) / 30)}m left`;
        if (days > 30) return `${Math.floor(days / 30)}m ${days % 30}d left`;
        return `${days}d left`;
    };

    if (!hasBirthData) return null;

    if (loading) {
        return (
            <div className="bg-white/5 border border-white/10 rounded-[2rem] p-5 animate-pulse">
                <div className="h-4 bg-white/10 rounded w-28 mb-4" />
                <div className="h-3 bg-white/5 rounded w-40 mb-2" />
                <div className="h-3 bg-white/5 rounded w-36" />
            </div>
        );
    }

    return (
        <div className="bg-white/5 border border-white/10 rounded-[2rem] p-5">
            <div className="flex items-center gap-2 mb-4">
                <Clock size={16} className="text-gold" />
                <h4 className="text-sm font-bold uppercase tracking-widest text-gold">Current Dasha</h4>
            </div>
            {!maha ? (
                <PersonalCardNotice kind={errorKind ?? 'unavailable'} thing="current dasha" onRetry={onRetry} />
            ) : (
                <div className="space-y-3">
                    <div>
                        <p className="text-white/90 text-sm font-medium">
                            <GlossaryTerm k="mahadasha">Mahadasha</GlossaryTerm>: {maha.planet}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-white/40 text-xs">ends {new Date(maha.endDate).toLocaleDateString()}</span>
                            <span className="text-amber-400 text-xs">{timeLeft(maha.endDate)}</span>
                        </div>
                    </div>
                    {antar && (
                        <div>
                            <p className="text-white/90 text-sm font-medium">
                                <GlossaryTerm k="antardasha">Antardasha</GlossaryTerm>: {antar.planet}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-white/40 text-xs">ends {new Date(antar.endDate).toLocaleDateString()}</span>
                                <span className="text-amber-400 text-xs">{timeLeft(antar.endDate)}</span>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
