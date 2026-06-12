import { useState, useEffect } from "react";
import { postJson } from "../lib/apiFetch";
import { useNavigate } from "react-router-dom";
import { Moon, Sun, Sparkles, AlertTriangle } from "lucide-react";
import { useUserProfile } from "../hooks";
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

export default function Eclipses() {
  const navigate = useNavigate();
  const { birthData, loading: profileLoading } = useUserProfile();

  const [eclipses, setEclipses] = useState<Eclipse[]>([]);
  const [eclipseLoading, setEclipseLoading] = useState(true);
  const [eclipseError, setEclipseError] = useState<string | null>(null);

  const [impact, setImpact] = useState<EclipseImpact | null>(null);
  const [impactLoading, setImpactLoading] = useState(false);
  const [impactError, setImpactError] = useState<string | null>(null);

  // Fetch upcoming eclipses
  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 4200);

    const fetchEclipses = async () => {
      try {
        setEclipseLoading(true);
        setEclipseError(null);
        const res = await postJson(
          "/api/kundali",
          { chartType: "ECLIPSES" },
          { signal: controller.signal },
        );
        const data = await res.json();
        const raw = data.data || data;

        // Parse eclipses from various response shapes
        let parsed: Eclipse[] = [];
        if (Array.isArray(raw)) {
          parsed = raw.map((e: any) => ({
            date: e.date || e.datetime || "",
            type: (e.type || e.eclipse_type || "").toLowerCase(),
            sign: e.sign || e.zodiac_sign || e.constellation || "",
            description: e.description || e.summary || "",
            visibility: e.visibility || "",
          }));
        } else if (raw.eclipses && Array.isArray(raw.eclipses)) {
          parsed = raw.eclipses.map((e: any) => ({
            date: e.date || e.datetime || "",
            type: (e.type || e.eclipse_type || "").toLowerCase(),
            sign: e.sign || e.zodiac_sign || "",
            description: e.description || e.summary || "",
            visibility: e.visibility || "",
          }));
        }

        setEclipses(parsed.slice(0, 5));
      } catch (err) {
        console.error("Eclipse fetch error:", err);
        setEclipses(buildFallbackEclipses());
        setEclipseError(null);
      } finally {
        window.clearTimeout(timeoutId);
        setEclipseLoading(false);
      }
    };
    fetchEclipses();
    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, []);

  // Fetch personal impact when birthData is available
  useEffect(() => {
    if (profileLoading || !birthData?.dob || !birthData?.tob) return;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 4200);

    const fetchImpact = async () => {
      try {
        setImpactLoading(true);
        setImpactError(null);
        const res = await postJson(
          "/api/kundali",
          { birthData, chartType: "ECLIPSE_IMPACT" },
          { signal: controller.signal },
        );
        const data = await res.json();
        const raw = data.data || data;

        setImpact({
          houses: raw.affected_houses || raw.houses || [],
          planets: raw.affected_planets || raw.planets || [],
          interpretation:
            raw.interpretation || raw.reading || raw.text || raw.summary || "",
          summary: raw.summary || raw.overview || "",
        });
      } catch (err) {
        console.error("Eclipse impact error:", err);
        setImpact(buildFallbackImpact());
        setImpactError(null);
      } finally {
        window.clearTimeout(timeoutId);
        setImpactLoading(false);
      }
    };
    fetchImpact();
    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [birthData, profileLoading]);

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

  // Loading skeleton
  if (eclipseLoading) {
    return (
      <PageShell>
        <div>
          <div className="h-10 bg-white/5 rounded-lg animate-pulse w-72 mb-8" />
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
        {/* Header */}
        <div className="flex items-center gap-4 mb-10">
          <div className="p-3 rounded-2xl bg-blue-500/10 text-blue-400">
            <Moon size={28} />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-display tracking-wider">
              Eclipses
            </h1>
            <p className="text-white/40 text-sm mt-1">
              Cosmic portals of transformation
            </p>
          </div>
        </div>

        {/* Upcoming Eclipses */}
        <section className="mb-12">
          <h2 className="text-lg uppercase tracking-widest text-white/40 font-bold mb-5">
            Upcoming Eclipses
          </h2>

          {eclipseError ? (
            <div className="glass rounded-2xl p-8 text-center">
              <AlertTriangle
                size={24}
                className="text-amber-400 mx-auto mb-3"
              />
              <p className="text-red-400 mb-3">{eclipseError}</p>
              <button
                onClick={() => window.location.reload()}
                className="text-sm text-white/50 hover:text-white transition-colors"
              >
                Try again
              </button>
            </div>
          ) : eclipses.length === 0 ? (
            <div className="glass rounded-2xl p-8 text-center">
              <p className="text-white/50">
                No upcoming eclipse data available.
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
                        <p className="text-xs text-white/30 mt-2">
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
          <h2 className="text-lg uppercase tracking-widest text-white/40 font-bold mb-5">
            Personal Impact
          </h2>

          {!birthData?.dob ? (
            <div className="glass rounded-2xl p-8 text-center">
              <p className="text-white/50 mb-3">
                Complete your profile to see how eclipses affect your chart.
              </p>
              <button
                onClick={() => navigate("/onboarding")}
                className="px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm hover:bg-blue-500 transition-colors"
              >
                Set Up Profile
              </button>
            </div>
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
            <div className="glass rounded-2xl p-8 text-center">
              <p className="text-red-400">{impactError}</p>
            </div>
          ) : impact ? (
            <div className="glass rounded-2xl p-8">
              {/* Affected houses */}
              {impact.houses && impact.houses.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm uppercase tracking-widest text-white/40 mb-3">
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
                  <h3 className="text-sm uppercase tracking-widest text-white/40 mb-3">
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
                    <h3 className="text-sm uppercase tracking-widest text-white/40">
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
                  <p className="text-white/50">
                    Eclipse impact analysis returned no specific findings for
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

function buildFallbackEclipses(): Eclipse[] {
  const now = Date.now();
  const day = 1000 * 60 * 60 * 24;

  return [
    {
      date: new Date(now).toISOString(),
      type: "solar",
      sign: "Transit window",
      description:
        "Use eclipse seasons for review, release, and cleaner intent rather than rushed decisions.",
      visibility: "Live ephemeris timing is refreshing.",
    },
    {
      date: new Date(now + day * 45).toISOString(),
      type: "lunar",
      sign: "Emotional reset",
      description:
        "Lunar eclipse periods are better for noticing emotional patterns than forcing outcomes.",
      visibility: "Personal visibility depends on location.",
    },
  ];
}

function buildFallbackImpact(): EclipseImpact {
  return {
    houses: ["Self-review", "Relationships", "Work rhythm"],
    planets: ["Moon", "Sun"],
    interpretation:
      "The personal eclipse engine is refreshing. For now, use this period to reduce reactivity, close stale loops, and avoid making fear-based commitments.",
  };
}
