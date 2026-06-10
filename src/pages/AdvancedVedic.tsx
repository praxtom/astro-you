import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUserProfile } from "../hooks";
import { useRequestBirthData } from "../hooks/useRequestBirthData";
import { Loader2, ArrowLeft, Gauge, Calendar } from "lucide-react";
import Header from "../components/layout/Header";
import BirthProfileRequired from "../components/BirthProfileRequired";

export default function AdvancedVedic() {
  const navigate = useNavigate();
  const { birthData } = useUserProfile();
  const requestBirthData = useRequestBirthData(birthData);
  const [shadbala, setShadbala] = useState<any>(null);
  const [varshaphal, setVarshaphal] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!requestBirthData?.dob) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => setLoading(false), 3200);
    setLoading(true);
    Promise.all([
      fetch("/api/kundali", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ birthData: requestBirthData, chartType: "SHADBALA" }),
        signal: controller.signal,
      })
        .then((r) => r.json())
        .catch(() => null),
      fetch("/api/kundali", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ birthData: requestBirthData, chartType: "VARSHAPHAL" }),
        signal: controller.signal,
      })
        .then((r) => r.json())
        .catch(() => null),
    ]).then(([shadRes, varshRes]) => {
      setShadbala(shadRes?.data);
      setVarshaphal(varshRes?.data);
      window.clearTimeout(timeoutId);
      setLoading(false);
    });

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [requestBirthData]);

  const planets =
    shadbala?.planets ||
    shadbala?.strengths ||
    (Array.isArray(shadbala) ? shadbala : []);

  return (
    <div className="min-h-screen bg-[#030308] text-white">
      <Header />
      <main className="container mx-auto pt-24 px-6 pb-12">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-white/40 hover:text-white mb-6 text-sm"
        >
          <ArrowLeft size={16} /> Back
        </button>
        <h1 className="text-3xl md:text-4xl font-display mb-2">
          Advanced Vedic Analysis
        </h1>
        <p className="text-white/50 mb-8">
          Shadbala strength scoring and annual predictions
        </p>

        {!requestBirthData?.dob ? (
          <BirthProfileRequired
            title="Create your birth profile to unlock advanced Vedic analysis."
            description="Shadbala strength and yearly Varshaphal need your birth date, time, and place so the results are calculated for your chart."
          />
        ) : loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={32} className="animate-spin text-white/30" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Shadbala */}
            <div className="glass rounded-[2rem] p-6">
              <div className="flex items-center gap-2 mb-4">
                <Gauge size={18} className="text-gold" />
                <h2 className="text-gold text-sm font-bold uppercase tracking-widest">
                  Shadbala — Planetary Strength
                </h2>
              </div>
              {planets.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-white/40 text-xs uppercase tracking-widest border-b border-white/10">
                        <th className="text-left py-2 px-2">Planet</th>
                        <th className="text-right py-2 px-2">Strength</th>
                        <th className="text-left py-2 px-2 w-1/2">Level</th>
                      </tr>
                    </thead>
                    <tbody>
                      {planets.map((p: any, i: number) => {
                        const name = p.planet || p.name || `Planet ${i + 1}`;
                        const score =
                          p.total || p.strength || p.score || p.shadbala || 0;
                        const pct = Math.min(
                          100,
                          typeof score === "number" ? score / 2 : 50,
                        );
                        return (
                          <tr key={i} className="border-b border-white/5">
                            <td className="py-2.5 px-2 text-white/90">
                              {name}
                            </td>
                            <td className="py-2.5 px-2 text-right text-white/60 font-mono">
                              {typeof score === "number"
                                ? score.toFixed(1)
                                : score}
                            </td>
                            <td className="py-2.5 px-2">
                              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${pct >= 60 ? "bg-emerald-400" : pct >= 40 ? "bg-amber-400" : "bg-red-400"}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="space-y-2">
                  {['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'].map((planet) => (
                    <div key={planet} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm">
                      <span className="text-white/70">{planet}</span>
                      <span className="text-white/35">Refreshing strength</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Varshaphal */}
            <div className="glass rounded-[2rem] p-6">
              <div className="flex items-center gap-2 mb-4">
                <Calendar size={18} className="text-gold" />
                <h2 className="text-gold text-sm font-bold uppercase tracking-widest">
                  Varshaphal — Annual Chart
                </h2>
              </div>
              {varshaphal ? (
                <div className="space-y-4">
                  {varshaphal.year_lord && (
                    <div className="p-4 rounded-xl bg-gold/5 border border-gold/20 text-center">
                      <span className="text-[10px] text-gold/60 uppercase tracking-widest">
                        Year Lord
                      </span>
                      <p className="text-2xl font-display text-gold mt-1">
                        {varshaphal.year_lord}
                      </p>
                    </div>
                  )}
                  {(varshaphal.predictions ||
                    varshaphal.interpretation ||
                    varshaphal.summary) && (
                    <p className="text-white/60 text-sm leading-relaxed">
                      {varshaphal.predictions ||
                        varshaphal.interpretation ||
                        varshaphal.summary}
                    </p>
                  )}
                  {varshaphal.muntha && (
                    <div className="p-3 rounded-xl bg-white/5">
                      <span className="text-[10px] text-white/30 uppercase tracking-widest">
                        Muntha
                      </span>
                      <p className="text-sm text-white/80 mt-1">
                        {typeof varshaphal.muntha === "string"
                          ? varshaphal.muntha
                          : varshaphal.muntha.sign ||
                            JSON.stringify(varshaphal.muntha)}
                      </p>
                    </div>
                  )}
                  {varshaphal.key_periods && (
                    <div>
                      <span className="text-[10px] text-white/30 uppercase tracking-widest">
                        Key Periods
                      </span>
                      <div className="space-y-2 mt-2">
                        {(Array.isArray(varshaphal.key_periods)
                          ? varshaphal.key_periods
                          : []
                        )
                          .slice(0, 6)
                          .map((p: any, i: number) => (
                            <div
                              key={i}
                              className="flex items-start gap-2 text-sm"
                            >
                              <span className="text-amber-400 min-w-[80px]">
                                {p.period || p.date}
                              </span>
                              <span className="text-white/60">
                                {p.description || p.prediction}
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {[
                    ['Year Lord', 'Annual ruling planet and tone.'],
                    ['Muntha', 'The house focus activated for the year.'],
                    ['Key Periods', 'Strong windows for work, relationship, and health decisions.'],
                  ].map(([label, text]) => (
                    <div key={label} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                      <span className="text-[10px] text-white/30 uppercase tracking-widest">{label}</span>
                      <p className="mt-1 text-sm text-white/60">{text}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
