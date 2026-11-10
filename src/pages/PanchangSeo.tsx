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
import { MergedGuide } from "../components/seo/MergedGuide";
import { StatusNotice } from "../components/ui/StatusNotice";
import { GlossaryTerm } from "../components/ui/GlossaryTerm";
import type { GlossaryKey } from "../lib/glossary";
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

const PANCHANG_FIELDS = [
  "Tithi",
  "Nakshatra",
  "Yoga",
  "Karana",
  "Sunrise",
  "Sunset",
  "Rahu Kaal",
  "Abhijit Muhurat",
] as const;

const FIELD_CARD = "rounded-xl border border-white/10 bg-white/[0.03] p-4";

/** One plain line per field: what it means for the reader's day. */
const FIELD_HINTS: Record<
  (typeof PANCHANG_FIELDS)[number],
  { hint: string; glossary?: GlossaryKey }
> = {
  Tithi: {
    glossary: "tithi",
    hint: "The lunar day. Decides which fasts and festivals fall today.",
  },
  Nakshatra: {
    glossary: "nakshatra",
    hint: "The Moon's star today. Colours the day's mood.",
  },
  Yoga: {
    hint: "The day's Sun–Moon combination; some are easier than others.",
  },
  Karana: {
    glossary: "karana",
    hint: "Half a lunar day, used to pick a start time.",
  },
  Sunrise: { hint: "The day's timings are counted from local sunrise." },
  Sunset: { hint: "Daytime windows like Rahu Kaal fall before sunset." },
  "Rahu Kaal": {
    glossary: "rahu-kaal",
    hint: "Skip new starts in this window; routine work is fine.",
  },
  "Abhijit Muhurat": {
    glossary: "abhijit",
    hint: "A good window around midday to begin something.",
  },
};

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

  // Mirror the prerender: a dated page without real almanac values is noindex.
  const hasValue = (value?: string) => Boolean(value) && value !== "-";
  const dateDataMissing =
    Boolean(route.date) &&
    date === route.date &&
    (error !== null ||
      (panchang !== null &&
        ![panchang.tithi, panchang.nakshatra, panchang.rahuKaal, panchang.sunrise, panchang.sunset].every(hasValue)));

  return (
    <div>
      <SEO
        title={route.title}
        noindex={dateDataMissing}
        description={`Check ${route.date || "today’s"} Panchang: tithi, nakshatra, sunrise, sunset, Rahu Kaal and auspicious timings for your city.`}
        url={siteUrl(route.path)}
        canonical={siteUrl(route.path)}
        structuredData={structuredData}
      />
      <div className="container mx-auto max-w-5xl px-6 pt-28 pb-20">
        <div className="mb-10 text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-gold/20 bg-gold/10 px-4 py-2 text-xs font-bold uppercase tracking-widest text-gold">
            <Calendar size={14} aria-hidden="true" />
            Free Panchang
          </div>
          <h1 className="type-page-title">{route.title}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-white/55">
            The Panchang is the Hindu almanac for the day. Use it to see the
            best window to start something important and the one to skip.
            Timings follow your city's sunrise, so enter your own city.
          </p>
        </div>

        <section className="sm:rounded-2xl sm:border sm:border-white/10 sm:bg-white/[0.03] sm:p-6">
          <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto]">
            <label className="block">
              <span className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/55">
                <Calendar size={14} aria-hidden="true" /> Date
              </span>
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="platform-field text-white [color-scheme:dark]"
              />
            </label>
            <label className="block">
              <span className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/55">
                <MapPin size={14} aria-hidden="true" /> City
              </span>
              <input
                value={city}
                onChange={(event) => setCity(event.target.value)}
                className="platform-field text-white"
                placeholder="New Delhi"
              />
            </label>
            <button
              type="button"
              onClick={loadPanchang}
              disabled={loading}
              aria-label={loading ? "Loading Panchang" : undefined}
              className="inline-flex min-h-11 items-center justify-center self-end rounded-xl bg-gold px-6 py-3 font-bold uppercase tracking-widest text-black disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={20} aria-hidden="true" />
              ) : (
                "Check"
              )}
            </button>
          </div>
          {error && (
            <StatusNotice
              size="section"
              className="mt-4"
              message={error}
              onRetry={() => void loadPanchang()}
            />
          )}
        </section>

        {/* Same grid while the first result loads, so the guide below does
            not jump when the values arrive. */}
        {!panchang && loading && (
          <section
            className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4"
            aria-busy="true"
            aria-label="Loading Panchang"
          >
            {PANCHANG_FIELDS.map((label) => (
              <div key={label} className={FIELD_CARD}>
                <p className="text-xs font-bold uppercase tracking-widest text-white/50">
                  {label}
                </p>
                <div className="mt-2 h-6 w-3/4 animate-pulse rounded bg-white/10" />
              </div>
            ))}
          </section>
        )}

        {panchang && (
          <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {(
              [
                ["Tithi", panchang.tithi, panchang.tithiEnd],
                ["Nakshatra", panchang.nakshatra, panchang.nakshatraEnd],
                ["Yoga", panchang.yoga],
                ["Karana", panchang.karana],
                ["Sunrise", panchang.sunrise],
                ["Sunset", panchang.sunset],
                ["Rahu Kaal", panchang.rahuKaal],
                ["Abhijit Muhurat", panchang.abhijitMuhurat],
              ] as const
            ).map(([label, value, subtext]) => {
              const { hint, glossary } = FIELD_HINTS[label];
              return (
                <div key={label} className={FIELD_CARD}>
                  <p className="text-xs font-bold uppercase tracking-widest text-white/55">
                    {glossary ? (
                      <GlossaryTerm k={glossary}>{label}</GlossaryTerm>
                    ) : (
                      label
                    )}
                  </p>
                  <p className="mt-2 break-words text-lg text-white/85">
                    {value || "-"}
                  </p>
                  {subtext && (
                    <p className="mt-1 text-sm text-white/55">until {subtext}</p>
                  )}
                  <p className="mt-2 text-xs leading-relaxed text-white/55">
                    {hint}
                  </p>
                </div>
              );
            })}
          </section>
        )}

        {panchang && (
          <section className="mt-6 rounded-2xl border border-gold/20 bg-gold/5 p-6">
            <div className="mb-4 flex items-center gap-2 text-gold">
              <Clock size={18} aria-hidden="true" />
              <h2 className="font-display text-2xl">Plan your day</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-white/55">
                  Best time to start something
                </p>
                <p className="mt-2 text-white/70">
                  {panchang.abhijitMuhurat !== "-"
                    ? `Abhijit Muhurat: ${panchang.abhijitMuhurat}`
                    : panchang.auspiciousTimings[0] ||
                      "Choose a calm daytime window after sunrise."}
                </p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-white/55">
                  Skip new starts during
                </p>
                <p className="mt-2 text-white/70">
                  {panchang.rahuKaal !== "-"
                    ? `Rahu Kaal: ${panchang.rahuKaal}`
                    : panchang.inauspiciousTimings[0] ||
                      "Don't rush important starts today."}
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
            Get My Free Birth Chart
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link
            to="/synthesis"
            onClick={() => rememberSource("/synthesis")}
            className="flex items-center justify-center gap-2 rounded-xl border border-white/15 px-5 py-4 text-sm font-bold uppercase tracking-widest text-white/70 hover:border-gold/30 hover:text-gold"
          >
            <Sparkles size={16} aria-hidden="true" />
            Ask What Today Means For Me
          </Link>
        </section>

        <MergedGuide toolPath={route.path} />
      </div>
    </div>
  );
}
