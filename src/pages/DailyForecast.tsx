import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Sparkles,
  Sun,
  Clock,
  Star,
  Calendar,
  Zap,
  Target,
  MessageCircle,
  Activity,
  Heart,
  Briefcase,
  Shield,
} from "lucide-react";
import { useUserProfile } from "../hooks";
import { FullPageSkeleton } from "../components/ui/Skeleton";
import type { ForecastData } from "../types";

const getAreaIcon = (area: string) => {
  switch (area.toLowerCase()) {
    case "love":
      return <Heart size={20} />;
    case "career":
      return <Briefcase size={20} />;
    case "finance":
      return <Shield size={20} />;
    case "health":
      return <Activity size={20} />;
    case "communication":
      return <MessageCircle size={20} />;
    case "identity":
      return <Target size={20} />;
    default:
      return <Sparkles size={20} />;
  }
};

const getAreaColor = (area: string) => {
  switch (area.toLowerCase()) {
    case "love":
      return "text-rose-400 bg-rose-400/10 border-rose-400/20";
    case "career":
      return "text-blue-400 bg-blue-400/10 border-blue-400/20";
    case "finance":
      return "text-emerald-400 bg-emerald-400/10 border-emerald-400/20";
    case "health":
      return "text-cyan-400 bg-cyan-400/10 border-cyan-400/20";
    case "communication":
      return "text-amber-400 bg-amber-400/10 border-amber-400/20";
    case "identity":
      return "text-violet-400 bg-violet-400/10 border-violet-400/20";
    default:
      return "text-gold bg-gold/10 border-gold/20";
  }
};

