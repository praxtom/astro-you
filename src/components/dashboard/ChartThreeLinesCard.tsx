import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { buildChartThreeLines, type ChartLike } from "../../lib/chart-summary";
import type { DashaPeriodSummary } from "../../hooks/useDashaPeriods";
import { PersonalCardNotice } from "./PersonalCardNotice";
import type { PersonalDataErrorKind } from "../../lib/personal-data-error";

interface ChartThreeLinesCardProps {
  kundali: ChartLike | null;
  kundaliLoading: boolean;
  nakshatra?: string | null;
  dashaPeriods: DashaPeriodSummary[];
  dashaLoading: boolean;
  errorKind?: PersonalDataErrorKind | null;
  onRetry?: () => void;
  /** Link to the full chart page (off when already on it). */
  showFullChartLink?: boolean;
}

/**
 * First personal insight on the dashboard: Moon + nakshatra, Lagna and the
 * running Mahadasha, one plain-language line each. Built only from data the
 * dashboard already loads (D1, NAKSHATRA, DASHAS) — no extra API call.
 */
export function ChartThreeLinesCard({
  kundali,
  kundaliLoading,
  nakshatra,
  dashaPeriods,
  dashaLoading,
  errorKind,
  onRetry,
  showFullChartLink = true,
}: ChartThreeLinesCardProps) {
  const navigate = useNavigate();
  const lines = buildChartThreeLines({ kundali, nakshatra, dashaPeriods });
  const stillLoading = (kundaliLoading || dashaLoading) && lines.length < 3;

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative bg-white/5 border border-white/10 rounded-[2rem] p-6 md:p-7"
      aria-labelledby="chart-three-lines-title"
    >
      <div className="flex items-center gap-2 mb-5">
        <Sparkles size={16} className="text-gold" />
        <h2
          id="chart-three-lines-title"
          className="text-white/40 text-xs uppercase tracking-widest font-bold"
        >
          Your chart in three lines
        </h2>
      </div>

      {lines.length > 0 && (
        <ol className="space-y-4">
          {lines.map((line) => (
            <li key={line.label} className="grid gap-1 md:grid-cols-[7.5rem_1fr] md:gap-4">
              <span className="text-[0.65rem] uppercase tracking-[0.3em] font-bold text-gold/80 md:pt-1">
                {line.label}
              </span>
              <p className="text-white/80 leading-relaxed">
                <span className="font-display text-lg text-white">{line.value}</span>
                <span className="text-white/40"> — </span>
                {line.meaning}
              </p>
            </li>
          ))}
        </ol>
      )}

      {stillLoading && (
        <div className="mt-4 space-y-2" aria-hidden="true">
          <div className="h-3 bg-white/5 rounded w-2/3 animate-pulse" />
          <div className="h-3 bg-white/5 rounded w-1/2 animate-pulse" />
        </div>
      )}

      {!stillLoading && lines.length === 0 && (
        <PersonalCardNotice
          kind={errorKind ?? "unavailable"}
          thing="chart summary"
          onRetry={onRetry}
        />
      )}

      {showFullChartLink && lines.length > 0 && (
        <button
          type="button"
          onClick={() => navigate("/reports")}
          className="mt-5 text-xs uppercase tracking-[0.2em] font-bold text-gold hover:text-white transition-colors"
        >
          See my full chart →
        </button>
      )}
    </motion.section>
  );
}
