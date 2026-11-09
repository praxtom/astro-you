import { useState, useEffect } from "react";
import { postJson } from "../lib/apiFetch";
import { Moon, Sun, Sparkles } from "lucide-react";
import { StatusNotice } from "../components/ui/StatusNotice";
import { useUserProfile } from "../hooks";
import { useRequestBirthData } from "../hooks/useRequestBirthData";
import BirthProfileRequired from "../components/BirthProfileRequired";
import { PageShell } from "../components/layout/PageShell";

interface Eclipse {
  date: string;
  type: string; // "solar" | "lunar"
  sign?: string;
  description?: string;
  visibility?: string;
}

interface EclipseImpact {
  houses?: string[];
  planets?: string[];
  interpretation?: string;
  summary?: string;
}

function toLabelList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string" || typeof item === "number") return String(item);
      if (item && typeof item === "object") {
        const obj = item as Record<string, unknown>;
        const label = obj.name ?? obj.planet ?? obj.house ?? obj.label;
        return typeof label === "string" || typeof label === "number" ? String(label) : "";
      }
      return "";
    })
    .filter(Boolean);
}

function toStr(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export default function Eclipses() {
  const { birthData: profileBirthData, loading: profileLoading } = useUserProfile();
  const birthData = useRequestBirthData(profileBirthData);
  const [eclipseAttempt, setEclipseAttempt] = useState(0);
  const [impactAttempt, setImpactAttempt] = useState(0);

  const [eclipses, setEclipses] = useState<Eclipse[]>([]);
  const [eclipseLoading, setEclipseLoading] = useState(true);
  const [eclipseError, setEclipseError] = useState<string | null>(null);

  const [impact, setImpact] = useState<EclipseImpact | null>(null);
  const [impactLoading, setImpactLoading] = useState(false);
  const [impactError, setImpactError] = useState<string | null>(null);

  // Fetch upcoming eclipses
  useEffect(() => {
    const controller = new AbortController();
    let timedOut = false;
    const timeoutId = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 15000);

    const fetchEclipses = async () => {
      try {
        setEclipseLoading(true);
        setEclipseError(null);
        const res = await postJson(
          "/api/kundali",
          { chartType: "ECLIPSES" },
          { signal: controller.signal },
        );
        if (!res.ok) throw new Error(`Eclipses failed: ${res.status}`);
        const data = await res.json();
        const raw = data?.data ?? data ?? {};

        // Parse eclipses from various response shapes
        let parsed: Eclipse[] = [];
        if (Array.isArray(raw)) {
          parsed = raw.map((e: any) => ({
            date: e.date || e.datetime || "",
            type: String(e.type || e.eclipse_type || "").toLowerCase(),
            sign: e.sign || e.zodiac_sign || e.constellation || "",
            description: e.description || e.summary || "",
            visibility: e.visibility || "",
          }));
        } else if (raw.eclipses && Array.isArray(raw.eclipses)) {
          parsed = raw.eclipses.map((e: any) => ({
            date: e.date || e.datetime || "",
            type: String(e.type || e.eclipse_type || "").toLowerCase(),
            sign: e.sign || e.zodiac_sign || "",
            description: e.description || e.summary || "",
            visibility: e.visibility || "",
          }));
        }

        setEclipses(parsed.slice(0, 5));
      } catch (err: any) {
        if (err?.name === "AbortError" && !timedOut) return;
        console.error("Eclipse fetch error:", err);
        setEclipses([]);
        setEclipseError(
          "We couldn't load upcoming eclipse dates. Check your connection and try again.",
        );
      } finally {
        window.clearTimeout(timeoutId);
        if (!controller.signal.aborted || timedOut) setEclipseLoading(false);
      }
    };
    fetchEclipses();
    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [eclipseAttempt]);

  // Fetch personal impact when birthData is available
  useEffect(() => {
    if (profileLoading || !birthData?.dob || !birthData?.tob) return;
    const controller = new AbortController();
    let timedOut = false;
    const timeoutId = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 15000);

    const fetchImpact = async () => {
      try {
        setImpactLoading(true);
        setImpactError(null);
        const res = await postJson(
          "/api/kundali",
          { birthData, chartType: "ECLIPSE_IMPACT" },
          { signal: controller.signal },
        );
        if (!res.ok) throw new Error(`Eclipse impact failed: ${res.status}`);
        const data = await res.json();
        const raw = data?.data ?? data ?? {};

        setImpact({
          houses: toLabelList(raw.affected_houses ?? raw.houses),
          planets: toLabelList(raw.affected_planets ?? raw.planets),
          interpretation:
            toStr(raw.interpretation) || toStr(raw.reading) || toStr(raw.text) || toStr(raw.summary),
          summary: toStr(raw.summary) || toStr(raw.overview),
        });
      } catch (err: any) {
        if (err?.name === "AbortError" && !timedOut) return;
        console.error("Eclipse impact error:", err);
        setImpact(null);
        setImpactError(
          "We couldn't work out how eclipses touch your chart. Try again in a moment.",
        );
      } finally {
        window.clearTimeout(timeoutId);
        if (!controller.signal.aborted || timedOut) setImpactLoading(false);
      }
    };
    fetchImpact();
    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [birthData, profileLoading, impactAttempt]);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "Date TBD";
    try {
      return new Date(dateStr).toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const getEclipseIcon = (type: string) => {
    return type.includes("solar") ? (
      <Sun size={24} className="text-amber-400" />
    ) : (
      <Moon size={24} className="text-blue-300" />
    );
  };

  const getEclipseBorderColor = (type: string) => {
    return type.includes("solar")
      ? "border-amber-500/30 bg-gradient-to-b from-amber-500/10 to-amber-900/5"
      : "border-blue-500/30 bg-gradient-to-b from-blue-500/10 to-blue-900/5";
  };

  const header = (
    <div className="flex items-center gap-4 mb-10">
      <div className="p-3 rounded-2xl bg-gold/10 text-gold">
        <Moon size={28} />
      </div>
      <div>
        <h1 className="type-page-title">Eclipses</h1>
        <p className="text-white/55 text-sm mt-1">
          Cosmic portals of transformation
        </p>
      </div>
    </div>
  );

  // Loading skeleton
  if (eclipseLoading) {
    return (
      <PageShell>
        <div aria-busy="true">
          {header}
          <div className="space-y-4 mb-10">
            {[1, 2, 3].map((i) => (
              <div key={i} className="glass rounded-2xl p-6 flex gap-4">
                <div className="h-12 w-12 bg-white/5 rounded-full animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-5 bg-white/5 rounded animate-pulse w-48" />
                  <div className="h-4 bg-white/5 rounded animate-pulse w-32" />
                </div>
              </div>
            ))}
          </div>
          <div className="glass rounded-2xl p-6 space-y-3">
            <div className="h-5 bg-white/5 rounded animate-pulse w-40" />
            <div className="h-4 bg-white/5 rounded animate-pulse w-full" />
            <div className="h-4 bg-white/5 rounded animate-pulse w-3/4" />
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div>
        {header}

        {/* Upcoming Eclipses */}
        <section className="mb-12">
          <h2 className="text-lg uppercase tracking-widest text-white/55 font-bold mb-5">
            Upcoming Eclipses
          </h2>

          {eclipseError ? (
            <StatusNotice
              message={eclipseError}
              onRetry={() => setEclipseAttempt((n) => n + 1)}
            />
          ) : eclipses.length === 0 ? (
            <div className="glass rounded-2xl p-8 text-center">
              <p className="text-white/60">
                No upcoming eclipses were returned for the coming months.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {eclipses.map((eclipse, idx) => (
                <div
                  key={idx}
                  className={`rounded-2xl border p-6 backdrop-blur-sm ${getEclipseBorderColor(eclipse.type)} transition-transform hover:scale-[1.01]`}
                >
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-white/5 flex-shrink-0">
                      {getEclipseIcon(eclipse.type)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 flex-wrap mb-1">
                        <h3 className="text-lg font-display tracking-wider text-white">
                          {eclipse.type.includes("solar")
                            ? "Solar Eclipse"
                            : "Lunar Eclipse"}
                        </h3>
                        {eclipse.sign && (
                          <span className="text-xs font-medium px-2.5 py-1 rounded-full border border-white/10 bg-white/5 text-white/60">
                            {eclipse.sign}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-white/50 mb-2">
                        {formatDate(eclipse.date)}
                      </p>
                      {eclipse.description && (
                        <p className="text-sm text-white/60 leading-relaxed">
                          {eclipse.description}
                        </p>
                      )}
                      {eclipse.visibility && (
                        <p className="text-xs text-white/55 mt-2">
                          Visibility: {eclipse.visibility}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Personal Impact */}
        <section>
          <h2 className="text-lg uppercase tracking-widest text-white/55 font-bold mb-5">
            Personal Impact
          </h2>

          {profileLoading ? (
            <div className="glass rounded-2xl p-8 space-y-4" aria-busy="true">
              <div className="h-5 bg-white/5 rounded animate-pulse w-48" />
              <div className="h-4 bg-white/5 rounded animate-pulse w-3/4" />
            </div>
          ) : !birthData?.dob || !birthData?.tob ? (
            <BirthProfileRequired
              title="Add your birth details"
              description="Eclipse impact is read against your birth chart. Create your birth profile to see which houses and planets each eclipse touches."
            />
          ) : impactLoading ? (
            <div className="glass rounded-2xl p-8 space-y-4">
              <div className="h-5 bg-white/5 rounded animate-pulse w-48" />
              <div className="flex gap-2">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-8 w-20 bg-white/5 rounded-full animate-pulse"
                  />
                ))}
              </div>
              <div className="h-4 bg-white/5 rounded animate-pulse w-full" />
              <div className="h-4 bg-white/5 rounded animate-pulse w-3/4" />
            </div>
          ) : impactError ? (
            <StatusNotice
              message={impactError}
              onRetry={() => setImpactAttempt((n) => n + 1)}
            />
          ) : impact ? (
            <div className="glass rounded-2xl p-8">
              {/* Affected houses */}
              {impact.houses && impact.houses.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm uppercase tracking-widest text-white/55 mb-3">
                    Affected Houses
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {impact.houses.map((house, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-300 text-sm"
                      >
                        {house}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Affected planets */}
              {impact.planets && impact.planets.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm uppercase tracking-widest text-white/55 mb-3">
                    Affected Planets
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {impact.planets.map((planet, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-300 text-sm"
                      >
                        {planet}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Interpretation */}
              {(impact.interpretation || impact.summary) && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles size={16} className="text-blue-400" />
                    <h3 className="text-sm uppercase tracking-widest text-white/55">
                      Interpretation
                    </h3>
                  </div>
                  <p className="text-white/70 leading-relaxed whitespace-pre-wrap">
                    {impact.interpretation || impact.summary}
                  </p>
                </div>
              )}

              {/* Fallback if no structured data */}
              {!impact.houses?.length &&
                !impact.planets?.length &&
                !impact.interpretation && (
                  <p className="text-white/60">
                    The eclipse calculation returned no specific findings for
                    your chart.
                  </p>
                )}
            </div>
          ) : null}
        </section>
      </div>
    </PageShell>
  );
}