const DailyForecast: React.FC = () => {
  const navigate = useNavigate();
  const { birthData, loading: profileLoading } = useUserProfile();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forecast, setForecast] = useState<ForecastData | null>(null);

  useEffect(() => {
    const fetchForecast = async () => {
      if (!birthData) return;

      try {
        setLoading(true);
        const response = await fetch("/.netlify/functions/horoscope", {
          method: "POST",
          body: JSON.stringify({
            birthData,
            date: new Date().toISOString().split("T")[0],
          }),
        });

        if (!response.ok) throw new Error("Failed to fetch forecast");
        const data = await response.json();
        setForecast(data);
      } catch (err: any) {
        console.error("Error fetching forecast:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (!profileLoading && birthData) {
      fetchForecast();
    }
  }, [birthData, profileLoading]);

  if (profileLoading || loading) return <FullPageSkeleton />;

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const h = forecast?.horoscope;

  return (
    <div className="min-h-screen bg-[#030308] text-white selection:bg-gold/30 font-serif pb-20">
      {/* Background Ambiance */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-gold/5 blur-[120px] rounded-full animate-pulse-slow"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-violet-500/5 blur-[120px] rounded-full"></div>
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-6 py-12">
        {/* Header */}
        <button
          onClick={() => navigate("/dashboard")}
          className="flex items-center gap-2 text-white/40 hover:text-gold transition-colors mb-12 group font-sans"
        >
          <ArrowLeft
            size={18}
            className="group-hover:-translate-x-1 transition-transform"
          />
          <span className="text-xs font-black uppercase tracking-widest">
            Back to Dashboard
          </span>
        </button>

        <header className="mb-16">
          <h1 className="text-4xl md:text-6xl font-light mb-6 text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-white/40 leading-tight">
            Your Daily Forecast
          </h1>
          <div className="flex flex-wrap items-center gap-6 text-white/40 font-sans italic text-sm">
            <div className="flex items-center gap-2">
              <Calendar size={14} />
              {today}
            </div>
            {h?.overall_rating && (
              <div className="flex items-center gap-2 non-italic font-sans text-xs font-bold bg-white/5 border border-white/10 px-3 py-1 rounded-full text-gold">
                Overall Alignment: {h.overall_rating}/5
              </div>
            )}
          </div>
        </header>

        {error ? (
          <div className="glass p-8 rounded-3xl border border-red-500/20 text-center">
            <p className="text-red-400 mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-white/5 hover:bg-white/10 rounded-full text-xs font-bold transition-all border border-white/10"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            {/* The Daily Pulse (Theme) */}
            <div className="glass p-8 md:p-12 rounded-[2.5rem] border border-white/5 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                <Sun size={120} className="text-gold" />
              </div>

              <div className="relative z-10">
                <div className="flex items-center gap-3 text-gold mb-8 font-sans">
                  <span className="w-8 h-[1px] bg-gold/30"></span>
                  <span className="text-[10px] font-black uppercase tracking-widest">
                    Today's Theme
                  </span>
                </div>

                <p className="text-xl leading-relaxed text-white/90 font-light italic mb-2 first-letter:text-6xl first-letter:font-bold first-letter:text-gold first-letter:mr-3 first-letter:float-left">
                  {forecast?.narrative ||
                    h?.overall_theme ||
                    "The stars are aligning for your day. Focus on balance and intuitive steps forward."}
                </p>
              </div>
            </div>

            {/* Planetary Influences (Transit Activations) */}
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">
                <div className="flex items-center gap-4 mb-8">
                  <h2 className="text-xl font-light tracking-wide">
                    Transit Activations
                  </h2>
                  <div className="h-[1px] flex-grow bg-white/5"></div>
                </div>
                <div className="space-y-4">
                  {h?.planetary_influences?.map((inf, idx) => (
                    <div
                      key={idx}
                      className="glass p-6 rounded-3xl border border-white/5 flex gap-6 items-center group"
                    >
                      <div className="shrink-0 w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-gold group-hover:scale-110 transition-transform">
                        <Zap size={20} />
                      </div>
                      <div className="flex-grow">
                        <div className="flex justify-between items-center mb-1">
                          <h4 className="text-sm font-bold font-sans text-white/90 uppercase tracking-widest">
                            {inf.planet} Natal {inf.natal_planet}
                          </h4>
                          <span className="text-[10px] font-bold text- gold/60 bg-gold/5 px-2 py-0.5 rounded-full border border-gold/10">
                            Strength: {inf.strength}
                          </span>
                        </div>
                        <p className="text-xs text-white/40 font-sans font-light leading-relaxed italic">
                          {inf.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sidebar: Dasha & Lucky Elements */}
              <div className="space-y-8">
                {/* Dasha Block */}
                <div className="glass p-6 rounded-[2rem] border border-violet-500/20 bg-violet-500/5">
                  <div className="flex items-center gap-3 text-violet-400 mb-6 font-sans">
                    <Clock size={16} />
                    <span className="text-[10px] font-black uppercase tracking-widest">
                      Active Life Cycle
                    </span>
                  </div>
                  <div className="mb-4">
                    <div className="text-[10px] text-white/30 uppercase tracking-[0.2em] mb-1 font-sans">
                      Mahadasha
                    </div>
                    <div className="text-xl font-light text-violet-200">
                      {forecast?.dasha?.mahadasha}
                    </div>
                  </div>
                  <div className="mb-6">
                    <div className="text-[10px] text-white/30 uppercase tracking-[0.2em] mb-1 font-sans">
                      Antardasha
                    </div>
                    <div className="text-xl font-light text-violet-300">
                      {forecast?.dasha?.bhukti}
                    </div>
                  </div>
                  <div className="pt-4 border-t border-violet-500/10 flex items-center justify-between text-[10px] font-sans">
                    <span className="text-white/30">Phase Ends</span>
                    <span className="text-violet-400/80 font-bold">
                      {forecast?.dasha?.ends
                        ? new Date(forecast.dasha.ends).toLocaleDateString()
                        : "N/A"}
                    </span>
                  </div>
                </div>

                {/* Lucky Elements */}
                <div className="glass p-6 rounded-[2rem] border border-white/5">
                  <div className="flex items-center gap-3 text-gold mb-6 font-sans">
                    <Star size={16} />
                    <span className="text-[10px] font-black uppercase tracking-widest">
                      Lucky Elements
                    </span>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-white/30 uppercase tracking-widest font-sans">
                        Colors
                      </span>
                      <div className="flex gap-2">
                        {h?.lucky_elements?.colors?.map((c, i) => (
                          <span key={i} className="text-xs text-white/70">
                            {c}
                            {i < h.lucky_elements.colors.length - 1 ? "," : ""}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-white/30 uppercase tracking-widest font-sans">
                        Numbers
                      </span>
                      <span className="text-xs text-white/70">
                        {h?.lucky_elements?.numbers?.join(", ")}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-white/30 uppercase tracking-widest font-sans">
                        Stones
                      </span>
                      <span className="text-xs text-white/70 italic">
                        {h?.lucky_elements?.stones?.join(", ")}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-white/30 uppercase tracking-widest font-sans">
                        Directions
                      </span>
                      <span className="text-xs text-white/70 uppercase tracking-widest">
                        {h?.lucky_elements?.directions?.join(", ")}
                      </span>
                    </div>
                  </div>

                  <div className="mt-8 pt-6 border-t border-white/5">
                    <div className="text-[10px] text-white/30 uppercase tracking-widest font-sans mb-3">
                      Auspicious Times
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {h?.lucky_elements?.times?.map((t, i) => (
                        <span
                          key={i}
                          className="bg-white/5 border border-white/10 px-2 py-1 rounded-lg text-xs font-sans text-gold/80"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Tips Section */}
            {h?.tips && h.tips.length > 0 && (
              <section className="glass p-8 rounded-[2.5rem] border border-emerald-500/10 bg-emerald-500/[0.02]">
                <div className="flex items-center gap-3 text-emerald-400 mb-6 font-sans">
                  <Sparkles size={16} />
                  <span className="text-[10px] font-black uppercase tracking-widest">
                    Celestial Guidance
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {h.tips.map((tip, i) => (
                    <div key={i} className="flex gap-3 items-start">
                      <div className="w-1 h-1 rounded-full bg-emerald-400 mt-2 shrink-0"></div>
                      <p className="text-sm text-white/70 font-sans font-light leading-relaxed italic">
                        {tip}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Life Areas Grid */}
            <section>
              <div className="flex items-center gap-4 mb-8">
                <h2 className="text-xl font-light tracking-wide">Life Areas</h2>
                <div className="h-[1px] flex-grow bg-white/5"></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {h?.life_areas?.map((area, idx) => (
                  <div
                    key={idx}
                    className="glass p-6 rounded-[2rem] border border-white/5 hover:border-white/10 transition-all group flex flex-col"
                  >
                    <div className="flex justify-between items-start mb-6">
                      <div
                        className={`p-3 rounded-2xl border ${getAreaColor(
                          area.area
                        )}`}
                      >
                        {getAreaIcon(area.area)}
                      </div>
                      <div className="flex gap-1">
                        {[...Array(5)].map((_, i) => (
                          <div
                            key={i}
                            className={`w-1.5 h-1.5 rounded-full ${
                              i < area.rating ? "bg-gold" : "bg-white/10"
                            }`}
                          ></div>
                        ))}
                      </div>
                    </div>
                    <h3 className="text-lg font-medium text-white/90 mb-2 font-sans tracking-tight">
                      {area.title}
                    </h3>
                    <p className="text-xs text-white/50 leading-relaxed font-sans font-light mb-auto">
                      {area.prediction}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-6">
                      {area.keywords.map((kw, kidx) => (
                        <span
                          key={kidx}
                          className="text-[9px] font-black uppercase tracking-tighter text-white/30 bg-white/5 px-2 py-0.5 rounded-md border border-white/5"
                        >
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Wisdom Footer */}
            <div className="text-center py-12 border-t border-white/5">
              <p className="text-white/20 text-[10px] uppercase tracking-[0.3em] font-light font-sans max-w-md mx-auto leading-relaxed">
                As above, so below. Infinite wisdom is yours.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DailyForecast;
