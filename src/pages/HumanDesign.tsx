import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUserProfile } from "../hooks";
import { Loader2, ArrowLeft, Hexagon } from "lucide-react";
import Header from "../components/layout/Header";

export default function HumanDesign() {
  const navigate = useNavigate();
  const { birthData, loading: profileLoading } = useUserProfile();
  const [hdType, setHdType] = useState<any>(null);
  const [bodygraph, setBodygraph] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!birthData?.dob) return;
    setLoading(true);
    Promise.all([
      fetch("/api/kundali", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ birthData, chartType: "HUMAN_DESIGN" }),
      })
        .then((r) => r.json())
        .catch(() => null),
      fetch("/api/kundali", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ birthData, chartType: "BODYGRAPH" }),
      })
        .then((r) => r.json())
        .catch(() => null),
    ]).then(([typeRes, graphRes]) => {
      setHdType(typeRes?.data);
      setBodygraph(graphRes?.data);
      setLoading(false);
    });
  }, [birthData?.dob]);

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

        {loading ? (
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
                <p className="text-white/40 text-sm">Type data unavailable</p>
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
                <p className="text-white/40 text-sm">
                  Bodygraph data unavailable
                </p>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
