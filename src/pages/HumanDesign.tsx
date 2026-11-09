import { useState, useEffect } from "react";
import { postJson } from "../lib/apiFetch";
import { useUserProfile } from "../hooks";
import { useRequestBirthData } from "../hooks/useRequestBirthData";
import { Loader2, Hexagon } from "lucide-react";
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

export default function HumanDesign() {
  const { birthData, loading: profileLoading } = useUserProfile();
  const requestBirthData = useRequestBirthData(birthData);
  const [hdType, setHdType] = useState<any>(null);
  const [bodygraph, setBodygraph] = useState<any>(null);
  const [typeError, setTypeError] = useState(false);
  const [graphError, setGraphError] = useState(false);
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
    setTypeError(false);
    setGraphError(false);
    Promise.allSettled([
      fetchChart(requestBirthData, "HUMAN_DESIGN", controller.signal),
      fetchChart(requestBirthData, "BODYGRAPH", controller.signal),
    ]).then(([typeRes, graphRes]) => {
      if (controller.signal.aborted) return;
      if (typeRes.status === "fulfilled") setHdType(typeRes.value);
      else {
        console.error("Human Design type failed:", typeRes.reason);
        setHdType(null);
        setTypeError(true);
      }
      if (graphRes.status === "fulfilled") setBodygraph(graphRes.value);
      else {
        console.error("Bodygraph failed:", graphRes.reason);
        setBodygraph(null);
        setGraphError(true);
      }
      setLoading(false);
    });

    return () => controller.abort();
  }, [requestBirthData, profileLoading, attempt]);

  return (
    <PageShell>
        <h1 className="type-page-title mb-2 flex items-center gap-3">
          <Hexagon size={28} className="text-gold" /> Human Design
        </h1>
        <p className="text-white/60 mb-8">Discover your energetic blueprint</p>

        {profileLoading ? (
          <div className="flex items-center justify-center py-20" aria-busy="true">
            <Loader2 size={32} className="animate-spin text-white/30" />
          </div>
        ) : !requestBirthData?.dob ? (
          <BirthProfileRequired
            title="Create your birth profile to see your Human Design."
            description="Your type, authority, profile, gates, and bodygraph need birth details before the system can calculate them."
          />
        ) : loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={32} className="animate-spin text-white/30" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Type & Strategy */}
            <div className="glass rounded-[2rem] p-6">
              <h2 className="text-gold text-sm font-bold uppercase tracking-widest mb-4">
                Your Type
              </h2>
              {typeError ? (
                <StatusNotice size="section"
                  message="Your type, strategy and authority couldn't be calculated. Check your connection and try again."
                  onRetry={retry}
                />
              ) : hdType && txt(hdType.type || hdType.human_design_type) ? (
                <div className="space-y-4">
                  <div>
                    <span className="text-3xl font-display">
                      {txt(hdType.type || hdType.human_design_type)}
                    </span>
                  </div>
                  {(txt(hdType.strategy) || txt(hdType.authority) || txt(hdType.profile)) && (
                    <div className="grid grid-cols-1 gap-3">
                      {txt(hdType.strategy) && (
                        <div className="p-3 rounded-xl bg-white/5">
                          <span className="text-xs text-white/55 uppercase tracking-widest">
                            Strategy
                          </span>
                          <p className="text-sm text-white/80 mt-1">
                            {txt(hdType.strategy)}
                          </p>
                        </div>
                      )}
                      {txt(hdType.authority) && (
                        <div className="p-3 rounded-xl bg-white/5">
                          <span className="text-xs text-white/55 uppercase tracking-widest">
                            Authority
                          </span>
                          <p className="text-sm text-white/80 mt-1">
                            {txt(hdType.authority)}
                          </p>
                        </div>
                      )}
                      {txt(hdType.profile) && (
                        <div className="p-3 rounded-xl bg-white/5">
                          <span className="text-xs text-white/55 uppercase tracking-widest">
                            Profile
                          </span>
                          <p className="text-sm text-white/80 mt-1">
                            {txt(hdType.profile)}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                  {txt(hdType.description) && (
                    <p className="text-white/65 text-sm leading-relaxed">
                      {txt(hdType.description)}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-white/60">
                  The calculation returned no Human Design type for your birth details.
                </p>
              )}
            </div>

            {/* Bodygraph Centers */}
            <div className="glass rounded-[2rem] p-6">
              <h2 className="text-gold text-sm font-bold uppercase tracking-widest mb-4">
                Energy Centers
              </h2>
              {graphError ? (
                <StatusNotice size="section"
                  message="Your energy centers couldn't be calculated. Check your connection and try again."
                  onRetry={retry}
                />
              ) : Array.isArray(bodygraph?.centers) || (bodygraph?.defined_centers && typeof bodygraph.defined_centers === "object") ? (
                <div className="space-y-2">
                  {(
                    (Array.isArray(bodygraph.centers) ? bodygraph.centers : null) ||
                    Object.entries(bodygraph.defined_centers || {}).map(
                      ([k, v]: any) => ({ name: k, defined: v }),
                    )
                  ).map((c: any, i: number) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-3 rounded-xl bg-white/5"
                    >
                      <span className="text-sm text-white/80">
                        {txt(c?.name) || txt(c?.center)}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${c.defined || c.is_defined ? "bg-gold/20 text-gold" : "bg-white/10 text-white/60"}`}
                      >
                        {c.defined || c.is_defined ? "Defined" : "Open"}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-white/60">
                  The calculation returned no energy center data for your birth details.
                </p>
              )}
            </div>
          </div>
        )}
      </PageShell>
  );
}
