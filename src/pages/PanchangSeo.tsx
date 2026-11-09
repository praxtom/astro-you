import { useCallback, useEffect, useRef, useState } from "react";
import { postJson } from "../lib/apiFetch";
import { Link, useParams } from "react-router-dom";
import {
  ArrowRight,
  Calendar,
  Clock,
  Loader2,
  MapPin,
  Sparkles,
} from "lucide-react";
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
import { panchangRoute } from "../lib/seo-routing";
import { siteUrl } from "../lib/site-url";

const todayIso = () => viewerDateKey();

export default function PanchangSeo() {
  const { date } = useParams();
  const route = panchangRoute(date);
  return route ? <PanchangTool key={route.path} route={route} /> : <NotFound />;
}

function PanchangTool({ route }: { route: NonNullable<ReturnType<typeof panchangRoute>> }) {
  const [date, setDate] = useState(route.date || todayIso());
  const [city, setCity] = useState("New Delhi");
  const [panchang, setPanchang] = useState<PanchangSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initialLoadRef = useRef(false);
  const requestRef = useRef<AbortController | null>(null);
  useEffect(() => () => {
    initialLoadRef.current = false;
    requestRef.current?.abort();
  }, []);

  const loadPanchang = useCallback(async () => {
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
      if (!res.ok) throw new Error(data.error || "Could not load Panchang");
      if (controller.signal.aborted) return;
      setPanchang(normalizePanchangResponse(data.data ?? data));
      trackAcquisitionEvent("seo_tool_complete", {
        tool: "panchang",
        city,
        date,
      });
    } catch (err: any) {
      if (controller.signal.aborted) return;
      console.warn("[PanchangSeo] Live Panchang refresh failed:", err);
      setPanchang(null);
      setError("Panchang timings are unavailable. Please try again.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [city, date]);

  useEffect(() => {
    if (initialLoadRef.current) return;
    initialLoadRef.current = true;
    void loadPanchang();
  }, [loadPanchang]);

  const rememberSource = (target: string) => {
    captureAcquisitionSource({
      source: "panchang",
      medium: "seo_tool",
      campaign: "free_tool_funnel",
    });
    trackAcquisitionEvent("seo_cta_click", { tool: "panchang", target });
  };

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Today Panchang",
    applicationCategory: "LifestyleApplication",
    url: siteUrl(route.path),
    offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
  };

  return (
    <div>
      <SEO
        title={route.title}
        description={`Check ${route.date || "today’s"} Panchang: tithi, nakshatra, sunrise, sunset, Rahu Kaal and auspicious timings for your city.`}
        url={siteUrl(route.path)}
        canonical={siteUrl(route.path)}
        structuredData={structuredData}
      />
      <div className="container mx-auto max-w-5xl px-6 pt-28 pb-20">
        <div className="mb-10 text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-gold/20 bg-gold/10 px-4 py-2 text-xs font-bold uppercase tracking-widest text-gold">
            <Calendar size={14} />
            Free Panchang
          </div>
          <h1 className="type-page-title">{route.title}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-white/55">
            Get tithi, nakshatra, yoga, karana, sunrise, sunset, Rahu Kaal, and
            daily auspicious timing in under a minute.
          </p>
        </div>

        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto]">
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
            <button
              onClick={loadPanchang}
              disabled={loading}
              className="self-end rounded-xl bg-gold px-6 py-3 font-bold uppercase tracking-widest text-black disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                "Check"
              )}
            </button>
          </div>
          {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
        </section>

        {panchang && (
          <section className="mt-6 grid gap-4 md:grid-cols-2">
            {[
              ["Tithi", panchang.tithi, panchang.tithiEnd],
              ["Nakshatra", panchang.nakshatra, panchang.nakshatraEnd],
              ["Yoga", panchang.yoga],
              ["Karana", panchang.karana],
              ["Sunrise", panchang.sunrise],
              ["Sunset", panchang.sunset],
              ["Rahu Kaal", panchang.rahuKaal],
              ["Abhijit Muhurat", panchang.abhijitMuhurat],
            ].map(([label, value, subtext]) => (
              <div
                key={label}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
              >
                <p className="text-xs font-bold uppercase tracking-widest text-white/35">
                  {label}
                </p>
                <p className="mt-2 text-xl text-white/85">{value || "-"}</p>
                {subtext && (
                  <p className="mt-1 text-sm text-white/35">until {subtext}</p>
                )}
              </div>
            ))}
          </section>
        )}

        {panchang && (
          <section className="mt-6 rounded-2xl border border-gold/20 bg-gold/5 p-6">
            <div className="mb-4 flex items-center gap-2 text-gold">
              <Clock size={18} />
              <h2 className="font-display text-2xl">Useful Timing Today</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-white/35">
                  Favor
                </p>
                <p className="mt-2 text-white/70">
                  {panchang.abhijitMuhurat !== "-"
                    ? `Use Abhijit Muhurat: ${panchang.abhijitMuhurat}`
                    : panchang.auspiciousTimings[0] ||
                      "Choose a calm daytime window after sunrise."}
                </p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-white/35">
                  Avoid
                </p>
                <p className="mt-2 text-white/70">
                  {panchang.rahuKaal !== "-"
                    ? `Avoid Rahu Kaal: ${panchang.rahuKaal}`
                    : panchang.inauspiciousTimings[0] ||
                      "Avoid rushing important starts."}
                </p>
              </div>
            </div>
          </section>
        )}

        <section className="mt-10 grid gap-3 sm:grid-cols-2">
          <Link
            to="/free-kundali"
            onClick={() => rememberSource("/free-kundali")}
            className="flex items-center justify-center gap-2 rounded-xl bg-gold px-5 py-4 text-sm font-bold uppercase tracking-widest text-black"
          >
            Save My Birth Chart
            <ArrowRight size={16} />
          </Link>
          <Link
            to="/synthesis"
            onClick={() => rememberSource("/synthesis")}
            className="flex items-center justify-center gap-2 rounded-xl border border-white/15 px-5 py-4 text-sm font-bold uppercase tracking-widest text-white/70 hover:border-gold/30 hover:text-gold"
          >
            <Sparkles size={16} />
            Ask For Today Guidance
          </Link>
        </section>
      </div>
    </div>
  );
}
