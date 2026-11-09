import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { postJson } from "../lib/apiFetch";
import { Link, useParams } from "react-router-dom";
import { ArrowRight, Calendar, Loader2, MapPin, Sparkles } from "lucide-react";
import SEO from "../components/SEO";
import {
  captureAcquisitionSource,
  trackAcquisitionEvent,
} from "../lib/acquisition";
import {
  normalizePanchangResponse,
  type PanchangSummary,
} from "../lib/panchang-normalize";
import { viewerDateKey } from "../lib/viewer-timezone";
import NotFound from "./NotFound";
import { muhuratRoute } from "../lib/seo-routing";
import { siteUrl } from "../lib/site-url";

const todayIso = () => viewerDateKey();

const PURPOSE_GUIDANCE: Record<string, string> = {
  business:
    "Prioritize clear agreements, clean documentation, and a steady first step.",
  marriage:
    "Use this as a first filter. Personal charts and family context still matter.",
  travel: "Avoid rushed departures and keep the first hour calm.",
  home: "Favor a clean, prayerful start and avoid Rahu Kaal for the first action.",
};

export default function MuhuratSeo() {
  const { category } = useParams();
  const route = muhuratRoute(category);
  return route ? <MuhuratTool key={route.path} route={route} /> : <NotFound />;
}

function MuhuratTool({ route }: { route: NonNullable<ReturnType<typeof muhuratRoute>> }) {
  const [date, setDate] = useState(todayIso());
  const [city, setCity] = useState("New Delhi");
  const [purpose, setPurpose] = useState(route.purpose);
  const [panchang, setPanchang] = useState<PanchangSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initialLoadRef = useRef(false);
  const requestRef = useRef<AbortController | null>(null);
  useEffect(() => () => {
    initialLoadRef.current = false;
    requestRef.current?.abort();
  }, []);

  const loadMuhurat = useCallback(async () => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const res = await postJson("/api/kundali", {
        chartType: "PANCHANG",
        date,
        city,
      }, { signal: controller.signal });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not load Muhurat");
      if (controller.signal.aborted) return;
      setPanchang(normalizePanchangResponse(data.data ?? data));
      trackAcquisitionEvent("seo_tool_complete", {
        tool: "muhurat",
        city,
        date,
        purpose,
      });
    } catch (err: any) {
      if (controller.signal.aborted) return;
      console.warn("[MuhuratSeo] Live Muhurat refresh failed:", err);
      setPanchang(null);
      setError("Muhurat timings are unavailable. Please try again.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
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
    url: siteUrl(route.path),
    offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
  };

  return (
    <div>
      <SEO
        title={route.title}
        description={`${route.title}: check Panchang, Rahu Kaal and Abhijit Muhurat for your chosen date and city.`}
        url={siteUrl(route.path)}
        canonical={siteUrl(route.path)}
        structuredData={structuredData}
      />
      <div className="container mx-auto max-w-5xl px-6 pt-28 pb-20">
        <div className="mb-10 text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-gold/20 bg-gold/10 px-4 py-2 text-xs font-bold uppercase tracking-widest text-gold">
            <Sparkles size={14} />
            Free Muhurat
          </div>
          <h1 className="type-page-title">
            {route.title}
          </h1>
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
              {loading ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                "Find"
              )}
            </button>
          </div>
          {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
        </section>

        {recommendation && panchang && (
          <section className="mt-6 rounded-2xl border border-gold/20 bg-gold/5 p-6">
            <h2 className="font-display text-2xl text-white/90">
              Recommended Window
            </h2>
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
                <p className="mt-2 text-lg text-white/80">
                  {recommendation.avoid}
                </p>
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
                Nakshatra:{" "}
                <span className="text-white">{panchang.nakshatra}</span>
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
      </div>
    </div>
  );
}
