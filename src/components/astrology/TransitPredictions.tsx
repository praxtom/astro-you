import React from "react";
import { Sparkles, AlertTriangle, CheckCircle2 } from "lucide-react";
import { StatusNotice } from "../ui/StatusNotice";

interface TransitPredictionsProps {
  predictions: any[];
  fallbackAspects?: any[];
  loading?: boolean;
  /** When set, the predictions failed to load; show this instead of "nothing found". */
  error?: string | null;
  onRetry?: () => void;
}

/** Plain-language name for each aspect, with the term kept in brackets. */
const ASPECT_PLAIN: Record<string, string> = {
  conjunction: "Joined together (conjunction)",
  trine: "Easy flow (trine)",
  sextile: "Small opening (sextile)",
  square: "Push to act (square)",
  opposition: "Balancing act (opposition)",
};

const aspectLabel = (type: string) =>
  ASPECT_PLAIN[type] ?? type.replace("_", " ");

/** Word for a 1–10 intensity, so the number says how much to notice it. */
const intensityWord = (n: number) =>
  n >= 8 ? "strong" : n >= 5 ? "noticeable" : "mild";

/** "Sun_transit" → "Sun today", "Moon_natal" → "your birth Moon". */
const pointLabel = (name: string) =>
  name.endsWith("_transit")
    ? `${name.replace("_transit", "")} today`
    : name.endsWith("_natal")
      ? `your birth ${name.replace("_natal", "")}`
      : name;

