import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Sparkles, Star, ArrowRight, Loader2, Share2 } from "lucide-react";
import LocationInput from "../components/LocationInput";
import Kundali from "../components/astrology/Kundali";
import SEO from "../components/SEO";
import {
  captureAcquisitionSource,
  trackAcquisitionEvent,
} from "../lib/acquisition";
import { postJson } from "../lib/apiFetch";
import type { BirthData, KundaliData } from "../types";
import { siteUrl } from "../lib/site-url";
import { StatusNotice } from "../components/ui/StatusNotice";
import { GlossaryTerm } from "../components/ui/GlossaryTerm";

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
/** Names people recognise, in place of raw engine codes. */
const SIGN_LABELS: Record<string, string> = {
  ari: "Aries (Mesha)",
  tau: "Taurus (Vrishabha)",
  gem: "Gemini (Mithuna)",
  can: "Cancer (Karka)",
  leo: "Leo (Simha)",
  vir: "Virgo (Kanya)",
  lib: "Libra (Tula)",
  sco: "Scorpio (Vrishchika)",
  sag: "Sagittarius (Dhanu)",
  cap: "Capricorn (Makara)",
  aqu: "Aquarius (Kumbha)",
  pis: "Pisces (Meena)",
};
const signLabel = (value: unknown): string | undefined => {
  const text = textOf(value);
  if (!text) return undefined;
  return SIGN_LABELS[text.slice(0, 3).toLowerCase()] ?? text;
};
const PLANET_LABELS: Record<string, string> = {
  mean_node: "Rahu",
  true_node: "Rahu",
  mean_south_node: "Ketu",
  true_south_node: "Ketu",
};
const planetLabel = (value: unknown): string | undefined => {
  const text = textOf(value);
  if (!text) return undefined;
  return PLANET_LABELS[text.toLowerCase()] ?? text.replace(/_/g, " ");
};

const TIME_SENSITIVE_POINTS = new Set([
  "ascendant",
  "lagna",
  "mc",
  "midheaven",
]);

