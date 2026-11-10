import React from "react";
import { motion } from "framer-motion";
import { Sparkles, TrendingUp, Zap, ArrowRight } from "lucide-react";
import { AtmanData } from "../../types/user";

interface SoulInsightCardProps {
  atmanState: AtmanData | undefined;
  onOpenSadhanaPath: () => void;
}

type InsightKind = "growth" | "shift" | "nudge";

/** Contradictions > vibe shifts > sadhana prompt > steady affirmation. */
function pickInsight(
  atmanState: AtmanData | null | undefined,
): InsightKind | null {
  if (!atmanState) return null;
  if (atmanState.contradictedPatterns?.length) return "growth";
  const history = atmanState.emotionalHistory;
  if (history && history.length >= 3) {
    const recent = history.slice(-3);
    if (recent[0].state !== recent[2].state) return "shift";
  }
  const state = atmanState.emotionalState;
  if (state === "anxious" || state === "chaotic" || state === "reactive")
    return "nudge";
  // "Steady" adds nothing: Today for you and the memory notes already say it.
  return null;
}

/** True when the card has something to show — the Dashboard skips the tile otherwise. */
export function hasSoulInsight(
  atmanState: AtmanData | null | undefined,
): boolean {
  return pickInsight(atmanState) !== null;
}

function InsightRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl bg-gold/[0.06] px-4 py-3"
    >
      <p className="flex items-center gap-2 text-[0.8rem] font-semibold text-gold/85">
        <span className="[&>svg]:size-[15px]" aria-hidden="true">
          {icon}
        </span>
        {label}
      </p>
      <div className="mt-1">{children}</div>
    </motion.div>
  );
}

/**
 * Surfaces one key brain insight per day on the Dashboard. It sits inside a
 * dashboard Tile, so it draws no card of its own.
 */
export const SoulInsightCard: React.FC<SoulInsightCardProps> = ({
  atmanState,
  onOpenSadhanaPath,
}) => {
  const kind = pickInsight(atmanState);
  if (!atmanState || !kind) return null;

  if (kind === "growth") {
    const patterns = atmanState.contradictedPatterns ?? [];
    return (
      <InsightRow
        icon={<Sparkles size={20} />}
        label="Your recent reflections"
      >
        <p className="text-[0.98rem] leading-relaxed text-white/85">
          {patterns[patterns.length - 1]}
        </p>
      </InsightRow>
    );
  }

  if (kind === "shift") {
    const recent = (atmanState.emotionalHistory ?? []).slice(-3);
    return (
      <InsightRow
        icon={<TrendingUp size={20} />}
        label="A recent change"
      >
        <p className="text-[0.98rem] leading-relaxed text-white/85">
          Your recent reflections describe a change from{" "}
          <span className="font-medium capitalize text-white">
            {recent[0].state}
          </span>{" "}
          to{" "}
          <span className="font-medium capitalize text-white">
            {recent[2].state}
          </span>{" "}
          over your last few sessions.
        </p>
      </InsightRow>
    );
  }

  if (kind === "nudge") {
    return (
      <InsightRow
        icon={<Zap size={20} />}
        label="A gentle suggestion"
      >
        <p className="text-[0.98rem] leading-relaxed text-white/85">
          Things have felt unsettled lately. A short 3-day practice path may
          help you find some stillness.
        </p>
        <button
          type="button"
          onClick={onOpenSadhanaPath}
          className="inline-flex min-h-11 items-center gap-1.5 text-[0.85rem] font-semibold text-gold/85 transition-colors hover:text-gold"
        >
          See my 3-day path <ArrowRight size={14} aria-hidden="true" />
        </button>
      </InsightRow>
    );
  }

  return null;
};

export default SoulInsightCard;
