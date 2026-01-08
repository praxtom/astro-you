import { useState, useEffect } from "react";
import {
  Heart,
  Sparkles,
  ChevronRight,
  User,
  Speech,
  Zap,
  Clock,
  ShieldCheck,
  Target,
  BookOpen,
} from "lucide-react";
import Header from "../components/layout/Header";
import { useUserProfile } from "../hooks";
import LocationInput from "../components/LocationInput";

interface LoveInfluence {
  sign: string;
  house: number | string;
  expression?: string;
  emotional_needs?: string;
  passion_style?: string;
  gift_giving_style?: string;
  comfort_style?: string;
  conflict_approach?: string;
}

interface MatchResult {
  overall_score: number;
  compatibility_score: number;
  report_title?: string;
  compatibility?: {
    overall_score: number;
    breakdown: Record<string, number>;
    interpretation: string;
  };
  synastry: {
    emotional_connection?: number;
    communication_style?: number;
    physical_attraction?: number;
    long_term_potential?: number;
    key_aspects?: string[];
    subjects_summary?: any;
  };
  composite: {
    relationship_purpose: string;
    strengths: string[];
    challenges: string[];
    sun_sign?: string;
    moon_sign?: string;
    venus_sign?: string;
  };
  love_languages?: {
    person1?: {
      primary_love_language?: string;
      secondary_love_language?: string;
      receiving_style?: string;
      venus_influence?: LoveInfluence;
      moon_influence?: LoveInfluence;
      mars_influence?: LoveInfluence;
      compatibility_tips?: string[];
      romantic_tendencies?: string[];
    };
    person2?: {
      primary_love_language?: string;
      secondary_love_language?: string;
      receiving_style?: string;
      venus_influence?: LoveInfluence;
      moon_influence?: LoveInfluence;
      mars_influence?: LoveInfluence;
      compatibility_tips?: string[];
      romantic_tendencies?: string[];
    };
  };
  dynamics?: {
    relationship_type?: { type: string; interpretation: string };
    power_dynamics?: { balance: string; interpretation: string };
    emotional_connection?: { strength: string; interpretation: string };
    communication_style?: { style: string; interpretation: string };
    long_term_potential?: { potential: string; interpretation: string };
  };
  sections?: {
    title: string;
    interpretations: { factor: string; text: string }[];
  }[];
  interpretations?: {
    title: string;
    text: string;
  }[];
}

// Max points lookup for the compatibility breakdown (Sums to 100)
const BREAKDOWN_MAX_POINTS: Record<string, number> = {
  sun_moon: 15,
  mercury: 10,
  attraction: 10,
  saturn: 10,
  elements: 10,
  aspects: 40,
  house_overlays: 5,
};

const normalizeScore = (value: number, key: string) => {
  const max = BREAKDOWN_MAX_POINTS[key] || 10; // Fallback to 10 if unknown
  return Math.round((value / max) * 100);
};

