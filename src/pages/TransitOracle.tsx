import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  Compass,
  Clock,
  Calendar as CalendarIcon,
  Info,
  Sparkles,
} from "lucide-react";
import { useHeaderScroll } from "../hooks";
import TransitOverlay from "../components/astrology/TransitOverlay";
import TransitPredictions from "../components/astrology/TransitPredictions";
import { useTransit } from "../hooks/useTransit";

export default function TransitOracle() {
  const navigate = useNavigate();
  const { isVisible } = useHeaderScroll();
  const [currentDate] = useState(new Date());
  const { data, predictions, aiSummary, loading, error } = useTransit();

  // Format date for display
  const formattedDate = currentDate.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="min-h-screen bg-[#030308] text-white selection:bg-gold/30 font-sans">
      {/* Background Ambiance */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-[60vw] h-[60vw] bg-blue-600/10 blur-[150px] rounded-full animate-pulse" />
        <div
          className="absolute bottom-0 right-1/4 w-[50vw] h-[50vw] bg-gold/5 blur-[150px] rounded-full animate-pulse"
          style={{ animationDelay: "3s" }}
        />

        {/* Star Field Effect */}
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `radial-gradient(circle at center, #ffffff 1px, transparent 1px)`,
            backgroundSize: "100px 100px",
          }}
        />
      </div>

      {/* Header */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-700 ease-in-out ${isVisible ? "translate-y-0" : "-translate-y-full"
          } bg-black/40 backdrop-blur-xl border-b border-white/5`}
      >
        <div className="container mx-auto px-6 h-20 flex items-center justify-between">
          <button
            onClick={() => navigate("/dashboard")}
            className="group flex items-center gap-3 text-white/40 hover:text-white transition-colors"
          >
            <div className="p-2 rounded-full border border-white/5 group-hover:border-gold/30 transition-colors">
              <ChevronLeft size={20} />
            </div>
            <span className="text-xs font-black uppercase tracking-[0.3em]">
              Dashboard
            </span>
          </button>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex flex-col items-end">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gold/60">
                Celestial Status
              </span>
            </div>
            <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-gold/10 border border-gold/20">
              <Compass className="text-gold animate-spin-slow" size={24} />
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto pt-32 pb-20 relative z-10">
        {/* Title Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-8">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-black uppercase tracking-[0.2em] mb-4">
              <Clock size={12} /> Live Planetary Movements
            </div>
            <h1 className="text-5xl md:text-6xl font-display tracking-tight mb-6">
              Transit <span className="text-gold">Oracle</span>
            </h1>
            <p className="text-lg text-white/60 leading-relaxed font-light font-sans max-w-xl">
              Observe the dance of the cosmos as planets move through your birth
              houses in real-time. Understand the current celestial energies
              shaping your path.
            </p>
          </div>

          <div className="glass p-6 rounded-3xl border border-white/10 flex flex-col gap-2 min-w-[240px]">
            <div className="flex items-center gap-2 text-gold">
              <CalendarIcon size={16} />
              <span className="text-[10px] uppercase font-black tracking-widest">
                Current Insight Date
              </span>
            </div>
            <div className="text-lg font-display tracking-wide">
              {formattedDate}
            </div>
            <div className="mt-2 text-[10px] text-white/30 uppercase tracking-[0.2em]">
              Updates Automatically
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-10 gap-8 items-start">
          {/* Left Column: Visual Chart */}
          <div className="lg:col-span-5 space-y-8">
            <div className="glass rounded-[3rem] border border-white/10 p-2 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <Compass size={100} className="text-white" />
              </div>

              <div className="relative z-10">
                <div className="flex items-center ml-8 mt-8 justify-between">
                  <div>
                    <h3 className="text-sm font-black tracking-[0.3em] text-white/60 mb-1">
                      Spatial Distribution
                    </h3>
                    <p className="text-xs text-white/30 italic">
                      Lagna-centric House Mapping
                    </p>
                  </div>
                </div>

                <div className=" mx-auto">
                  {loading ? (
                    <div className="aspect-square flex items-center justify-center">
                      <Compass
                        className="animate-spin-slow text-gold opacity-20"
                        size={100}
                      />
                    </div>
                  ) : error ? (
                    <div className="aspect-square flex items-center justify-center text-center p-12">
                      <div className="p-8 rounded-3xl bg-red-500/5 border border-red-500/20">
                        <Info className="mx-auto mb-4 text-red-400" size={32} />
                        <p className="text-red-400 text-sm">{error}</p>
                      </div>
                    </div>
                  ) : (
                    <TransitOverlay data={data} className="scale-90 mx-auto" />
                  )}
                </div>
              </div>
            </div>

            {/* Educational Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="glass p-6 rounded-3xl border border-white/5 space-y-4">
                <h4 className="text-sm font-black uppercase tracking-widest text-white/80">
                  House Transits
                </h4>
                <p className="text-xs text-white/40 leading-relaxed font-sans font-light">
                  Planets entering a house illuminate specific areas of your
                  life—from identity in the 1st to career in the 10th.
                </p>
              </div>
              <div className="glass p-6 rounded-3xl border border-white/5 space-y-4">
                <h4 className="text-sm font-black uppercase tracking-widest text-white/80">
                  Aspect Geometry
                </h4>
                <p className="text-xs text-white/40 leading-relaxed font-sans font-light">
                  The angles between moving planets and your natal points create
                  temporary energy flows that manifest as events.
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Interpretation */}
          <div className="lg:col-span-5 space-y-8">
            {/* Gemini Summary Section */}
            <div className="flex flex-col gap-4">
              <h3 className="text-sm font-black uppercase tracking-[0.3em] text-gold/60 mb-2 px-2 flex items-center gap-2">
                <Sparkles size={14} className="text-gold" /> Cosmic Summary
              </h3>

              <div className="glass p-6 rounded-[2.5rem] border border-gold/20 bg-gold/5 relative overflow-hidden group">
                {/* Background Decoration */}
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                  <Sparkles size={60} className="text-gold" />
                </div>

                <div className="relative z-10">
                  <AnimatePresence mode="wait">
                    {loading ? (
                      <motion.div
                        key="loading"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex flex-col gap-3"
                      >
                        <div className="h-4 w-3/4 bg-gold/10 rounded-full animate-pulse" />
                        <div className="h-4 w-1/2 bg-gold/10 rounded-full animate-pulse" />
                      </motion.div>
                    ) : aiSummary ? (
                      <motion.div
                        key="summary"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-4"
                      >
                        <p className="text-lg font-sans font-light leading-relaxed text-white/90 italic">
                          "{aiSummary}"
                        </p>
                        <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                          <div className="w-6 h-6 rounded-full bg-gold/20 flex items-center justify-center">
                            <Sparkles size={12} className="text-gold" />
                          </div>
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gold/60">
                            AI Oracle Insight
                          </span>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.p
                        key="fallback"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-sm text-white/40 italic"
                      >
                        The stars are aligning. Your summary will appear shortly.
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <h3 className="text-sm font-black uppercase tracking-[0.3em] text-white/60 mb-2 px-2">
                Transit Analysis
              </h3>

              <div className="overflow-y-auto max-h-[755px] pr-2 custom-scrollbar">
                <TransitPredictions
                  predictions={predictions || []}
                  fallbackAspects={data?.chart_data?.aspects}
                  loading={loading}
                />
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Aesthetic Footer decoration */}
      <div className="fixed bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#030308] to-transparent pointer-events-none z-20" />
    </div>
  );
}
