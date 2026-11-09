import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Sparkles, Star, ArrowRight, Loader2, Share2 } from "lucide-react";
import LocationInput from "../components/LocationInput";
import SEO from "../components/SEO";
import {
  captureAcquisitionSource,
  trackAcquisitionEvent,
} from "../lib/acquisition";
import { postJson } from "../lib/apiFetch";
import { siteUrl } from "../lib/site-url";

interface KundaliResult {
  /** Display string, e.g. "Leo 12.4°" — never the raw {sign, degree} object. */
  ascendant?: string;
  moonSign?: string;
  moonNakshatra?: string;
  sunSign?: string;
  planets?: any[];
  yogas?: any[];
  [key: string]: any;
}

const textOf = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

/** The API returns ascendant as {sign, degree}; older shapes used a string. */
const formatAscendant = (value: unknown): string | undefined => {
  if (typeof value === "string") return textOf(value);
  if (value && typeof value === "object") {
    const v = value as { sign?: unknown; degree?: unknown };
    const sign = textOf(v.sign);
    if (!sign) return undefined;
    const degree = Number(v.degree);
    return Number.isFinite(degree) ? `${sign} ${degree.toFixed(1)}°` : sign;
  }
  return undefined;
};

/** Case-insensitive planet lookup in planetary_positions (sidereal, as returned). */
const findPlanet = (planets: any[], name: string) =>
  planets.find(
    (p) =>
      String(p?.name ?? p?.planet ?? "")
        .trim()
        .toLowerCase() === name,
  );

const normalizeKundaliResult = (payload: any): KundaliResult => {
  const raw = payload?.data ?? payload;
  const rawPlanets =
    raw?.planets ?? raw?.planetary_positions ?? raw?.planetaryPositions ?? [];
  const planets = Array.isArray(rawPlanets) ? rawPlanets : [];
  const moon = findPlanet(planets, "moon");
  const sun = findPlanet(planets, "sun");
  return {
    ...raw,
    ascendant:
      formatAscendant(raw?.ascendant) ||
      formatAscendant(raw?.lagna) ||
      formatAscendant(raw?.ascendant_sign) ||
      formatAscendant(findPlanet(planets, "ascendant")),
    moonSign:
      textOf(moon?.sign) ||
      textOf(raw?.moonSign) ||
      textOf(raw?.moon_sign) ||
      textOf(raw?.rashi),
    moonNakshatra: textOf(moon?.nakshatra),
    sunSign: textOf(sun?.sign) || textOf(raw?.sunSign) || textOf(raw?.sun_sign),
    planets,
    yogas: Array.isArray(raw?.yogas) ? raw.yogas : [],
  };
};

/** Points that depend on the exact birth time (hidden when it's unknown). */
const TIME_SENSITIVE_POINTS = new Set(["ascendant", "lagna", "mc", "midheaven"]);