export default function Compatibility() {
  const { birthData } = useUserProfile();
  const [partnerData, setPartnerData] = useState({
    name: "",
    dob: "1995-01-01",
    tob: "12:00",
    pob: "",
  });

  const [seekerCoords, setSeekerCoords] = useState<{
    lat: number;
    lon: number;
  } | null>(null);
  const [partnerCoords, setPartnerCoords] = useState<{
    lat: number;
    lon: number;
  } | null>(null);

  const [isMatching, setIsMatching] = useState(false);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Auto-set seeker coords from birthData if available
  useEffect(() => {
    if (birthData?.coordinates?.lat && birthData?.coordinates?.lng) {
      setSeekerCoords({
        lat: Number(birthData.coordinates.lat),
        lon: Number(birthData.coordinates.lng),
      });
    }
  }, [birthData]);

  const handleMatch = async () => {
    if (!birthData) return;
    setIsMatching(true);
    setError(null);

    try {
      const response = await fetch("/.netlify/functions/compatibility", {
        method: "POST",
        body: JSON.stringify({
          maleData: {
            name: birthData.name || "Seeker",
            dob: birthData.dob,
            tob: birthData.tob || "12:00",
            pob: birthData.pob || "Mumbai, India",
            lat: seekerCoords?.lat,
            lng: seekerCoords?.lon,
          },
          femaleData: {
            ...partnerData,
            lat: partnerCoords?.lat,
            lng: partnerCoords?.lon,
          },
        }),
      });

      const data = await response.json();
      console.log("[Compatibility] Match Data:", data);
      if (data.error) throw new Error(data.error);
      setMatchResult(data);
    } catch (err: any) {
      setError(
        err.message || "Failed to analyze compatibility. Please try again."
      );
    } finally {
      setIsMatching(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#030308] text-white selection:bg-gold/30">
      <Header />

      <main className="container mx-auto pt-32 px-6 pb-24 relative z-10">
        <header className="max-w-4xl mx-auto text-center mb-16">
          <div className="flex items-center justify-center gap-2 text-gold/60 mb-4 font-display tracking-[0.2em] uppercase text-sm">
            <Heart size={16} className="text-gold" />
            Relationship Insights
          </div>
          <h1 className="text-4xl md:text-6xl font-light mb-6 text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-white/40 leading-tight">
            Celestial <span className="text-gold italic">Synchronicity</span>
          </h1>
          <p className="text-white/40 font-sans text-lg font-light max-w-2xl mx-auto italic">
            A professional-grade synthesis of Synastry and Composite dynamics to
            reveal the soul-level blueprint of your connection.
          </p>
        </header>

        {!matchResult ? (
          <div className="max-w-2xl mx-auto glass p-8 md:p-12 rounded-[2rem] border-white/5 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-12 text-white/5 pointer-events-none">
              <Sparkles size={120} />
            </div>

            <h2 className="text-xl font-bold mb-8 flex items-center gap-3 relative z-10">
              <div className="p-2 rounded-lg bg-gold/10">
                <User size={20} className="text-gold" />
              </div>
              Partner Details
            </h2>

            <div className="space-y-6 relative z-10">
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest text-white/40 font-black ml-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={partnerData.name}
                  onChange={(e) =>
                    setPartnerData({ ...partnerData, name: e.target.value })
                  }
                  placeholder="Partner's Name"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 font-sans text-white focus:outline-none focus:border-gold/30 transition-all placeholder:text-white/10"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-white/40 font-black ml-1">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    value={partnerData.dob}
                    onChange={(e) =>
                      setPartnerData({ ...partnerData, dob: e.target.value })
                    }
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 font-sans text-white focus:outline-none focus:border-gold/30 transition-all [color-scheme:dark]"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-white/40 font-black ml-1">
                    Time of Birth
                  </label>
                  <input
                    type="time"
                    value={partnerData.tob}
                    onChange={(e) =>
                      setPartnerData({ ...partnerData, tob: e.target.value })
                    }
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 font-sans text-white focus:outline-none focus:border-gold/30 transition-all [color-scheme:dark]"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest text-white/40 font-black ml-1">
                  Place of Birth
                </label>
                <LocationInput
                  value={partnerData.pob}
                  onChange={(val) =>
                    setPartnerData({ ...partnerData, pob: val })
                  }
                  onSelect={(suggestion) =>
                    setPartnerCoords({
                      lat: Number(suggestion.lat),
                      lon: Number(suggestion.lon),
                    })
                  }
                  placeholder="City of Birth"
                  className="w-full"
                />
              </div>

              {error && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm animate-shake">
                  {error}
                </div>
              )}

              <button
                onClick={handleMatch}
                disabled={isMatching || !partnerData.name || !partnerData.pob}
                className="w-full py-6 mt-4 bg-white text-black font-display font-bold rounded-full hover:bg-gold hover:text-black transition-all active:scale-95 shadow-[0_0_30px_rgba(255,255,255,0.1)] disabled:opacity-50 disabled:cursor-not-allowed group relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white via-gold/20 to-white opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                {isMatching ? (
                  <span className="flex items-center justify-center gap-3 relative z-10">
                    <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin"></div>
                    Synthesizing Charts...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2 relative z-10">
                    Calculate Compatibility
                    <ChevronRight
                      size={18}
                      className="group-hover:translate-x-1 transition-transform"
                    />
                  </span>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="max-w-6xl mx-auto space-y-16 animate-in fade-in slide-in-from-bottom-8 duration-1000">
            {/* Master Score Display */}
            <div className="text-center relative">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gold/5 blur-[120px] rounded-full pointer-events-none" />

              <div className="relative inline-block">
                <svg className="w-64 h-64 md:w-80 md:h-80 transform -rotate-90">
                  <circle
                    cx="50%"
                    cy="50%"
                    r="45%"
                    className="stroke-white/5"
                    strokeWidth="4"
                    fill="transparent"
                  />
                  <circle
                    cx="50%"
                    cy="50%"
                    r="45%"
                    className="stroke-gold"
                    strokeWidth="4"
                    fill="transparent"
                    strokeDasharray="283"
                    strokeDashoffset={
                      283 - (283 * matchResult.overall_score) / 100
                    }
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className="text-7xl md:text-8xl font-display font-bold text-white tracking-tighter">
                    {matchResult.overall_score}%
                  </div>
                  <div className="text-gold/40 uppercase tracking-[0.4em] text-[10px] font-black mt-2">
                    Harmony Index
                  </div>
                </div>
              </div>
            </div>

            {/* Synastry Scores Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <ScoreMetric
                label="Emotional"
                value={
                  matchResult.synastry?.emotional_connection ||
                  normalizeScore(
                    matchResult.compatibility?.breakdown?.sun_moon || 0,
                    "sun_moon"
                  )
                }
                icon={<Heart size={18} />}
              />
              <ScoreMetric
                label="Communication"
                value={
                  matchResult.synastry?.communication_style ||
                  normalizeScore(
                    matchResult.compatibility?.breakdown?.mercury || 0,
                    "mercury"
                  )
                }
                icon={<Speech size={18} />}
              />
              <ScoreMetric
                label="Physical"
                value={
                  matchResult.synastry?.physical_attraction ||
                  normalizeScore(
                    matchResult.compatibility?.breakdown?.attraction || 0,
                    "attraction"
                  )
                }
                icon={<Zap size={18} />}
              />
              <ScoreMetric
                label="Long Term"
                value={
                  matchResult.synastry?.long_term_potential ||
                  normalizeScore(
                    matchResult.compatibility?.breakdown?.saturn || 0,
                    "saturn"
                  )
                }
                icon={<Clock size={18} />}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Column: Dynamics and Growth Kit */}
              <div className="lg:col-span-1 space-y-8">
                <section className="glass p-8 rounded-[2.5rem] border-white/5">
                  <h3 className="text-sm font-black uppercase tracking-widest text-gold/60 mb-8 flex items-center gap-2">
                    Relationship Dynamics
                  </h3>
                  <div className="space-y-8">
                    <DynamicItem
                      label="Power Balance"
                      value={matchResult.dynamics?.power_dynamics?.balance}
                      interpretation={
                        matchResult.dynamics?.power_dynamics?.interpretation
                      }
                    />
                    <DynamicItem
                      label="Emotional Bond"
                      value={
                        matchResult.dynamics?.emotional_connection?.strength
                      }
                      interpretation={
                        matchResult.dynamics?.emotional_connection
                          ?.interpretation
                      }
                    />
                    <DynamicItem
                      label="Communication"
                      value={matchResult.dynamics?.communication_style?.style}
                      interpretation={
                        matchResult.dynamics?.communication_style
                          ?.interpretation
                      }
                    />
                    <DynamicItem
                      label="Future Outlook"
                      value={
                        matchResult.dynamics?.long_term_potential?.potential
                      }
                      interpretation={
                        matchResult.dynamics?.long_term_potential
                          ?.interpretation
                      }
                    />
                  </div>
                </section>

                {/* Growth Kit (Compatibility Tips) */}
                {(matchResult.love_languages?.person1?.compatibility_tips ||
                  matchResult.love_languages?.person2?.compatibility_tips) && (
                  <section className="glass p-8 rounded-[2.5rem] border border-gold/10 bg-gold/[0.02]">
                    <h3 className="text-sm font-black uppercase tracking-widest text-gold mb-6 flex items-center gap-2">
                      Connection Kit
                    </h3>
                    <ul className="space-y-4">
                      {[
                        ...(matchResult.love_languages.person1
                          ?.compatibility_tips || []),
                        ...(matchResult.love_languages.person2
                          ?.compatibility_tips || []),
                      ]
                        .slice(0, 6)
                        .map((tip, i) => (
                          <li
                            key={i}
                            className="flex gap-4 text-xs text-white/70 font-light italic leading-relaxed group/tip"
                          >
                            <span className="text-gold group-hover/tip:scale-125 transition-transform shrink-0">
                              ✦
                            </span>
                            {tip}
                          </li>
                        ))}
                    </ul>
                  </section>
                )}
              </div>

              {/* Middle Column: Love Blueprints and Synastry Aspects */}
              <div className="lg:col-span-2 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <LoveLanguageCard
                    label={birthData?.name || "Member 1"}
                    lang={matchResult.love_languages?.person1}
                    isUser={true}
                  />
                  <LoveLanguageCard
                    label={partnerData.name || "Member 2"}
                    lang={matchResult.love_languages?.person2}
                    isUser={false}
                  />
                </div>

                <section className="glass p-8 rounded-[2.5rem] border-white/5">
                  <h3 className="text-sm font-black uppercase tracking-widest text-white/40 mb-8 flex items-center gap-2">
                    Celestial Aspects
                  </h3>
                  <div className="grid grid-cols-1 gap-4">
                    {(matchResult.sections?.[0]?.interpretations || []).map(
                      (aspect, i) => (
                        <div
                          key={i}
                          className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 group hover:border-gold/20 hover:bg-white/[0.04] transition-all"
                        >
                          <div className="text-[10px] text-gold/60 font-black uppercase tracking-widest mb-2 group-hover:text-gold transition-colors">
                            {aspect.factor}
                          </div>
                          <div className="text-sm text-white/60 font-light leading-relaxed font-sans">
                            {aspect.text}
                          </div>
                        </div>
                      )
                    )}
                    {!matchResult.sections?.[0]?.interpretations &&
                      matchResult.synastry?.key_aspects &&
                      matchResult.synastry.key_aspects.map((aspect, i) => {
                        const [title, desc] = aspect.split(": ");
                        return (
                          <div
                            key={i}
                            className="bg-white/5 border border-white/10 rounded-2xl p-4 transition-all"
                          >
                            <div className="text-[10px] text-gold/80 font-bold uppercase mb-1">
                              {title.replace(/_/g, " ")}
                            </div>
                            <div className="text-sm text-white/60 font-light">
                              {desc}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </section>

                {/* Composite Insights */}
                <section className="glass p-10 rounded-[2.5rem] border-white/5 relative overflow-hidden shadow-2xl">
                  <div className="absolute top-0 right-0 p-12 text-white/5 pointer-events-none">
                    <Heart size={150} />
                  </div>
                  <div className="relative z-10">
                    <h3 className="text-xs font-black uppercase tracking-[0.3em] text-gold/40 mb-8">
                      Composite Soul
                    </h3>
                    <div className="text-3xl font-display italic text-white mb-8 leading-tight">
                      "
                      {matchResult.composite?.relationship_purpose ||
                        "Building a shared legacy of growth"}
                      "
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mt-12 pt-12 border-t border-white/5">
                      <div>
                        <div className="text-[10px] uppercase tracking-widest text-emerald-400 font-black mb-4 flex items-center gap-2">
                          <ShieldCheck size={12} /> Synergy Points
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {matchResult.composite?.strengths?.map((s, i) => (
                            <span
                              key={i}
                              className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-xs text-emerald-400 font-medium"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-widest text-orange-400 font-black mb-4 flex items-center gap-2">
                          <Target size={12} /> Growth Hedges
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {matchResult.composite?.challenges?.map((c, i) => (
                            <span
                              key={i}
                              className="px-4 py-2 bg-orange-500/10 border border-orange-500/20 rounded-full text-xs text-orange-400 font-medium"
                            >
                              {c}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Cosmic Wisdom Interpretations (Generic) */}
                {matchResult.interpretations &&
                  matchResult.interpretations.length > 0 && (
                    <section className="space-y-8 pt-8">
                      <div className="flex items-center gap-3 mb-8">
                        <div className="p-3 rounded-2xl bg-gold/10">
                          <BookOpen size={24} className="text-gold" />
                        </div>
                        <div>
                          <h3 className="text-2xl font-display font-bold">
                            Cosmic Wisdom
                          </h3>
                          <p className="text-sm text-white/40 font-light">
                            Deep synthesis of your shared path
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {matchResult.interpretations.map((item, i) => (
                          <div
                            key={i}
                            className="glass p-8 rounded-[2.5rem] border-white/5 group hover:border-gold/20 transition-all"
                          >
                            <h4 className="text-lg font-display font-medium text-gold mb-4 group-hover:translate-x-1 transition-transform inline-flex items-center gap-2">
                              <Sparkles size={16} className="text-gold/40" />
                              {item.title}
                            </h4>
                            <p className="text-white/60 font-sans font-light leading-relaxed italic">
                              {item.text}
                            </p>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
              </div>
            </div>

            <div className="text-center pt-8">
              <button
                onClick={() => setMatchResult(null)}
                className="text-white/20 hover:text-white flex items-center gap-2 mx-auto transition-colors font-sans text-xs tracking-widest uppercase"
              >
                Reset Analysis
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function ScoreMetric({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="glass p-6 rounded-3xl border border-white/5 text-center group hover:border-gold/20 transition-all">
      <div className="flex items-center justify-center gap-2 text-white/30 mb-4 group-hover:text-gold/60 transition-colors">
        {icon}
        <span className="text-[10px] uppercase tracking-widest font-black">
          {label}
        </span>
      </div>
      <div className="text-3xl font-display font-medium mb-1">{value}%</div>
      <div className="w-full h-1 bg-white/5 rounded-full mt-3 overflow-hidden">
        <div
          className="h-full bg-gold transition-all duration-1000"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

function DynamicItem({
  label,
  value,
  interpretation,
}: {
  label: string;
  value: string | undefined;
  interpretation?: string;
}) {
  return (
    <div className="group/item">
      <div className="text-[10px] uppercase tracking-widest text-white/30 mb-2 group-hover/item:text-gold/40 transition-colors font-black">
        {label}
      </div>
      <div className="text-sm font-sans font-light text-white/90 mb-1">
        {value || "N/A"}
      </div>
      {interpretation && (
        <div className="text-[11px] font-sans font-light italic text-white/40 leading-relaxed">
          {interpretation}
        </div>
      )}
    </div>
  );
}

function LoveLanguageCard({
  label,
  lang,
  isUser,
}: {
  label: string;
  lang: any;
  isUser: boolean;
}) {
  return (
    <div className="glass p-8 rounded-[2.5rem] border border-white/5 relative overflow-hidden group/card shadow-2xl">
      <div
        className={`absolute top-0 right-0 p-10 text-white/5 pointer-events-none group-hover/card:text-gold/5 transition-colors`}
      >
        <User size={120} />
      </div>

      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-8">
          <div
            className={`w-2 h-2 rounded-full ${
              isUser ? "bg-gold" : "bg-gold/40"
            }`}
          />
          <span className="text-xs uppercase tracking-[0.2em] font-black text-white/60">
            {label}'s Love Blueprint
          </span>
        </div>

        <div className="space-y-8">
          <div className="grid grid-cols-2 gap-8">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-gold/40 font-black mb-3">
                Primary Mode
              </div>
              <div className="text-xl font-display text-white">
                {lang?.primary_love_language || lang?.primary || "N/A"}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-gold/40 font-black mb-3">
                Secondary
              </div>
              <div className="text-xl font-display text-white/60">
                {lang?.secondary_love_language || lang?.secondary || "N/A"}
              </div>
            </div>
          </div>

          {/* Deep Influences */}
          <div className="pt-8 border-t border-white/5 space-y-6">
            <InfluenceItem
              icon="Venus"
              sign={lang?.venus_influence?.sign}
              text={lang?.venus_influence?.expression}
            />
            <InfluenceItem
              icon="Moon"
              sign={lang?.moon_influence?.sign}
              text={lang?.moon_influence?.emotional_needs}
            />
            <InfluenceItem
              icon="Mars"
              sign={lang?.mars_influence?.sign}
              text={lang?.mars_influence?.passion_style}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function InfluenceItem({
  icon,
  sign,
  text,
}: {
  icon: string;
  sign?: string;
  text?: string;
}) {
  if (!sign && !text) return null;
  return (
    <div className="flex gap-4 group/inf">
      <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-xs font-black text-gold/60 group-hover/inf:bg-gold/10 group-hover/inf:text-gold transition-all shrink-0">
        {icon[0]}
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-widest font-black text-white/40 mb-1">
          {icon} in {sign}
        </div>
        <div className="text-xs text-white/60 font-light italic leading-relaxed">
          {text}
        </div>
      </div>
    </div>
  );
}
