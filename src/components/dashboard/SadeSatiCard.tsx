import React from "react";
import { Orbit } from "lucide-react";
import { TileHead } from "./WeatherTiles";
import { useSadeSati } from "../../hooks/useSadeSati";
import { PersonalCardNotice } from "./PersonalCardNotice";
import { FactSkeleton } from "./primitives";
import { GlossaryTerm } from "../ui/GlossaryTerm";

interface SadeSatiCardProps {
  birthData: any;
}

/** Sade Sati status as a ledger cell — stated calmly, with dates and the top remedy. */
export const SadeSatiCard: React.FC<SadeSatiCardProps> = ({ birthData }) => {
  const { sadeSati, loading, error, errorKind, retry } = useSadeSati(birthData);

  const label = (
    <TileHead icon={<Orbit />}>
      <GlossaryTerm k="sade-sati">Sade Sati</GlossaryTerm>
    </TileHead>
  );

  if (loading) return <FactSkeleton />;

  if (error) {
    return (
      <div>
        {label}
        <div className="mt-3">
          <PersonalCardNotice
            kind={errorKind ?? "unavailable"}
            thing="Sade Sati timing"
            onRetry={retry}
          />
        </div>
      </div>
    );
  }

  const isActive = sadeSati?.isActive ?? false;

  return (
    <div>
      {label}
      <p className="mt-1.5 font-display text-[1.6rem] leading-snug text-white/92">
        {isActive ? (
          <>
            <span
              className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-amber-300/80 align-middle"
              aria-hidden="true"
            />
            <span className="capitalize">
              {sadeSati?.phase ? `${sadeSati.phase} phase` : "Active"}
            </span>
          </>
        ) : (
          "Not active"
        )}
      </p>
      {isActive && (sadeSati?.startDate || sadeSati?.endDate) && (
        <p className="mt-1 text-[0.98rem] text-white/50">
          {sadeSati?.startDate && `From ${sadeSati.startDate}`}
          {sadeSati?.startDate && sadeSati?.endDate && " until "}
          {!sadeSati?.startDate && sadeSati?.endDate && "Until "}
          {sadeSati?.endDate}
        </p>
      )}
      <p className="mt-1 text-[0.98rem] leading-relaxed text-white/50">
        {isActive
          ? "A season for steadier choices and patience — not a punishment."
          : "Saturn is not crossing your Moon sign right now."}
      </p>
      {isActive && sadeSati?.remedies?.[0] && (
        <p className="mt-3 text-[0.98rem] leading-relaxed text-white/65">
          <span className="text-white/55">A helpful practice: </span>
          {sadeSati.remedies[0]}
        </p>
      )}
    </div>
  );
};

export default SadeSatiCard;
