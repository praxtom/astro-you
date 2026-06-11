import React, { useMemo } from "react";
import type { PanchangData } from "../../hooks/usePanchang";
import type { UserProfile } from "../../types/user";
import { buildTodayGuide } from "../../lib/todayGuide";

interface TodayTriptychProps {
  atmanState: UserProfile["atman"] | undefined;
  panchang: PanchangData | null;
  panchangError: string | null;
  isSignedIn: boolean;
  onSaveIntention: () => void;
}

const PANELS = [
  { numeral: "I", label: "Energy", key: "energy" },
  { numeral: "II", label: "Do", key: "action" },
  { numeral: "III", label: "Take care", key: "caution" },
] as const;

/**
 * The day's guidance as a three-panel reading — Energy / Do / Take care —
 * derived from panchang timing and Atman's memory of the user.
 */
export const TodayTriptych: React.FC<TodayTriptychProps> = ({
  atmanState,
  panchang,
  panchangError,
  isSignedIn,
  onSaveIntention,
}) => {
  const guide = useMemo(
    () => buildTodayGuide(atmanState, panchang, panchangError, isSignedIn),
    [atmanState, panchang, panchangError, isSignedIn],
  );

  return (
    <section className="animate-reveal-progressive">
      <div className="flex items-end justify-between gap-4 mb-4">
        <div>
          <p className="text-gold/80 text-[0.6rem] font-bold uppercase tracking-[0.35em] mb-1.5">
            Today's Reading
          </p>
          <h2 className="font-display text-2xl md:text-3xl italic text-white/90">
            A guide for the day
          </h2>
        </div>
        <button
          onClick={onSaveIntention}
          className="shrink-0 px-4 py-2 rounded-xl border border-gold/30 text-gold text-[0.65rem] font-bold uppercase tracking-[0.2em] hover:bg-gold hover:text-black transition-colors"
        >
          Save intention
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 border-t border-l border-white/8">
        {PANELS.map((panel) => (
          <div
            key={panel.key}
            className="relative px-5 py-6 border-b border-r border-white/8"
          >
            <span className="absolute top-3 right-4 font-display italic text-3xl text-white/[0.07] select-none">
              {panel.numeral}
            </span>
            <p className="text-[0.6rem] font-bold uppercase tracking-[0.3em] text-white/30 mb-3">
              {panel.label}
            </p>
            <p className="text-sm text-white/75 leading-relaxed">
              {guide[panel.key]}
            </p>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 mt-3 px-1">
        <p className="text-xs text-white/40 italic">{guide.nudge}</p>
        <details className="text-xs text-white/30 sm:ml-auto">
          <summary className="cursor-pointer hover:text-white/55 transition-colors select-none">
            Why am I seeing this?
          </summary>
          <p className="mt-2 leading-relaxed max-w-prose">{guide.why}</p>
        </details>
      </div>
    </section>
  );
};
