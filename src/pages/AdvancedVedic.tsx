import { useState, useEffect } from "react";
import { postJson } from "../lib/apiFetch";
import { useUserProfile } from "../hooks";
import { useRequestBirthData } from "../hooks/useRequestBirthData";
import { Loader2, Gauge, Calendar } from "lucide-react";
import { StatusNotice } from "../components/ui/StatusNotice";
import { PageShell } from "../components/layout/PageShell";
import BirthProfileRequired from "../components/BirthProfileRequired";

function txt(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

async function fetchChart(
  birthData: unknown,
  chartType: string,
  signal: AbortSignal,
): Promise<any> {
  const res = await postJson("/api/kundali", { birthData, chartType }, { signal });
  if (!res.ok) throw new Error(`${chartType} failed: ${res.status}`);
  const json = await res.json();
  return json?.data ?? null;
}

export default function AdvancedVedic() {
  const { birthData, loading: profileLoading } = useUserProfile();
  const requestBirthData = useRequestBirthData(birthData);
  const [shadbala, setShadbala] = useState<any>(null);
  const [varshaphal, setVarshaphal] = useState<any>(null);
  const [shadbalaError, setShadbalaError] = useState(false);
  const [varshaphalError, setVarshaphalError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const retry = () => setAttempt((n) => n + 1);

  useEffect(() => {
    if (profileLoading) return;
    if (!requestBirthData?.dob) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setShadbalaError(false);
    setVarshaphalError(false);
    Promise.allSettled([
      fetchChart(requestBirthData, "SHADBALA", controller.signal),
      fetchChart(requestBirthData, "VARSHAPHAL", controller.signal),
    ]).then(([shadRes, varshRes]) => {
      if (controller.signal.aborted) return;
      if (shadRes.status === "fulfilled") setShadbala(shadRes.value);
      else {
        console.error("Shadbala failed:", shadRes.reason);
        setShadbala(null);
        setShadbalaError(true);
      }
      if (varshRes.status === "fulfilled") setVarshaphal(varshRes.value);
      else {
        console.error("Varshaphal failed:", varshRes.reason);
        setVarshaphal(null);
        setVarshaphalError(true);
      }
      setLoading(false);
    });

    return () => controller.abort();
  }, [requestBirthData, profileLoading, attempt]);

  const planetsRaw =
    shadbala?.planets ||
    shadbala?.strengths ||
    (Array.isArray(shadbala) ? shadbala : []);
  const planets: any[] = Array.isArray(planetsRaw) ? planetsRaw : [];
  const varshaText =
    txt(varshaphal?.predictions) ||
    txt(varshaphal?.interpretation) ||
    txt(varshaphal?.summary);
  const muntha =
    txt(varshaphal?.muntha) || txt(varshaphal?.muntha?.sign);
  const keyPeriods: any[] = Array.isArray(varshaphal?.key_periods)
    ? varshaphal.key_periods
    : [];
  const hasVarshaphal =
    Boolean(txt(varshaphal?.year_lord) || varshaText || muntha || keyPeriods.length);

  return (
    <PageShell>
        <h1 className="type-page-title mb-2">
          Advanced Vedic Analysis
        </h1>
        <p className="text-white/60 mb-8">
          Shadbala strength scoring and annual predictions
        </p>

        {profileLoading ? (
          <div className="flex items-center justify-center py-20" aria-busy="true">
            <Loader2 size={32} className="animate-spin text-white/30" />
          </div>
        ) : !requestBirthData?.dob ? (
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
              {shadbalaError ? (
                <StatusNotice size="section"
                  message="Planetary strength couldn't be calculated. Check your connection and try again."
                  onRetry={retry}
                />
              ) : planets.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-white/55 text-xs uppercase tracking-widest border-b border-white/10">
                        <th className="text-left py-2 px-2">Planet</th>
                        <th className="text-right py-2 px-2">Strength</th>
                        <th className="text-left py-2 px-2 w-1/2">Level</th>
                      </tr>
                    </thead>
                    <tbody>
                      {planets.map((p: any, i: number) => {
                        const name = txt(p?.planet) || txt(p?.name) || "—";
                        const rawScore =
                          p?.total ?? p?.strength ?? p?.score ?? p?.shadbala;
                        const score =
                          typeof rawScore === "number" ? rawScore : txt(rawScore) || "—";
                        const pct =
                          typeof score === "number" ? Math.min(100, score / 2) : 0;
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
                <p className="text-sm text-white/60">
                  The calculation returned no planetary strength scores for your chart.
                </p>
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
              {varshaphalError ? (
                <StatusNotice size="section"
                  message="Your annual chart couldn't be calculated. Check your connection and try again."
                  onRetry={retry}
                />
              ) : hasVarshaphal ? (
                <div className="space-y-4">
                  {txt(varshaphal.year_lord) && (
                    <div className="p-4 rounded-xl bg-gold/5 border border-gold/20 text-center">
                      <span className="text-xs text-gold/80 uppercase tracking-widest">
                        Year Lord
                      </span>
                      <p className="text-2xl font-display text-gold mt-1">
                        {txt(varshaphal.year_lord)}
                      </p>
                    </div>
                  )}
                  {varshaText && (
                    <p className="text-white/65 text-sm leading-relaxed">
                      {varshaText}
                    </p>
                  )}
                  {muntha && (
                    <div className="p-3 rounded-xl bg-white/5">
                      <span className="text-xs text-white/55 uppercase tracking-widest">
                        Muntha
                      </span>
                      <p className="text-sm text-white/80 mt-1">
                        {muntha}
                      </p>
                    </div>
                  )}
                  {keyPeriods.length > 0 && (
                    <div>
                      <span className="text-xs text-white/55 uppercase tracking-widest">
                        Key Periods
                      </span>
                      <div className="space-y-2 mt-2">
                        {keyPeriods
                          .slice(0, 6)
                          .map((p: any, i: number) => (
                            <div
                              key={i}
                              className="flex items-start gap-2 text-sm"
                            >
                              <span className="text-amber-400 min-w-[80px]">
                                {txt(p?.period) || txt(p?.date)}
                              </span>
                              <span className="text-white/60">
                                {txt(p?.description) || txt(p?.prediction)}
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-white/60">
                  The calculation returned no annual chart details for this year.
                </p>
              )}
            </div>
          </div>
        )}
      </PageShell>
  );
}
