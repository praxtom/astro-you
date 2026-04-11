import React from "react";
import { PLANETS } from "../../lib/astrology";

interface TransitPositionsTableProps {
  data: any;
}

const SIGN_NAMES: Record<string, string> = {
  Ari: "Aries", Tau: "Taurus", Gem: "Gemini", Can: "Cancer",
  Leo: "Leo", Vir: "Virgo", Lib: "Libra", Sco: "Scorpio",
  Sag: "Sagittarius", Cap: "Capricorn", Aqu: "Aquarius", Pis: "Pisces",
};

function formatDegree(deg: number): string {
  const d = Math.floor(deg);
  const m = Math.round((deg - d) * 60);
  return `${d}\u00B0${m.toString().padStart(2, "0")}\u2032`;
}

const TransitPositionsTable: React.FC<TransitPositionsTableProps> = ({ data }) => {
  const chartData = data?.chart_data || data;
  const subjectData = data?.subject_data || data?.positions?.subject_data;

  // Extract transit positions
  let positions: any[] = [];

  if (subjectData?.transit_subject) {
    const subj = subjectData.transit_subject;
    const names = [...(subj.planets_names_list || []), ...(subj.axial_cusps_names_list || [])];
    positions = names
      .map((n: string) => subj[n.toLowerCase()])
      .filter((p: any) => p && p.name && !p.name.includes("Ascendant"));
  } else {
    const all = chartData?.planetary_positions || chartData?.positions || [];
    positions = all.filter(
      (p: any) => p.name?.toLowerCase().includes("_transit") || (!p.name?.toLowerCase().includes("_natal") && !p.name?.includes("Ascendant"))
    );
  }

  if (positions.length === 0) return null;

  // Filter to main planets only
  const mainPlanets = ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto", "Rahu", "Ketu",
    "Sun_transit", "Moon_transit", "Mercury_transit", "Venus_transit", "Mars_transit", "Jupiter_transit", "Saturn_transit", "Uranus_transit", "Neptune_transit", "Pluto_transit"];

  const filtered = positions.filter((p: any) =>
    mainPlanets.some((m) => p.name === m || p.name?.replace("_transit", "") === m)
  );

  const display = (filtered.length > 0 ? filtered : positions).slice(0, 12);

  return (
    <div className="mb-8 glass rounded-[2rem] border border-white/10 p-6 overflow-hidden">
      <h3 className="text-xs font-black uppercase tracking-[0.3em] text-gold/60 mb-4">
        Current Transit Positions
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {display.map((p: any) => {
          const cleanName = (p.name || "").replace("_transit", "").replace("_natal", "");
          const planetInfo = (PLANETS as any)[cleanName];
          const signFull = SIGN_NAMES[p.sign] || p.sign || "—";
          const degree = typeof p.degree === "number" ? formatDegree(p.degree) : typeof p.abs_pos === "number" ? formatDegree(p.abs_pos % 30) : "";
          const retro = p.is_retrograde || p.retrograde;

          return (
            <div
              key={p.name}
              className="flex flex-col items-center gap-1 p-3 rounded-xl bg-white/5 border border-white/5 hover:border-gold/20 transition-colors"
            >
              <span className="text-lg" style={{ color: planetInfo?.color || "#FFD700" }}>
                {planetInfo?.symbol || cleanName.substring(0, 2)}
              </span>
              <span className="text-xs text-white/90 font-medium text-center">
                {cleanName}{retro ? " (R)" : ""}
              </span>
              <span className="text-[11px] text-white/50">
                {signFull}
              </span>
              {degree && (
                <span className="text-[10px] text-gold/70 font-mono">
                  {degree}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TransitPositionsTable;
