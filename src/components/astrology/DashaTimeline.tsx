import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';

interface DashaPeriod {
  planet: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  subPeriods?: DashaPeriod[];
}

interface DashaTimelineProps {
  periods: DashaPeriod[];
}

const PLANET_COLORS: Record<string, string> = {
  Sun: '#F59E0B', Moon: '#E5E7EB', Mars: '#EF4444',
  Mercury: '#10B981', Jupiter: '#EAB308', Venus: '#EC4899',
  Saturn: '#6366F1', Rahu: '#8B5CF6', Ketu: '#78716C',
};

const PLANET_ABBR: Record<string, string> = {
  Sun: 'Su', Moon: 'Mo', Mars: 'Ma', Mercury: 'Me',
  Jupiter: 'Ju', Venus: 'Ve', Saturn: 'Sa', Rahu: 'Ra', Ketu: 'Ke',
};

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function pct(start: string, end: string, totalMs: number, originMs: number) {
  const s = new Date(start).getTime() - originMs;
  const e = new Date(end).getTime() - originMs;
  return { left: (s / totalMs) * 100, width: ((e - s) / totalMs) * 100 };
}

export function DashaTimeline({ periods }: DashaTimelineProps) {
  const [tooltip, setTooltip] = useState<{ text: string; x: number } | null>(null);

  const { originMs, totalMs, currentPeriod } = useMemo(() => {
    if (!periods.length) return { originMs: 0, totalMs: 1, currentPeriod: null };
    const o = new Date(periods[0].startDate).getTime();
    const t = new Date(periods[periods.length - 1].endDate).getTime() - o;
    return { originMs: o, totalMs: t, currentPeriod: periods.find(p => p.isCurrent) || null };
  }, [periods]);

  if (!periods.length) return null;

  const subPeriods = currentPeriod?.subPeriods || [];
  const subOrigin = subPeriods.length ? new Date(subPeriods[0].startDate).getTime() : 0;
  const subTotal = subPeriods.length
    ? new Date(subPeriods[subPeriods.length - 1].endDate).getTime() - subOrigin
    : 1;

  const renderBar = (items: DashaPeriod[], oMs: number, tMs: number, height: string, label?: string) => (
    <div className={`relative ${height} rounded-full overflow-hidden flex bg-white/5`}>
      {items.map((p, i) => {
        const { left, width } = pct(p.startDate, p.endDate, tMs, oMs);
        const color = PLANET_COLORS[p.planet] || '#9CA3AF';
        const abbr = label
          ? `${PLANET_ABBR[label] || label}/${PLANET_ABBR[p.planet] || p.planet}`
          : PLANET_ABBR[p.planet] || p.planet;
        return (
          <motion.div
            key={`${p.planet}-${i}`}
            className="absolute inset-y-0 flex items-center justify-center cursor-pointer select-none overflow-hidden"
            style={{
              left: `${left}%`, width: `${width}%`,
              backgroundColor: color,
              opacity: p.isCurrent ? 1 : 0.45,
              boxShadow: p.isCurrent ? `0 0 16px ${color}66` : 'none',
            }}
            whileHover={{ opacity: 1, scale: 1.02 }}
            onMouseEnter={(e) => {
              const rect = (e.target as HTMLElement).getBoundingClientRect();
              setTooltip({
                text: `${p.planet}${label ? ` (in ${label})` : ''}: ${fmt(p.startDate)} – ${fmt(p.endDate)}`,
                x: rect.left + rect.width / 2,
              });
            }}
            onMouseLeave={() => setTooltip(null)}
          >
            {width > 4 && (
              <span className="text-[10px] font-bold text-black/80 whitespace-nowrap">{abbr}</span>
            )}
            {p.isCurrent && (
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 flex flex-col items-center">
                <span className="text-[9px] font-bold text-gold tracking-wide">NOW</span>
                <span className="text-gold text-[10px] leading-none">▼</span>
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );

  return (
    <div className="bg-white/5 border border-white/10 rounded-[2rem] p-6 relative">
      <h4 className="text-sm font-bold uppercase tracking-widest text-gold mb-5">Dasha Timeline</h4>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 px-3 py-1.5 rounded-lg bg-black/90 border border-white/10 text-xs text-white/90 whitespace-nowrap pointer-events-none"
          style={{ left: tooltip.x, top: 'auto', transform: 'translate(-50%, -2.5rem)' }}
        >
          {tooltip.text}
        </div>
      )}

      {/* Mahadasha bar */}
      <div className="pt-5">
        {renderBar(periods, originMs, totalMs, 'h-8')}
        <div className="flex justify-between mt-1.5 text-[10px] text-white/30">
          <span>{fmt(periods[0].startDate)}</span>
          <span>{fmt(periods[periods.length - 1].endDate)}</span>
        </div>
      </div>

      {/* Antardasha sub-bar */}
      {subPeriods.length > 0 && currentPeriod && (
        <div className="mt-4 pt-3 border-t border-white/5">
          <p className="text-[11px] text-white/40 mb-2 uppercase tracking-wider">
            Antardashas in {currentPeriod.planet} Mahadasha
          </p>
          <div className="pt-4">
            {renderBar(subPeriods, subOrigin, subTotal, 'h-4', currentPeriod.planet)}
          </div>
        </div>
      )}
    </div>
  );
}