const TransitPredictions: React.FC<TransitPredictionsProps> = ({
  predictions,
  fallbackAspects,
  loading,
  error,
  onRetry,
}) => {
  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-24 bg-white/5 rounded-2xl border border-white/5"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <StatusNotice size="section" message={error} onRetry={onRetry} />
    );
  }

  // Combine and sort by importance/orb
  const rawItems =
    predictions && predictions.length > 0
      ? predictions.map((p) => ({ ...p, intensity: p.strength || 8 }))
      : (fallbackAspects || [])
          .map((a) => {
            const absOrb = Math.abs(a.orb || 0);
            const intensity = Math.max(1, Math.min(10, 10 - absOrb));

            // --- BEGIN CELESTIAL WISDOM DICTIONARY ---
            const getMeaning = (p1: string, p2: string, type: string) => {
              const pair = [p1.toLowerCase(), p2.toLowerCase()]
                .sort()
                .join("_");
              const isHard = type === "square" || type === "opposition";

              const meanings: Record<string, string> = {
                sun_sun:
                  "A moment of personal solar return. Your vitality is renewing itself, marking a significant start of a new self-expression cycle.",
                mars_sun: isHard
                  ? "Your ambition is peaking, but watch for burnout or friction with authority."
                  : "A surge of physical energy and courage. Excellent for taking bold actions.",
                mercury_sun:
                  "A day of high mental clarity. Your words carry more weight and your ideas find easy expression.",
                moon_venus:
                  "A beautiful alignment for emotional harmony and social grace. You feel more attractive and receptive to love.",
                jupiter_sun:
                  "This transit may support learning or exploring an opportunity. Consider what fits your goals.",
                saturn_sun: isHard
                  ? "A period of 'testing' where discipline and boundaries are required to reach your goals."
                  : "Stability and solid foundations. A great time to commit to long-term structures.",
                mercury_venus:
                  "The 'Diplomat's Aspect'. Your communication is refined, artistic, and persuasive.",
                mars_venus:
                  "A blend of passion and desire. High creative energy and magnetic social interactions.",
                moon_moon:
                  "An emotional reset. Your intuition is heightened; trust your gut feelings today.",
                jupiter_jupiter:
                  "A cycle of growth is peaking. Abundance and philosophical breakthroughs are likely.",
                uranus_uranus:
                  "A period for reviewing how much freedom and change you want in your life.",
                neptune_neptune:
                  "A period for reflecting on your hopes, imagination, and expectations.",
                pluto_pluto:
                  "A deep evolutionary point. You are touching the seeds of your own transformation and personal power.",
                saturn_saturn:
                  "The 'Great Architect' reset. You are re-evaluating your life's structures and long-term commitments.",
              };

              const aspectTypes: Record<string, string> = {
                conjunction:
                  "Merging energies: This alignment intensifies the focus on these two planetary themes.",
                square:
                  "Tension point: A challenge that requires action or adjustment to resolve friction.",
                opposition:
                  "Balance needed: You are seeing two sides of a situation, requiring a middle path.",
                trine:
                  "Flowing grace: Energies support each other effortlessly, bringing ease and talent.",
                sextile:
                  "Opportunity: A supportive window where your efforts will yield unexpected rewards.",
              };

              return (
                meanings[pair] ||
                aspectTypes[type] ||
                "An aspect between these planets. Open the chart to explore the placements."
              );
            };

            return {
              title: `${pointLabel(a.point1)} ${a.aspect_type.replace("_", " ")} ${pointLabel(
                a.point2,
              )}`,
              description: getMeaning(a.point1, a.point2, a.aspect_type),
              aspect_type: a.aspect_type,
              intensity,
              isFallback: true,
              orb: a.orb,
            };
          })
          .sort((a, b) => b.intensity - a.intensity);

  // Limit to top 8 most significant if it's too long
  const itemsToShow = rawItems.slice(0, 8);

  if (itemsToShow.length === 0) {
    return (
      <StatusNotice
        tone="info"
        size="section"
        message="No strong planetary links to your chart today, so expect a steadier day. Your daily forecast has the wider picture."
        action={{ label: "Open daily forecast", to: "/forecast" }}
      />
    );
  }

  return (
    <div className="space-y-4">
      {itemsToShow.map((p, i) => {
        const isStringInterp = typeof p.interpretation === "string";
        const title =
          p.title ||
          p.interpretation?.title ||
          (p.isFallback
            ? `${p.title}`
            : `Transit of ${p.transiting_planet || "Planet"}`);

        let description =
          p.description ||
          p.interpretation?.text ||
          (isStringInterp ? p.interpretation : "");

        // Final cleaning of description
        description = description.trim();
        if (
          description &&
          !description.endsWith(".") &&
          !description.endsWith("!") &&
          !description.endsWith("?")
        ) {
          description += ".";
        }

        const type =
          p.type ||
          (p.aspect_type === "trine" ||
          p.aspect_type === "sextile" ||
          p.aspect_type === "conjunction"
            ? "positive"
            : p.aspect_type === "square" || p.aspect_type === "opposition"
            ? "negative"
            : "neutral");

        return (
          <div
            key={i}
            className="group relative p-4 rounded-2xl bg-[#0a0a0f] border border-white/10 hover:border-gold/30 transition-all duration-500 overflow-hidden"
          >
            {/* Strength Indicator Bar */}
            <div
              className="absolute left-0 top-0 bottom-0 w-1 opacity-20 group-hover:opacity-100 transition-opacity"
              style={{
                backgroundColor:
                  type === "positive"
                    ? "#10b981"
                    : type === "negative"
                    ? "#f43f5e"
                    : "#eab308",
                height: `${Math.min(100, (p.intensity || 5) * 10)}%`,
              }}
            />

            <div className="flex items-start gap-4">
              <div
                aria-hidden="true"
                className={`shrink-0 p-3 rounded-xl transition-colors duration-300 ${
                  type === "positive"
                    ? "bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500/20"
                    : type === "negative"
                    ? "bg-red-500/10 text-red-400 group-hover:bg-red-500/20"
                    : "bg-gold/10 text-gold group-hover:bg-gold/20"
                }`}
              >
                {type === "positive" ? (
                  <CheckCircle2 size={18} />
                ) : type === "negative" ? (
                  <AlertTriangle size={18} />
                ) : (
                  <Sparkles size={18} />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 mb-2">
                  <h3 className="text-[0.95rem] font-semibold text-white/90">
                    {title}
                  </h3>
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-white/50">
                    Intensity {Math.round(p.intensity || 0)}/10 ·{" "}
                    {intensityWord(p.intensity || 0)}
                  </span>
                </div>

                <div className="text-sm text-white/70 leading-relaxed">
                  {description}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
                  {(p.duration || p.aspect_type) && (
                    <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-white/50 font-semibold">
                      <span className="w-1 h-1 rounded-full bg-white/40" aria-hidden="true"></span>
                      {p.duration
                        ? `Ends in ${p.duration}`
                        : aspectLabel(p.aspect_type)}
                    </div>
                  )}
                  {typeof p.orb === "number" && (
                    <div className="text-[11px] uppercase tracking-wider text-gold/75 font-semibold">
                      {Math.abs(p.orb).toFixed(1)}° from exact (orb)
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default TransitPredictions;
