import { useState, useEffect } from "react";
import { postJson } from "../lib/apiFetch";
import { useNavigate } from "react-router-dom";
import { useUserProfile } from "../hooks";
import { useRequestBirthData } from "../hooks/useRequestBirthData";
import { Loader2, ArrowLeft, Hexagon } from "lucide-react";
import Header from "../components/layout/Header";
import BirthProfileRequired from "../components/BirthProfileRequired";

export default function HumanDesign() {
  const navigate = useNavigate();
  const { birthData } = useUserProfile();
  const requestBirthData = useRequestBirthData(birthData);
  const [hdType, setHdType] = useState<any>(null);
  const [bodygraph, setBodygraph] = useState<any>(null);
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
      postJson("/api/kundali", { birthData: requestBirthData, chartType: "HUMAN_DESIGN" }, { signal: controller.signal })
        .then((r) => r.json())
        .catch(() => null),
      postJson("/api/kundali", { birthData: requestBirthData, chartType: "BODYGRAPH" }, { signal: controller.signal })
        .then((r) => r.json())
        .catch(() => null),
    ]).then(([typeRes, graphRes]) => {
      setHdType(typeRes?.data);
      setBodygraph(graphRes?.data);
      window.clearTimeout(timeoutId);
      setLoading(false);
    });

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [requestBirthData]);

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
        <h1 className="text-3xl md:text-4xl font-display mb-2 flex items-center gap-3">
          <Hexagon size={28} className="text-gold" /> Human Design
        </h1>
        <p className="text-white/50 mb-8">Discover your energetic blueprint</p>

        {!requestBirthData?.dob ? (
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
              {hdType ? (
                <div className="space-y-4">
                  <div>
                    <span className="text-3xl font-display">
                      {hdType.type || hdType.human_design_type || "—"}
                    </span>
                  </div>
                  {(hdType.strategy || hdType.authority || hdType.profile) && (
                    <div className="grid grid-cols-1 gap-3">
                      {hdType.strategy && (
                        <div className="p-3 rounded-xl bg-white/5">
                          <span className="text-[10px] text-white/30 uppercase tracking-widest">
                            Strategy
                          </span>
                          <p className="text-sm text-white/80 mt-1">
                            {hdType.strategy}
                          </p>
                        </div>
                      )}
                      {hdType.authority && (
                        <div className="p-3 rounded-xl bg-white/5">
                          <span className="text-[10px] text-white/30 uppercase tracking-widest">
                            Authority
                          </span>
                          <p className="text-sm text-white/80 mt-1">
                            {hdType.authority}
                          </p>
                        </div>
                      )}
                      {hdType.profile && (
                        <div className="p-3 rounded-xl bg-white/5">
                          <span className="text-[10px] text-white/30 uppercase tracking-widest">
                            Profile
                          </span>
                          <p className="text-sm text-white/80 mt-1">
                            {hdType.profile}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                  {hdType.description && (
                    <p className="text-white/60 text-sm leading-relaxed">
                      {hdType.description}
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {['Type', 'Strategy', 'Authority', 'Profile'].map((item) => (
                    <div key={item} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                      <span className="text-[10px] uppercase tracking-widest text-white/30">{item}</span>
                      <p className="mt-1 text-sm text-white/60">Live calculation refreshing from your birth profile.</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Bodygraph Centers */}
            <div className="glass rounded-[2rem] p-6">
              <h2 className="text-gold text-sm font-bold uppercase tracking-widest mb-4">
                Energy Centers
              </h2>
              {bodygraph?.centers || bodygraph?.defined_centers ? (
                <div className="space-y-2">
                  {(
                    bodygraph.centers ||
                    Object.entries(bodygraph.defined_centers || {}).map(
                      ([k, v]: any) => ({ name: k, defined: v }),
                    )
                  ).map((c: any, i: number) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-3 rounded-xl bg-white/5"
                    >
                      <span className="text-sm text-white/80">
                        {c.name || c.center}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${c.defined || c.is_defined ? "bg-gold/20 text-gold" : "bg-white/10 text-white/40"}`}
                      >
                        {c.defined || c.is_defined ? "Defined" : "Open"}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid gap-2">
                  {['Head', 'Ajna', 'Throat', 'G Center', 'Sacral'].map((center) => (
                    <div key={center} className="flex items-center justify-between rounded-xl bg-white/5 p-3">
                      <span className="text-sm text-white/70">{center}</span>
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/40">Pending</span>
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
