import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Calendar, Loader2, MapPin, Sparkles } from "lucide-react";
import Header from "../components/layout/Header";
import SEO from "../components/SEO";
import { captureAcquisitionSource, trackAcquisitionEvent } from "../lib/acquisition";
import {
  buildFallbackPanchangSummary,
  normalizePanchangResponse,
  type PanchangSummary,
} from "../lib/panchang-normalize";

const todayIso = () => new Date().toISOString().split("T")[0];

const PURPOSE_GUIDANCE: Record<string, string> = {
  business: "Prioritize clear agreements, clean documentation, and a steady first step.",
  marriage: "Use this as a first filter. Personal charts and family context still matter.",
  travel: "Avoid rushed departures and keep the first hour calm.",
  home: "Favor a clean, prayerful start and avoid Rahu Kaal for the first action.",
};

export default function MuhuratSeo() {
  const [date, setDate] = useState(todayIso());
  const [city, setCity] = useState("New Delhi");
  const [purpose, setPurpose] = useState("business");
  const [panchang, setPanchang] = useState<PanchangSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usingFallback, setUsingFallback] = useState(false);
  const initialLoadRef = useRef(false);

  const loadMuhurat = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/kundali", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chartType: "PANCHANG", date, city }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not load Muhurat");
      setPanchang(normalizePanchangResponse(data.data ?? data));
      setUsingFallback(false);
      trackAcquisitionEvent("seo_tool_complete", {
        tool: "muhurat",
        city,
        date,
        purpose,
      });
    } catch (err: any) {
      console.warn("[MuhuratSeo] Live Muhurat refresh failed:", err);
      setPanchang(buildFallbackPanchangSummary());
      setUsingFallback(true);
      setError(null);
    } finally {
      setLoading(false);
    }
  }, [city, date, purpose]);

  useEffect(() => {
    if (initialLoadRef.current) return;
    initialLoadRef.current = true;
    void loadMuhurat();
  }, [loadMuhurat]);

  const recommendation = useMemo(() => {
    if (!panchang) return null;
    const best =
      panchang.abhijitMuhurat !== "-"
        ? panchang.abhijitMuhurat
        : panchang.auspiciousTimings[0] || "After sunrise, outside Rahu Kaal";
    return {
      best,
      avoid:
        panchang.rahuKaal !== "-"
          ? panchang.rahuKaal
          : panchang.inauspiciousTimings[0] || "Rushed starts",
      note: PURPOSE_GUIDANCE[purpose],
    };
  }, [panchang, purpose]);

  const rememberSource = (target: string) => {
    captureAcquisitionSource({
      source: "muhurat",
      medium: "seo_tool",
      campaign: "free_tool_funnel",
    });
    trackAcquisitionEvent("seo_cta_click", { tool: "muhurat", target });
  };

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Free Muhurat Finder",
    applicationCategory: "LifestyleApplication",
    url: "https://astroyou.app/muhurat",
    offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
  };

  return (
    <div className="min-h-screen bg-[#030308] text-white">
      <SEO
        title="Free Muhurat Finder: Auspicious Timing from Panchang"
        description="Find a free Muhurat guide for business, marriage, travel, and home activities using Panchang, Rahu Kaal, and Abhijit Muhurat."
        url="https://astroyou.app/muhurat"
        canonical="https://astroyou.app/muhurat"
        structuredData={structuredData}
      />
      <Header />
      <main className="container mx-auto max-w-5xl px-6 pt-28 pb-20">
        <div className="mb-10 text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-gold/20 bg-gold/10 px-4 py-2 text-xs font-bold uppercase tracking-widest text-gold">
            <Sparkles size={14} />
            Free Muhurat
          </div>
          <h1 className="font-display text-4xl md:text-5xl">Free Muhurat Finder</h1>
          <p className="mx-auto mt-4 max-w-2xl text-white/55">
            Pick a date, place, and purpose. AstroYou checks Panchang timing and
            gives a clear first-pass Muhurat guide.
          </p>
        </div>

        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <div className="grid gap-4 md:grid-cols-[1fr_1fr_1fr_auto]">
            <label className="block">
              <span className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/40">
                <Calendar size={14} /> Date
              </span>
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white [color-scheme:dark]"
              />
            </label>
            <label className="block">
              <span className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/40">
                <MapPin size={14} /> City
              </span>
              <input
                value={city}
                onChange={(event) => setCity(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white"
                placeholder="New Delhi"
              />
            </label>
            <label className="block">
              <span className="mb-2 text-xs font-bold uppercase tracking-widest text-white/40">
                Purpose
              </span>
              <select
                value={purpose}
                onChange={(event) => setPurpose(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white"
              >
                <option value="business">Business start</option>
                <option value="marriage">Marriage step</option>
                <option value="travel">Travel</option>
                <option value="home">Home or griha pravesh</option>
              </select>
            </label>
            <button
              onClick={loadMuhurat}
              disabled={loading}
              className="self-end rounded-xl bg-gold px-6 py-3 font-bold uppercase tracking-widest text-black disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : "Find"}
            </button>
          </div>
          {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
          {usingFallback && (
            <p className="mt-4 text-sm text-amber-200/70">
              Live Muhurat timing is refreshing. Use this as a first-pass guide and recheck before important commitments.
            </p>
          )}
        </section>

        {recommendation && panchang && (
          <section className="mt-6 rounded-2xl border border-gold/20 bg-gold/5 p-6">
            <h2 className="font-display text-2xl text-white/90">Recommended Window</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-white/35">
                  Favor
                </p>
                <p className="mt-2 text-lg text-gold">{recommendation.best}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-white/35">
                  Avoid
                </p>
                <p className="mt-2 text-lg text-white/80">{recommendation.avoid}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-white/35">
                  Guidance
                </p>
                <p className="mt-2 text-white/65">{recommendation.note}</p>
              </div>
            </div>
            <div className="mt-6 grid gap-3 md:grid-cols-4">
              <p className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-white/60">
                Tithi: <span className="text-white">{panchang.tithi}</span>
              </p>
              <p className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-white/60">
                Nakshatra: <span className="text-white">{panchang.nakshatra}</span>
              </p>
              <p className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-white/60">
                Yoga: <span className="text-white">{panchang.yoga}</span>
              </p>
              <p className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-white/60">
                Sunrise: <span className="text-white">{panchang.sunrise}</span>
              </p>
            </div>
          </section>
        )}

        <section className="mt-10 grid gap-3 sm:grid-cols-2">
          <Link
            to="/consult/pandit-raghunath/profile"
            onClick={() => rememberSource("/consult/pandit-raghunath/profile")}
            className="flex items-center justify-center gap-2 rounded-xl bg-gold px-5 py-4 text-sm font-bold uppercase tracking-widest text-black"
          >
            Get Exact Personal Muhurat
            <ArrowRight size={16} />
          </Link>
          <Link
            to="/panchang"
            onClick={() => rememberSource("/panchang")}
            className="flex items-center justify-center gap-2 rounded-xl border border-white/15 px-5 py-4 text-sm font-bold uppercase tracking-widest text-white/70 hover:border-gold/30 hover:text-gold"
          >
            View Full Panchang
          </Link>
        </section>
      </main>
    </div>
  );
}
