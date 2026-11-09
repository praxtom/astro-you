import React from "react";
import type { UseNakshatraResult } from "../../hooks/useNakshatra";
import { PersonalCardNotice } from "./PersonalCardNotice";
import { FactLabel, FactSkeleton } from "./primitives";

interface NakshatraCardProps {
  /** Shared result of the Dashboard's single useNakshatra call. */
  state: UseNakshatraResult;
  /** Birth star derived from the natal chart, used when the reading has no name. */
  fallbackName?: string | null;
}

const usable = (v?: string | null) =>
  Boolean(v && v.trim() && v.trim().toLowerCase() !== "unknown");

/** Birth nakshatra as a ledger cell: name, deity and ruler, and today's note. */
export const NakshatraCard: React.FC<NakshatraCardProps> = ({
  state,
  fallbackName,
}) => {
  const { nakshatra, loading, error, errorKind, retry } = state;
  const name = usable(nakshatra?.name)
    ? nakshatra?.name
    : usable(fallbackName)
      ? fallbackName
      : null;

  const label = (
    <FactLabel>Birth nakshatra</FactLabel>
  );

  if (loading && !name) return <FactSkeleton />;

  if (error && !name) {
    return (
      <div>
        {label}
        <div className="mt-3">
          <PersonalCardNotice
            kind={errorKind ?? "unavailable"}
            thing="birth star reading"
            onRetry={retry}
          />
        </div>
      </div>
    );
  }

  return (
    <div>
      {label}
      <p className="mt-1.5 font-display text-[1.6rem] leading-snug text-white/92">
        {name ?? "—"}
      </p>
      {(nakshatra?.deity || nakshatra?.ruler) && (
        <p className="mt-1 text-[0.98rem] text-white/50">
          {nakshatra?.deity && <>Deity {nakshatra.deity}</>}
          {nakshatra?.deity && nakshatra?.ruler && ", "}
          {nakshatra?.ruler && <>ruled by {nakshatra.ruler}</>}
        </p>
      )}
      {nakshatra?.prediction && (
        <p className="mt-3 text-[0.98rem] leading-relaxed text-white/65">
          {nakshatra.prediction}
        </p>
      )}
    </div>
  );
};

export default NakshatraCard;
