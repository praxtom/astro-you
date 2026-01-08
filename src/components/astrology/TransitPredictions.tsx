import React from "react";
import { Sparkles, Info, AlertTriangle, CheckCircle2 } from "lucide-react";

interface TransitPredictionsProps {
  predictions: any[];
  fallbackAspects?: any[];
  loading?: boolean;
}

const TransitPredictions: React.FC<TransitPredictionsProps> = ({
  predictions,
  fallbackAspects,
  loading,
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
                  "Optimization of luck and expansion. Opportunities are presenting themselves to broaden your horizons.",
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
                  "A 'Soul Return' moment. You are reconnecting with your original blueprint of rebellion, innovation, and freedom.",
                neptune_neptune:
                  "A subconscious reset. Your dreams and psychic sensitivity are aligning with your core spiritual essence.",
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
                "A celestial alignment influencing your energetic field."
              );
            };

            return {
              title: `${a.point1} ${a.aspect_type.replace("_", " ")} ${
                a.point2
              }`,
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
      <div className="p-4 rounded-3xl bg-white/5 border border-white/10 text-center">
        <Info className="mx-auto mb-4 text-white/20" size={32} />
        <p className="text-white/40 text-sm font-sans">
          No significant transit influences detected for today.
        </p>
      </div>
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
                className={`p-3 rounded-xl transition-colors duration-300 ${
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

              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-display text-white tracking-wide uppercase">
                    {title}
                  </h4>
                  <span className="text-[9px] font-black uppercase tracking-tighter opacity-30">
                    Intensity: {Math.round(p.intensity || 0)}/10
                  </span>
                </div>

                <div className="text-sm text-white/70 leading-relaxed font-sans font-light">
                  {description}
                </div>

                <div className="mt-4 flex items-center gap-4">
                  {(p.duration || p.aspect_type) && (
                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-white/20 font-bold">
                      <span className="w-1 h-1 rounded-full bg-white/20"></span>
                      {p.duration
                        ? `Ends in ${p.duration}`
                        : `Phase: ${p.aspect_type.replace("_", " ")}`}
                    </div>
                  )}
                  {p.isFallback && typeof p.orb === "number" && (
                    <div className="text-[10px] uppercase tracking-widest text-gold/30 font-bold">
                      Orb: {Math.abs(p.orb).toFixed(1)}°
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
