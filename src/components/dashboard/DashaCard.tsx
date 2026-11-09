import { FactLabel, FactSkeleton } from './primitives';
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

    // "9 Jul 2029" — unambiguous, unlike the locale's 09/07/2029.
    const fmtDate = (dateStr: string) =>
        new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

    if (!hasBirthData) return null;

    if (loading) {
        return (
            <FactSkeleton />
        );
    }

    return (
        <div>
            <FactLabel>Current dasha</FactLabel>
            {!maha ? (
                <div className="mt-3"><PersonalCardNotice kind={errorKind ?? 'unavailable'} thing="current dasha" onRetry={onRetry} /></div>
            ) : (
                <div className="mt-2 space-y-3">
                    <div>
                        <p className="font-display text-[1.6rem] leading-snug text-white/92">
                            {maha.planet} <span className="text-white/55 text-base"><GlossaryTerm k="mahadasha">Mahadasha</GlossaryTerm></span>
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-white/55 text-[0.95rem]">until {fmtDate(maha.endDate)}</span>
                            <span className="text-gold/75 text-[0.95rem]">{timeLeft(maha.endDate)}</span>
                        </div>
                    </div>
                    {antar && (
                        <div>
                            <p className="font-display text-[1.3rem] leading-snug text-white/85">
                                {antar.planet} <span className="text-white/55 text-base"><GlossaryTerm k="antardasha">Antardasha</GlossaryTerm></span>
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-white/55 text-[0.95rem]">until {fmtDate(antar.endDate)}</span>
                                <span className="text-gold/75 text-[0.95rem]">{timeLeft(antar.endDate)}</span>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