export default function FreeKundali() {
  const [form, setForm] = useState({
    name: "",
    dob: "",
    tob: "12:00",
    pob: "",
  });
  // An unknown time is cast at noon but flagged, so neither the server nor
  // the UI presents Lagna/houses as if they were exact.
  // Coordinates of the picked suggestion. Sending them means the server
  // never has to guess the place (or its time zone) from a text label.
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [timeUnknown, setTimeUnknown] = useState(false);
  const [resultTimeUnknown, setResultTimeUnknown] = useState(false);
  const [result, setResult] = useState<KundaliResult | null>(null);
  const [chartHandoff, setChartHandoff] = useState<{
    birthData: BirthData;
    kundaliData: KundaliData;
  } | null>(null);
  // Untouched D1 payload for the chart diagram (result.ascendant is a display string).
  const [rawChart, setRawChart] = useState<any>(null);
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
      const birthData: BirthData = {
        ...form,
        ...(coords ? { coordinates: coords } : {}),
        ...(timeUnknown ? { tob: "12:00", birthTimeUnknown: true } : {}),
      };
      const res = await postJson("/api/kundali", { birthData, chartType: "D1" });
      if (res.ok) {
        const data = await res.json();
        const normalized = normalizeKundaliResult(data);
        const raw = data?.data ?? data;
        setResult(normalized);
        setChartHandoff({
          birthData,
          kundaliData: {
            planetary_positions: normalized.planets ?? [],
            house_cusps: raw?.house_cusps ?? [],
            ascendant: raw?.ascendant,
            ...(timeUnknown ? { timeUnknown: true, houseReference: "moon" } : {}),
          },
        });
        setRawChart(data?.data ?? data);
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
          className="text-center mb-8 sm:mb-12"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/60 text-sm mb-6">
            <Sparkles className="w-3.5 h-3.5 text-gold" />
            100% Free — No Signup Required
          </div>
          <h1 className="type-page-title mb-3">Free Kundali Online</h1>
          <p className="text-white/60 text-base sm:text-lg max-w-xl mx-auto">
            Generate your Vedic birth chart instantly. See your rising sign,
            Moon sign, Sun sign, and where every planet sat when you were born.
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
            <div className="sm:rounded-2xl sm:border sm:border-white/10 sm:bg-white/[0.03] sm:backdrop-blur-sm sm:p-8 space-y-4 sm:space-y-5">
              {/* Name */}
              <div>
                <label
                  htmlFor="fk-name"
                  className="block text-sm text-white/60 mb-1.5"
                >
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
                  className="platform-field placeholder:text-white/50"
                />
              </div>

              {/* Date of Birth */}
              <div>
                <label
                  htmlFor="fk-dob"
                  className="block text-sm text-white/60 mb-1.5"
                >
                  Date of Birth <span className="text-gold">*</span>
                </label>
                <input
                  id="fk-dob"
                  type="date"
                  value={form.dob}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, dob: e.target.value }))
                  }
                  className="platform-field [color-scheme:dark]"
                />
              </div>

              {/* Time of Birth */}
              <div>
                <label
                  htmlFor="fk-tob"
                  className="block text-sm text-white/60 mb-1.5"
                >
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
                  className="platform-field [color-scheme:dark] disabled:opacity-40"
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
                {!timeUnknown && (
                  <p className="mt-1 text-xs text-white/50">
                    The closer the better: your rising sign changes about
                    every two hours.
                  </p>
                )}
                {timeUnknown && (
                  <p className="mt-1 text-xs text-white/50">
                    We'll still show your Moon sign, nakshatra and planets by
                    sign. Rising sign and houses need an exact birth time.
                  </p>
                )}
              </div>

              {/* Place of Birth */}
              <div>
                <label
                  htmlFor="fk-pob"
                  className="block text-sm text-white/60 mb-1.5"
                >
                  Place of Birth <span className="text-gold">*</span>
                </label>
                <LocationInput
                  inputId="fk-pob"
                  value={form.pob}
                  onChange={(value) => {
                    setForm((f) => ({ ...f, pob: value }));
                    // Typed text no longer matches the picked place.
                    setCoords(null);
                  }}
                  onSelect={(suggestion) => {
                    const lat = Number(suggestion.lat);
                    const lng = Number(suggestion.lon);
                    if (Number.isFinite(lat) && Number.isFinite(lng)) {
                      setCoords({ lat, lng });
                    }
                  }}
                  placeholder="Search for your birth city..."
                  size="field"
                />
              </div>

              {error && <StatusNotice size="section" message={error} />}

              {/* Generate Button */}
              <button
                type="button"
                onClick={handleGenerate}
                disabled={loading}
                className="w-full min-h-12 py-3 rounded-xl bg-gold text-black font-semibold text-base hover:bg-gold/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
              <p className="text-white/55 text-sm max-w-md mx-auto leading-relaxed">
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
                    className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/55 transition-colors hover:border-gold/30 hover:text-gold"
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
              <p className="text-center text-white/55 mb-6">
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
                  key: "lagna",
                  label: (
                    <GlossaryTerm k="lagna">Rising sign (Lagna)</GlossaryTerm>
                  ),
                  value: resultTimeUnknown
                    ? "Needs birth time"
                    : result.ascendant || "—",
                  hint: "How you come across and meet the world.",
                },
                {
                  key: "moon",
                  label: (
                    <GlossaryTerm k="rashi">Moon sign (Rashi)</GlossaryTerm>
                  ),
                  value: result.moonNakshatra
                    ? `${signLabel(result.moonSign) || "—"} · ${result.moonNakshatra}`
                    : signLabel(result.moonSign) || "—",
                  hint: result.moonNakshatra ? (
                    <>
                      Your emotional nature, and the sign Indian horoscopes
                      use. The second name is your birth star (
                      <GlossaryTerm k="nakshatra">nakshatra</GlossaryTerm>).
                    </>
                  ) : (
                    "Your emotional nature, and the sign Indian horoscopes use."
                  ),
                },
                {
                  key: "sun",
                  label: "Sun sign",
                  value: signLabel(result.sunSign) || "—",
                  hint: "Your core drive. Often one sign earlier than the Western sign you may know.",
                },
              ].map((item) => (
                <div
                  key={item.key}
                  className="rounded-xl border border-white/10 bg-white/[0.03] p-5 text-center"
                >
                  <p className="text-white/55 text-xs uppercase tracking-wider mb-1">
                    {item.label}
                  </p>
                  <p className="text-xl font-display text-gold">{item.value}</p>
                  <p className="mt-2 text-xs leading-relaxed text-white/55">
                    {item.hint}
                  </p>
                </div>
              ))}
            </div>

            {/* The chart itself: a free kundali has to show the kundali. */}
            {Array.isArray(rawChart?.planetary_positions) &&
              rawChart.planetary_positions.length > 0 && (
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 sm:p-6 mb-8">
                  <h2 className="text-lg font-display text-white/80 mb-4">
                    Your birth chart (North Indian style)
                  </h2>
                  <div className="mx-auto w-full max-w-md">
                    <Kundali
                      data={
                        {
                          ...rawChart,
                          timeUnknown:
                            resultTimeUnknown || rawChart.timeUnknown === true,
                        } as any
                      }
                    />
                  </div>
                  {resultTimeUnknown && (
                    <p className="mt-3 text-sm text-white/55">
                      Birth time unknown: houses are counted from your Moon
                      sign, not the Lagna.
                    </p>
                  )}
                </div>
              )}

            {/* Planetary Positions Summary */}
            {result.planets && result.planets.length > 0 && (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 mb-8">
                <h2 className="text-lg font-display text-white/80">
                  Where each planet sat
                </h2>
                <p className="mt-1 mb-4 text-sm text-white/55">
                  The sign each planet was in when you were born. The sign
                  shapes how that planet shows up in you.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                        <span className="text-white/75">
                          {planetLabel(planet?.name) ||
                            planetLabel(planet?.planet) ||
                            `Planet ${i + 1}`}
                        </span>
                        <span className="text-white/65 ml-auto text-right">
                          {signLabel(planet?.sign) ||
                            signLabel(planet?.rashi) ||
                            "—"}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Teaser */}
            <div className="rounded-xl border border-gold/20 bg-gold/5 p-6 mb-8 text-center">
              <Sparkles
                className="w-6 h-6 text-gold mx-auto mb-3"
                aria-hidden="true"
              />
              <p className="text-white/75 mb-1">
                This is the chart. The full reading explains it.
              </p>
              <p className="text-white/60 text-sm">
                Which life chapter you are in now and when it changes, the
                strengths built into your chart, simple remedies, and answers
                to your own questions, all worked out from this chart.
              </p>
            </div>

            {/* CTA */}
            <Link
              to="/onboarding"
              onClick={() => rememberSource("/onboarding")}
              className="block w-full min-h-12 py-3 rounded-xl bg-gold text-black font-semibold text-base text-center hover:bg-gold/90 transition-all"
            >
              <span className="flex items-center justify-center gap-2">
                Get Your Complete Kundali Reading
                <ArrowRight className="w-5 h-5" />
              </span>
            </Link>
            <p className="text-center text-white/50 text-sm mt-3">
              Create a free account to save this chart and see your life
              chapters, remedies and guidance that knows your chart
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
              <Link
                to="/synthesis"
                state={{ chartHandoff }}
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
                Choose a guide
              </Link>
            </div>

            {/* Share & Generate another */}
            <div className="flex gap-3 mt-6 justify-center">
              <button
                type="button"
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
                className="px-4 py-2 rounded-xl border border-white/10 text-white/55 hover:text-gold hover:border-gold/30 text-xs uppercase tracking-widest transition-all flex items-center gap-2"
              >
                <Share2 size={14} />
                Share My Kundali
              </button>
            </div>
            <button
              type="button"
              onClick={() => setResult(null)}
              className="block mx-auto mt-4 min-h-11 text-white/60 hover:text-white text-sm underline underline-offset-4 transition-colors"
            >
              Generate another Kundali
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
