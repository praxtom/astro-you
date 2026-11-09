import { useState, useEffect } from "react";
import { postJson } from "../lib/apiFetch";
import { useUserProfile } from "../hooks";
import { useRequestBirthData } from "../hooks/useRequestBirthData";
import { Heart, Loader2, Activity, Zap, Brain, RotateCcw } from "lucide-react";
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

function SectionError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="rounded-xl border border-red-400/20 bg-red-500/[0.06] p-4 text-left">
      <p className="text-sm text-white/75">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-white/80 hover:border-white/30 hover:text-white"
      >
        <RotateCcw size={14} /> Retry
      </button>
    </div>
  );
}

const SECTION_ERROR =
  "This couldn't be calculated. Check your connection and try again.";

export default function Wellness() {
  const { birthData, loading: profileLoading } = useUserProfile();
  const requestBirthData = useRequestBirthData(birthData);
  const [biorhythms, setBiorhythms] = useState<any>(null);
  const [wellnessScore, setWellnessScore] = useState<any>(null);
  const [energy, setEnergy] = useState<any>(null);
  const [errors, setErrors] = useState({ bio: false, score: false, energy: false });
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
    setErrors({ bio: false, score: false, energy: false });
    Promise.allSettled([
      fetchChart(requestBirthData, "BIORHYTHMS", controller.signal),
      fetchChart(requestBirthData, "WELLNESS_SCORE", controller.signal),
      fetchChart(requestBirthData, "ENERGY_PATTERNS", controller.signal),
    ]).then(([bio, well, eng]) => {
      if (controller.signal.aborted) return;
      for (const r of [bio, well, eng]) {
        if (r.status === "rejected") console.error("Wellness fetch failed:", r.reason);
      }
      setBiorhythms(bio.status === "fulfilled" ? bio.value : null);
      setWellnessScore(well.status === "fulfilled" ? well.value : null);
      setEnergy(eng.status === "fulfilled" ? eng.value : null);
      setErrors({
        bio: bio.status === "rejected",
        score: well.status === "rejected",
        energy: eng.status === "rejected",
      });
      setLoading(false);
    });
    return () => controller.abort();
  }, [requestBirthData, profileLoading, attempt]);

  const scoreValue = txt(wellnessScore?.score ?? wellnessScore?.overall_score);
  const energyItems: any[] = Array.isArray(energy?.patterns)
    ? energy.patterns
    : Array.isArray(energy?.periods)
      ? energy.periods
      : [];

  return (
    <PageShell>
      <div>
        <h1 className="type-page-title mb-2">
          Wellness & Biorhythms
        </h1>
        <p className="text-white/60 mb-8">
          Your cosmic energy cycles and health insights
        </p>

        {profileLoading ? (
          <div className="flex items-center justify-center py-20" aria-busy="true">
            <Loader2 size={32} className="animate-spin text-white/30" />
          </div>
        ) : !requestBirthData?.dob ? (
          <BirthProfileRequired
            title="Create your birth profile to unlock wellness timing."
            description="Biorhythms, energy patterns, and cosmic wellness scoring need your birth date, time, and place."
          />
        ) : loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={32} className="animate-spin text-white/30" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Biorhythm Cycles */}
            <div className="glass rounded-[2rem] p-6">
              <div className="flex items-center gap-2 mb-4">
                <Activity size={18} className="text-gold" />
                <h2 className="text-gold text-sm font-bold uppercase tracking-widest">
                  Biorhythm Cycles
                </h2>
              </div>
              {errors.bio ? (
                <SectionError message={SECTION_ERROR} onRetry={retry} />
              ) : biorhythms && typeof biorhythms === "object" ? (
                <div className="space-y-4">
                  {[
                    {
                      label: "Physical",
                      key: "physical",
                      color: "bg-red-400",
                      icon: <Heart size={14} />,
                    },
                    {
                      label: "Emotional",
                      key: "emotional",
                      color: "bg-blue-400",
                      icon: <Heart size={14} />,
                    },
                    {
                      label: "Intellectual",
                      key: "intellectual",
                      color: "bg-emerald-400",
                      icon: <Brain size={14} />,
                    },
                  ].map((cycle) => {
                    const rawVal =
                      biorhythms[cycle.key] ??
                      biorhythms[`${cycle.key}_cycle`];
                    const val = typeof rawVal === "number" ? rawVal : null;
                    const pct =
                      val !== null ? Math.max(0, Math.min(100, Math.round((val + 100) / 2))) : 0;
                    return (
                      <div key={cycle.key}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-white/60 flex items-center gap-1">
                            {cycle.icon} {cycle.label}
                          </span>
                          <span className="text-xs text-white/60 font-mono">
                            {val !== null ? `${val.toFixed(0)}%` : "—"}
                          </span>
                        </div>
                        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${cycle.color}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-white/60">
                  No biorhythm values were returned for today.
                </p>
              )}
            </div>

            {/* Wellness Score */}
            <div className="glass rounded-[2rem] p-6 text-center">
              <Zap size={18} className="text-gold mx-auto mb-3" />
              <h2 className="text-gold text-sm font-bold uppercase tracking-widest mb-4">
                Wellness Score
              </h2>
              {errors.score ? (
                <SectionError message={SECTION_ERROR} onRetry={retry} />
              ) : scoreValue ? (
                <>
                  <div className="text-5xl font-display text-white mb-2">
                    {scoreValue}
                  </div>
                  <p className="text-white/60 text-sm">
                    {txt(wellnessScore?.interpretation) ||
                      txt(wellnessScore?.description) ||
                      "Overall cosmic wellness"}
                  </p>
                </>
              ) : (
                <p className="text-white/60 text-sm">
                  No wellness score was returned for today.
                </p>
              )}
            </div>

            {/* Energy Patterns */}
            <div className="glass rounded-[2rem] p-6">
              <div className="flex items-center gap-2 mb-4">
                <Zap size={18} className="text-gold" />
                <h2 className="text-gold text-sm font-bold uppercase tracking-widest">
                  Energy Patterns
                </h2>
              </div>
              {errors.energy ? (
                <SectionError message={SECTION_ERROR} onRetry={retry} />
              ) : energyItems.length > 0 ? (
                <div className="space-y-3">
                  {energyItems
                    .slice(0, 6)
                    .map((p: any, i: number) => (
                      <div
                        key={i}
                        className="flex items-start gap-2 py-1.5 border-b border-white/5 last:border-0"
                      >
                        <span className="text-amber-400 text-xs min-w-[60px]">
                          {txt(p?.time) || txt(p?.period)}
                        </span>
                        <p className="text-white/65 text-xs">
                          {txt(p?.description) || txt(p?.energy_level) || txt(p?.advice)}
                        </p>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="text-sm text-white/60">
                  No energy patterns were returned for today.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}
