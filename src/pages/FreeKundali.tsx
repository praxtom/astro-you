import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Sparkles, Star, ArrowRight, Loader2, Share2 } from "lucide-react";
import LocationInput from "../components/LocationInput";
import SEO from "../components/SEO";
import { captureAcquisitionSource, trackAcquisitionEvent } from "../lib/acquisition";

interface KundaliResult {
  ascendant?: string;
  moonSign?: string;
  sunSign?: string;
  planets?: any[];
  yogas?: any[];
  [key: string]: any;
}

const normalizeKundaliResult = (payload: any): KundaliResult => {
  const raw = payload?.data ?? payload;
  const planets = raw?.planets ?? raw?.planetary_positions ?? raw?.planetaryPositions ?? [];
  return {
    ...raw,
    ascendant: raw?.ascendant || raw?.lagna || raw?.ascendant_sign,
    moonSign: raw?.moonSign || raw?.moon_sign || raw?.rashi,
    sunSign: raw?.sunSign || raw?.sun_sign,
    planets: Array.isArray(planets) ? planets : [],
    yogas: Array.isArray(raw?.yogas) ? raw.yogas : [],
  };
};

export default function FreeKundali() {
  const [form, setForm] = useState({ name: "", dob: "", tob: "12:00", pob: "" });
  const [result, setResult] = useState<KundaliResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleGenerate = async () => {
    if (!form.dob || !form.pob) {
      setError("Please enter your date of birth and place of birth.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/kundali", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ birthData: form, chartType: "D1" }),
      });
      if (res.ok) {
        const data = await res.json();
        setResult(normalizeKundaliResult(data));
        trackAcquisitionEvent("seo_tool_complete", { tool: "free_kundali" });
      } else {
        setError("Something went wrong. Please try again.");
      }
    } catch {
      setError("Network error. Please check your connection.");
    }
    setLoading(false);
  };

  const rememberSource = (target: string) => {
    captureAcquisitionSource({
      source: "free-kundali",
      medium: "seo_tool",
      campaign: "free_tool_funnel",
    });
    trackAcquisitionEvent("seo_cta_click", { tool: "free_kundali", target });
  };

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Free Kundali Online",
    applicationCategory: "LifestyleApplication",
    operatingSystem: "Web",
    url: "https://astroyou.app/free-kundali",
    offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
  };
  const faqStructuredData = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "Is the free Kundali online report really free?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. AstroYou can generate a basic Vedic birth chart before signup.",
        },
      },
      {
        "@type": "Question",
        name: "What details are needed for a Janam Kundali?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Date of birth, time of birth, and place of birth give the most accurate chart.",
        },
      },
    ],
  };

  return (
    <div className="min-h-screen bg-[#030308] text-white">
      <SEO
        title="Free Kundali Online | Vedic Birth Chart Generator"
        description="Generate your free Vedic Kundali birth chart instantly. Get Moon sign, Sun sign, Ascendant, and planetary positions with no signup required."
        url="https://astroyou.app/free-kundali"
        canonical="https://astroyou.app/free-kundali"
        structuredData={[structuredData, faqStructuredData]}
      />
      {/* Subtle cosmic background glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-purple-500/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-amber-500/5 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 px-4 py-12 sm:py-20">
        {/* SEO Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/60 text-sm mb-6">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            100% Free — No Signup Required
          </div>
          <h1 className="text-4xl sm:text-5xl font-display font-semibold bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent mb-3">
            Free Kundali Online
          </h1>
          <p className="text-white/50 text-lg max-w-xl mx-auto">
            Generate your Vedic birth chart instantly. Discover your Ascendant, Moon sign, Sun sign, and planetary positions.
          </p>
        </motion.div>

        {!result ? (
          /* Birth Data Form */
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="max-w-lg mx-auto"
          >
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm p-6 sm:p-8 space-y-5">
              {/* Name */}
              <div>
                <label className="block text-sm text-white/60 mb-1.5">Name (optional)</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Your name"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-transparent transition-all"
                />
              </div>

              {/* Date of Birth */}
              <div>
                <label className="block text-sm text-white/60 mb-1.5">
                  Date of Birth <span className="text-amber-400">*</span>
                </label>
                <input
                  type="date"
                  value={form.dob}
                  onChange={(e) => setForm((f) => ({ ...f, dob: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-transparent transition-all [color-scheme:dark]"
                />
              </div>

              {/* Time of Birth */}
              <div>
                <label className="block text-sm text-white/60 mb-1.5">Time of Birth</label>
                <input
                  type="time"
                  value={form.tob}
                  onChange={(e) => setForm((f) => ({ ...f, tob: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-transparent transition-all [color-scheme:dark]"
                />
              </div>

              {/* Place of Birth */}
              <div>
                <label className="block text-sm text-white/60 mb-1.5">
                  Place of Birth <span className="text-amber-400">*</span>
                </label>
                <LocationInput
                  value={form.pob}
                  onChange={(value) => setForm((f) => ({ ...f, pob: value }))}
                  placeholder="Search for your birth city..."
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-transparent transition-all"
                />
              </div>

              {error && (
                <p className="text-red-400 text-sm text-center">{error}</p>
              )}

              {/* Generate Button */}
              <button
                onClick={handleGenerate}
                disabled={loading}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-black font-semibold text-lg hover:from-amber-400 hover:to-orange-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Generating Chart...
                  </>
                ) : (
                  <>
                    <Star className="w-5 h-5" />
                    Generate Free Kundali
                  </>
                )}
              </button>
            </div>

            {/* SEO content block */}
            <div className="mt-12 text-center space-y-4">
              <h2 className="text-xl font-display text-white/70">What is a Kundali?</h2>
              <p className="text-white/40 text-sm max-w-md mx-auto leading-relaxed">
                A Kundali (also known as Janam Kundali or birth chart) is a Vedic astrological map of the sky at the exact moment of your birth. It reveals your Ascendant (Lagna), Moon sign (Rashi), Sun sign, and the positions of all nine planets (Navagraha) across the twelve houses.
              </p>
              <nav
                aria-label="Related astrology tools"
                className="mx-auto flex max-w-xl flex-wrap justify-center gap-2 pt-2"
              >
                {[
                  ["Kundali Matching", "/free-kundali-matching"],
                  ["Daily Horoscope", "/daily-horoscope"],
                  ["Today Panchang", "/panchang"],
                  ["Sade Sati Guide", "/sade-sati"],
                ].map(([label, to]) => (
                  <Link
                    key={to}
                    to={to}
                    className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/45 transition-colors hover:border-gold/30 hover:text-gold"
                  >
                    {label}
                  </Link>
                ))}
              </nav>
            </div>
          </motion.div>
        ) : (
          /* Results */
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-2xl mx-auto"
          >
            {form.name && (
              <p className="text-center text-white/40 mb-6">
                Kundali for <span className="text-white/70 font-medium">{form.name}</span>
              </p>
            )}

            {/* Key Highlights */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              {[
                { label: "Ascendant (Lagna)", value: result.ascendant || "—" },
                { label: "Moon Sign (Rashi)", value: result.moonSign || "—" },
                { label: "Sun Sign", value: result.sunSign || "—" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl border border-white/10 bg-white/[0.03] p-5 text-center"
                >
                  <p className="text-white/40 text-xs uppercase tracking-wider mb-1">{item.label}</p>
                  <p className="text-xl font-display text-amber-400">{item.value}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
              {[
                {
                  title: "Core chart",
                  copy: "Ascendant, Moon sign, Sun sign, and Navagraha positions.",
                },
                {
                  title: "Reading path",
                  copy: "Save the chart to continue into Dashas, remedies, and reports.",
                },
                {
                  title: "Consult ready",
                  copy: "Use this chart as context when you speak to an AI astrologer.",
                },
                {
                  title: "Private by default",
                  copy: "No signup is needed until you choose to save the result.",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-xl border border-white/10 bg-white/[0.03] p-4"
                >
                  <p className="text-sm font-semibold text-white/80">{item.title}</p>
                  <p className="mt-1 text-sm text-white/40">{item.copy}</p>
                </div>
              ))}
            </div>

            {/* Planetary Positions Summary */}
            {result.planets && result.planets.length > 0 && (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 mb-8">
                <h3 className="text-lg font-display text-white/80 mb-4">Planetary Positions</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {result.planets.slice(0, 9).map((planet: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <span className="w-2 h-2 rounded-full bg-amber-400/60" />
                      <span className="text-white/60">{planet.name || `Planet ${i + 1}`}</span>
                      <span className="text-white/30 ml-auto">{planet.sign || planet.rashi || "—"}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Teaser */}
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-6 mb-8 text-center">
              <Sparkles className="w-6 h-6 text-amber-400 mx-auto mb-3" />
              <p className="text-white/70 mb-1">
                Your chart reveals{" "}
                <span className="text-amber-400 font-medium">
                  {result.yogas?.length || "several"} yogas
                </span>{" "}
                and{" "}
                <span className="text-amber-400 font-medium">
                  {result.planets?.length || 9} planetary combinations
                </span>
                .
              </p>
              <p className="text-white/40 text-sm">
                Unlock your complete AI-powered Vedic reading with Dasha predictions, remedies, and personalized guidance.
              </p>
            </div>

            {/* CTA */}
            <Link
              to="/onboarding"
              onClick={() => rememberSource("/onboarding")}
              className="block w-full py-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-black font-semibold text-lg text-center hover:from-amber-400 hover:to-orange-400 transition-all"
            >
              <span className="flex items-center justify-center gap-2">
                Get Your Complete AI-Powered Reading
                <ArrowRight className="w-5 h-5" />
              </span>
            </Link>
            <p className="text-center text-white/30 text-sm mt-3">
              Create a free account to save this chart and unlock Dasha, remedies, and AI guidance
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
              <Link
                to="/synthesis"
                onClick={() => rememberSource("/synthesis")}
                className="rounded-xl border border-white/10 px-4 py-3 text-center text-sm text-white/60 hover:border-gold/30 hover:text-gold"
              >
                Ask AI about this chart
              </Link>
              <Link
                to="/consult"
                onClick={() => rememberSource("/consult")}
                className="rounded-xl border border-white/10 px-4 py-3 text-center text-sm text-white/60 hover:border-gold/30 hover:text-gold"
              >
                Talk to an AI astrologer
              </Link>
            </div>

            {/* Share & Generate another */}
            <div className="flex gap-3 mt-6 justify-center">
              <button
                onClick={() => {
                  const asc = result.ascendant || '';
                  const text = `My Ascendant is ${asc}! Get your free Vedic birth chart:`;
                  const url = window.location.href;
                  if (navigator.share) {
                    navigator.share({ title: 'My Birth Chart', text, url });
                  } else {
                    window.open(`https://wa.me/?text=${encodeURIComponent(text + '\n' + url)}`, '_blank');
                  }
                }}
                className="px-4 py-2 rounded-xl border border-white/10 text-white/40 hover:text-gold hover:border-gold/30 text-xs uppercase tracking-widest transition-all flex items-center gap-2"
              >
                <Share2 size={14} />
                Share My Chart
              </button>
            </div>
            <button
              onClick={() => setResult(null)}
              className="block mx-auto mt-4 text-white/40 hover:text-white/60 text-sm underline underline-offset-4 transition-colors"
            >
              Generate another Kundali
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
