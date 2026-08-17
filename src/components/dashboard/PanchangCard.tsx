import React from "react";
import { motion } from "framer-motion";
import { Sun, Sunrise, Loader2 } from "lucide-react";
import type { PanchangData } from "../../hooks/usePanchang";
import { GlossaryTerm } from "../ui/GlossaryTerm";

interface PanchangItemProps {
  /** Node rather than string so the label can carry a glossary definition. */
  label: React.ReactNode;
  value?: string;
  subtext?: string;
}

const PanchangItem: React.FC<PanchangItemProps> = ({
  label,
  value,
  subtext,
}) => (
  <div className="space-y-0.5">
    <p className="text-[10px] uppercase tracking-widest text-white/40 font-medium">
      {label}
    </p>
    <p className="text-sm text-white/80 truncate">{value || "—"}</p>
    {subtext && <p className="text-[10px] text-white/30">{subtext}</p>}
  </div>
);

interface PanchangCardProps {
  panchang: PanchangData | null;
  loading: boolean;
  error: string | null;
}

/**
 * Presentational only. This card used to call `usePanchang()` with no
 * arguments, which defaulted to New Delhi — so every user saw Delhi sunrise,
 * sunset and Rahu Kaal regardless of where they were. Panchang is
 * location-derived, so for a US user those values were ~10.5 hours wrong.
 * The Dashboard already fetches a location-aware panchang; it now passes it
 * down, which also removes a duplicate paid API call per dashboard load.
 */
export const PanchangCard: React.FC<PanchangCardProps> = ({
  panchang,
  loading,
  error,
}) => {
  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-[2rem] border border-white/10 p-6 flex items-center justify-center min-h-[160px]"
      >
        <Loader2 size={20} className="text-gold animate-spin" />
      </motion.div>
    );
  }

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-[2rem] border border-white/10 p-6"
      >
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 rounded-xl bg-amber-500/10">
            <Sun size={18} className="text-gold" />
          </div>
          <h3 className="text-sm font-semibold text-white/90 tracking-wide">
            Today&apos;s Panchang
          </h3>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-3">
          <PanchangItem
            label={<GlossaryTerm k="tithi">Tithi</GlossaryTerm>}
            value="Daily rhythm"
          />
          <PanchangItem
            label={<GlossaryTerm k="nakshatra">Nakshatra</GlossaryTerm>}
            value="Mindful action"
          />
          <PanchangItem
            label={<GlossaryTerm k="yoga">Yoga</GlossaryTerm>}
            value="Steady focus"
          />
          <PanchangItem
            label={<GlossaryTerm k="rahu-kaal">Rahu Kaal</GlossaryTerm>}
            value="Check before major starts"
          />
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-[2rem] border border-white/10 p-6"
    >
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 rounded-xl bg-amber-500/10">
          <Sun size={18} className="text-gold" />
        </div>
        <h3 className="text-sm font-semibold text-white/90 tracking-wide">
          Today&apos;s Panchang
        </h3>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-3">
        <PanchangItem
          label={<GlossaryTerm k="tithi">Tithi</GlossaryTerm>}
          value={panchang?.tithi}
          subtext={
            panchang?.tithiEnd ? `until ${panchang.tithiEnd}` : undefined
          }
        />
        <PanchangItem
          label={<GlossaryTerm k="nakshatra">Nakshatra</GlossaryTerm>}
          value={panchang?.nakshatra}
          subtext={
            panchang?.nakshatraEnd
              ? `until ${panchang.nakshatraEnd}`
              : undefined
          }
        />
        <PanchangItem
          label={<GlossaryTerm k="yoga">Yoga</GlossaryTerm>}
          value={panchang?.yoga}
        />
        <PanchangItem
          label={<GlossaryTerm k="karana">Karana</GlossaryTerm>}
          value={panchang?.karana}
        />
        <PanchangItem
          label={<GlossaryTerm k="rahu-kaal">Rahu Kaal</GlossaryTerm>}
          value={panchang?.rahu_kaal}
        />
      </div>

      {panchang?.sunrise &&
        panchang.sunrise !== "—" &&
        panchang?.sunset &&
        panchang.sunset !== "—" && (
          <div className="mt-3 pt-3 border-t border-white/5 flex items-center gap-2">
            <Sunrise size={14} className="text-gold/60 shrink-0" />
            <p className="text-sm text-white/60">
              {panchang.sunrise} · {panchang.sunset}
            </p>
          </div>
        )}
    </motion.div>
  );
};

export default PanchangCard;