export default function FreeKundali() {
  const [form, setForm] = useState({
    name: "",
    dob: "",
    tob: "12:00",
    pob: "",
  });
  // An unknown time is cast at noon but flagged, so neither the server nor
  // the UI presents Lagna/houses as if they were exact.
  const [timeUnknown, setTimeUnknown] = useState(false);
  const [resultTimeUnknown, setResultTimeUnknown] = useState(false);
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
      const res = await postJson("/api/kundali", {
        birthData: timeUnknown
          ? { ...form, tob: "12:00", birthTimeUnknown: true }
          : form,
        chartType: "D1",
      });
      if (res.ok) {
        const data = await res.json();
        setResult(normalizeKundaliResult(data));
        setResultTimeUnknown(timeUnknown);
        trackAcquisitionEvent("seo_tool_complete", { tool: "free_kundali" });
      } else {
        // The server sends user-safe copy (e.g. "check the birth date, time
        // and place") — show it instead of a generic failure.
        const body = await res.json().catch(() => null);
        setError(
          typeof body?.error === "string" && body.error
            ? body.error
            : "We couldn't calculate your Kundali just now. Check the birth date, time and place, then try again in a minute.",
        );
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
    url: siteUrl("/free-kundali"),
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
    <div>
      <SEO
        title="Free Kundali Online | Vedic Birth Chart Generator"
        description="Generate your free Vedic Kundali birth chart instantly. Get Moon sign, Sun sign, Ascendant, and planetary positions with no signup required."
        url={siteUrl("/free-kundali")}
        canonical={siteUrl("/free-kundali")}
        structuredData={[structuredData, faqStructuredData]}
      />

      <div className="relative z-10 px-4 pt-28 pb-16">
        {/* SEO Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/60 text-sm mb-6">
            <Sparkles className="w-3.5 h-3.5 text-gold" />
            100% Free — No Signup Required
          </div>
          <h1 className="type-page-title mb-3">
            Free Kundali Online
          </h1>
          <p className="text-white/50 text-lg max-w-xl mx-auto">
            Generate your Vedic birth chart instantly. Discover your Ascendant,
            Moon sign, Sun sign, and planetary positions.
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
                <label htmlFor="fk-name" className="block text-sm text-white/60 mb-1.5">
                  Name (optional)
                </label>
                <input
                  id="fk-name"
                  type="text"
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  placeholder="Your name"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-transparent transition-all"
                />
              </div>

              {/* Date of Birth */}
              <div>
                <label htmlFor="fk-dob" className="block text-sm text-white/60 mb-1.5">
                  Date of Birth <span className="text-gold">*</span>
                </label>
                <input
                  id="fk-dob"
                  type="date"
                  value={form.dob}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, dob: e.target.value }))
                  }
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-transparent transition-all [color-scheme:dark]"
                />
              </div>

              {/* Time of Birth */}
              <div>
                <label htmlFor="fk-tob" className="block text-sm text-white/60 mb-1.5">
                  Time of Birth
                </label>
                <input
                  id="fk-tob"
                  type="time"
                  value={form.tob}
                  disabled={timeUnknown}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, tob: e.target.value }))
                  }
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-transparent transition-all [color-scheme:dark] disabled:opacity-40"
                />
                <label className="mt-2 flex items-center gap-2 text-sm text-white/50 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={timeUnknown}
                    onChange={(e) => setTimeUnknown(e.target.checked)}
                    className="accent-gold"
                  />
                  I don't know my birth time
                </label>
                {timeUnknown && (
                  <p className="mt-1 text-xs text-white/35">
                    We'll still show your Moon sign, nakshatra and planets by
                    sign. Rising sign and houses need an exact birth time.
                  </p>
                )}
              </div>

              {/* Place of Birth */}
              <div>
                <label htmlFor="fk-pob" className="block text-sm text-white/60 mb-1.5">
                  Place of Birth <span className="text-gold">*</span>
                </label>
                <LocationInput
                  inputId="fk-pob"
                  value={form.pob}
                  onChange={(value) => setForm((f) => ({ ...f, pob: value }))}
                  placeholder="Search for your birth city..."
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-transparent transition-all"
                />
              </div>

              {error && (
                <p className="text-red-400 text-sm text-center">{error}</p>
              )}

              {/* Generate Button */}
              <button
                onClick={handleGenerate}
                disabled={loading}
                className="w-full py-3.5 rounded-xl bg-gold text-black font-semibold text-lg hover:bg-gold/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
              <h2 className="text-xl font-display text-white/70">
                What is a Kundali?
              </h2>
              <p className="text-white/40 text-sm max-w-md mx-auto leading-relaxed">
                A Kundali (also known as Janam Kundali or birth chart) is a
                Vedic astrological map of the sky at the exact moment of your
                birth. It reveals your Ascendant (Lagna), Moon sign (Rashi), Sun
                sign, and the positions of all nine planets (Navagraha) across
                the twelve houses.
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
                Kundali for{" "}
                <span className="text-white/70 font-medium">{form.name}</span>
              </p>
            )}

            {resultTimeUnknown && (
              <p className="mb-4 rounded-xl border border-gold/20 bg-gold/5 px-4 py-3 text-center text-sm text-white/60">
                Rising sign and houses need an exact birth time, so they're
                hidden here. Moon sign, nakshatra and planets by sign don't
                depend on it.
              </p>
            )}

            {/* Key Highlights */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              {[
                {
                  label: "Ascendant (Lagna)",
                  value: resultTimeUnknown
                    ? "Needs birth time"
                    : result.ascendant || "—",
                },
                {
                  label: "Moon Sign (Rashi)",
                  value: result.moonNakshatra
                    ? `${result.moonSign || "—"} · ${result.moonNakshatra}`
                    : result.moonSign || "—",
                },
                { label: "Sun Sign", value: result.sunSign || "—" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl border border-white/10 bg-white/[0.03] p-5 text-center"
                >
                  <p className="text-white/40 text-xs uppercase tracking-wider mb-1">
                    {item.label}
                  </p>
                  <p className="text-xl font-display text-gold">
                    {item.value}
                  </p>
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
                  copy: "Bring this chart into Jyotish or The Circle so every answer starts from it.",
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
                  <p className="text-sm font-semibold text-white/80">
                    {item.title}
                  </p>
                  <p className="mt-1 text-sm text-white/40">{item.copy}</p>
                </div>
              ))}
            </div>

            {/* Planetary Positions Summary */}
            {result.planets && result.planets.length > 0 && (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 mb-8">
                <h3 className="text-lg font-display text-white/80 mb-4">
                  Planetary Positions
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {result.planets
                    .filter(
                      (planet: any) =>
                        !resultTimeUnknown ||
                        !TIME_SENSITIVE_POINTS.has(
                          String(planet?.name ?? planet?.planet ?? "")
                            .trim()
                            .toLowerCase(),
                        ),
                    )
                    .slice(0, 9)
                    .map((planet: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <span className="w-2 h-2 rounded-full bg-gold/60" />
                        <span className="text-white/60">
                          {textOf(planet?.name) ||
                            textOf(planet?.planet) ||
                            `Planet ${i + 1}`}
                        </span>
                        <span className="text-white/30 ml-auto">
                          {textOf(planet?.sign) || textOf(planet?.rashi) || "—"}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Teaser */}
            <div className="rounded-xl border border-gold/20 bg-gold/5 p-6 mb-8 text-center">
              <Sparkles className="w-6 h-6 text-gold mx-auto mb-3" />
              <p className="text-white/70 mb-1">
                Your chart reveals{" "}
                <span className="text-gold font-medium">
                  {result.yogas?.length || "several"} yogas
                </span>{" "}
                and{" "}
                <span className="text-gold font-medium">
                  {result.planets?.length || 9} planetary combinations
                </span>
                .
              </p>
              <p className="text-white/40 text-sm">
                Unlock your complete Vedic reading with Dasha predictions,
                remedies, and personalized guidance.
              </p>
            </div>

            {/* CTA */}
            <Link
              to="/onboarding"
              onClick={() => rememberSource("/onboarding")}
              className="block w-full py-4 rounded-xl bg-gold text-black font-semibold text-lg text-center hover:bg-gold/90 transition-all"
            >
              <span className="flex items-center justify-center gap-2">
                Get Your Complete Kundali Reading
                <ArrowRight className="w-5 h-5" />
              </span>
            </Link>
            <p className="text-center text-white/30 text-sm mt-3">
              Create a free account to save this chart and unlock Dasha,
              remedies, and chart-aware guidance
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
              <Link
                to="/synthesis"
                onClick={() => rememberSource("/synthesis")}
                className="rounded-xl border border-white/10 px-4 py-3 text-center text-sm text-white/60 hover:border-gold/30 hover:text-gold"
              >
                Ask Jyotish about this chart
              </Link>
              <Link
                to="/consult"
                onClick={() => rememberSource("/consult")}
                className="rounded-xl border border-white/10 px-4 py-3 text-center text-sm text-white/60 hover:border-gold/30 hover:text-gold"
              >
                Sit with a guide in The Circle
              </Link>
            </div>

            {/* Share & Generate another */}
            <div className="flex gap-3 mt-6 justify-center">
              <button
                onClick={() => {
                  const text =
                    !resultTimeUnknown && result.ascendant
                      ? `My Ascendant is ${result.ascendant}! Get your free Kundali:`
                      : `My Moon sign is ${result.moonSign || "revealed"}! Get your free Kundali:`;
                  const url = window.location.href;
                  if (navigator.share) {
                    navigator.share({ title: "My Kundali", text, url });
                  } else {
                    window.open(
                      `https://wa.me/?text=${encodeURIComponent(text + "\n" + url)}`,
                      "_blank",
                    );
                  }
                }}
                className="px-4 py-2 rounded-xl border border-white/10 text-white/40 hover:text-gold hover:border-gold/30 text-xs uppercase tracking-widest transition-all flex items-center gap-2"
              >
                <Share2 size={14} />
                Share My Kundali
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
