import { useState, useEffect } from "react";
import { postJson } from "../lib/apiFetch";
import { useUserProfile } from "../hooks";
import { useRequestBirthData } from "../hooks/useRequestBirthData";
import { Heart, Loader2, Activity, Zap, Brain, Gauge } from "lucide-react";
import { StatusNotice } from "../components/ui/StatusNotice";
import { PageShell } from "../components/layout/PageShell";
import BirthProfileRequired from "../components/BirthProfileRequired";

function txt(value: unknown): string {
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : "";
}

async function fetchChart(
  birthData: unknown,
  chartType: string,
  signal: AbortSignal,
): Promise<any> {
  const res = await postJson(
    "/api/kundali",
    { birthData, chartType },
    { signal },
  );
  if (!res.ok) throw new Error(`${chartType} failed: ${res.status}`);
  const json = await res.json();
  return json?.data ?? null;
}

const SECTION_ERROR =
  "This couldn't be calculated. Check your connection and try again.";

export default function Wellness() {
  const { birthData, loading: profileLoading } = useUserProfile();
  const requestBirthData = useRequestBirthData(birthData);
  const [biorhythms, setBiorhythms] = useState<any>(null);
  const [wellnessScore, setWellnessScore] = useState<any>(null);
  const [energy, setEnergy] = useState<any>(null);
  const [errors, setErrors] = useState({
    bio: false,
    score: false,
    energy: false,
  });
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
        if (r.status === "rejected")
          console.error("Wellness fetch failed:", r.reason);
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
        <h1 className="type-page-title mb-2">Wellness & Biorhythms</h1>
        <p className="text-white/60 mb-8">
          How your body, mood and mind are running today, so you can save
          demanding plans for your stronger days
        </p>

        {profileLoading ? (
          <div
            className="flex items-center justify-center py-20"
            role="status"
            aria-label="Loading"
          >
            <Loader2 size={32} className="animate-spin text-white/50" />
          </div>
        ) : !requestBirthData?.dob ? (
          <BirthProfileRequired
            title="Create your birth profile to unlock wellness timing."
            description="Biorhythms, energy patterns, and cosmic wellness scoring need your birth date, time, and place."
          />
        ) : loading ? (
          <div
            className="flex items-center justify-center py-20"
            role="status"
            aria-label="Loading"
          >
            <Loader2 size={32} className="animate-spin text-white/50" />
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
              <p className="mb-4 text-sm leading-relaxed text-white/60">
                Three cycles that start at birth and repeat: body every 23
                days, mood every 28, mind every 33. Each runs from −100 (a
                low, recharge phase) to +100 (a high).
              </p>
              {errors.bio ? (
                <StatusNotice
                  size="section"
                  className="text-left"
                  message={SECTION_ERROR}
                  onRetry={retry}
                />
              ) : biorhythms && typeof biorhythms === "object" ? (
                <div className="space-y-4">
                  {[
                    {
                      label: "Physical",
                      key: "physical",
                      color: "bg-red-400",
                      icon: <Activity size={14} aria-hidden="true" />,
                    },
                    {
                      label: "Emotional",
                      key: "emotional",
                      color: "bg-blue-400",
                      icon: <Heart size={14} aria-hidden="true" />,
                    },
                    {
                      label: "Intellectual",
                      key: "intellectual",
                      color: "bg-emerald-400",
                      icon: <Brain size={14} aria-hidden="true" />,
                    },
                  ].map((cycle) => {
                    const rawVal =
                      biorhythms[cycle.key] ?? biorhythms[`${cycle.key}_cycle`];
                    const val = typeof rawVal === "number" ? rawVal : null;
                    const pct =
                      val !== null
                        ? Math.max(
                            0,
                            Math.min(100, Math.round((val + 100) / 2)),
                          )
                        : 0;
                    return (
                      <div key={cycle.key}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-white/60 flex items-center gap-1">
                            {cycle.icon} {cycle.label}
                          </span>
                          <span className="text-xs text-white/60 font-mono">
                            {val !== null
                              ? `${val > 0 ? "+" : ""}${val.toFixed(0)}`
                              : "—"}
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
            <div className="glass rounded-[2rem] p-6">
              <div className="flex items-center gap-2 mb-4">
                <Gauge size={18} className="text-gold" aria-hidden="true" />
                <h2 className="text-gold text-sm font-bold uppercase tracking-widest">
                  Wellness Score
                </h2>
              </div>
              {errors.score ? (
                <StatusNotice
                  size="section"
                  className="text-left"
                  message={SECTION_ERROR}
                  onRetry={retry}
                />
              ) : scoreValue ? (
                <>
                  <div className="text-5xl font-display text-white mb-2">
                    {scoreValue}
                    {Number.isFinite(Number(scoreValue)) && (
                      <span className="ml-1 text-lg text-white/55">/ 100</span>
                    )}
                  </div>
                  <p className="mb-3 text-xs text-white/55">
                    Your chart, today's sky and your cycles in one number.
                    Higher means more in your favour today.
                  </p>
                  {(txt(wellnessScore?.interpretation) ||
                    txt(wellnessScore?.description)) && (
                    <p className="text-white/65 text-sm leading-relaxed">
                      {txt(wellnessScore?.interpretation) ||
                        txt(wellnessScore?.description)}
                    </p>
                  )}
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
              <p className="mb-4 text-sm leading-relaxed text-white/60">
                When your energy tends to rise and dip, so you can time focused
                work and rest.
              </p>
              {errors.energy ? (
                <StatusNotice
                  size="section"
                  className="text-left"
                  message={SECTION_ERROR}
                  onRetry={retry}
                />
              ) : energyItems.length > 0 ? (
                <div className="space-y-3">
                  {energyItems.slice(0, 6).map((p: any, i: number) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 py-1.5 border-b border-white/5 last:border-0"
                    >
                      <span className="text-amber-400 text-xs min-w-[60px] shrink-0">
                        {txt(p?.time) || txt(p?.period)}
                      </span>
                      <p className="text-white/70 text-sm leading-relaxed">
                        {txt(p?.description) ||
                          txt(p?.energy_level) ||
                          txt(p?.advice)}
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
