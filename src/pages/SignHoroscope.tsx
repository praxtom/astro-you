import { useState, useEffect, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { Loader2, ArrowLeft } from "lucide-react";
import SEO from "../components/SEO";
import { captureAcquisitionSource, trackAcquisitionEvent } from "../lib/acquisition";
import {
  HOROSCOPE_PERIODS,
  ZODIAC_SIGNS,
  getSignHoroscopeContent,
} from "../lib/sign-horoscope-content";

export default function SignHoroscope() {
  const { sign = "aries", period = "daily" } = useParams();
  const content = getSignHoroscopeContent(sign, period);
  const normalizedSign = content.sign.slug;
  const normalizedPeriod = content.period.slug;
  const signName = content.sign.name;
  const periodName = content.period.name;
  const [horoscope, setHoroscope] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fallbackForecast = useMemo(
    () => content.forecast,
    [content.forecast],
  );

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    setLoading(true);
    fetch("/api/sign-horoscope", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sign: signName, period: normalizedPeriod }),
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setHoroscope(d.data);
        trackAcquisitionEvent("seo_tool_complete", {
          tool: "sign_horoscope",
          sign: signName,
          period: normalizedPeriod,
        });
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [signName, normalizedPeriod]);

  const rememberSource = (target: string) => {
    captureAcquisitionSource({
      source: `horoscope-${normalizedSign}-${normalizedPeriod}`,
      medium: "seo_tool",
      campaign: "sign_horoscope",
    });
    trackAcquisitionEvent("seo_cta_click", {
      tool: "sign_horoscope",
      sign: signName,
      period: normalizedPeriod,
      target,
    });
  };

  const forecastText = normalizeHoroscopeText(horoscope) || fallbackForecast;
  const canonicalPath = content.path;
  const relatedLinks = [
    ...HOROSCOPE_PERIODS.map((item) => ({
      label: `${signName} ${item.name}`,
      href: `/horoscope/${normalizedSign}/${item.slug}`,
    })),
    { label: "Free Kundali", href: "/free-kundali" },
    { label: "Today Panchang", href: "/panchang" },
  ];

  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: `${signName} ${periodName} Horoscope`,
      description: content.description,
      mainEntityOfPage: `https://astroyou.app${canonicalPath}`,
      publisher: { "@type": "Organization", name: "AstroYou" },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://astroyou.app" },
        { "@type": "ListItem", position: 2, name: "Horoscope", item: "https://astroyou.app/daily-horoscope" },
        { "@type": "ListItem", position: 3, name: `${signName} ${periodName}`, item: `https://astroyou.app${canonicalPath}` },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: `${signName} horoscope periods`,
      itemListElement: HOROSCOPE_PERIODS.map((item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: `${signName} ${item.name} horoscope`,
        url: `https://astroyou.app/horoscope/${normalizedSign}/${item.slug}`,
      })),
    },
  ];

  return (
    <div className="min-h-screen bg-[#030308] text-white p-6">
      <SEO
        title={`${signName} ${periodName} Horoscope`}
        description={content.description}
        url={`https://astroyou.app${canonicalPath}`}
        canonical={`https://astroyou.app${canonicalPath}`}
        type="article"
        structuredData={structuredData}
      />
      <div className="max-w-2xl mx-auto pt-8">
        <Link
          to="/free-kundali"
          className="flex items-center gap-2 text-white/40 hover:text-white mb-8 text-sm"
        >
          <ArrowLeft size={16} /> Free Kundali
        </Link>

        <div className="text-center mb-8">
          <span className="text-5xl">{content.sign.symbol}</span>
          <h1 className="text-3xl font-display mt-4">
            {signName} {periodName} Horoscope
          </h1>
          <p className="text-white/40 text-sm mt-2">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>

        {/* Period tabs */}
        <div className="flex gap-2 justify-center mb-8">
          {HOROSCOPE_PERIODS.map((p) => (
            <Link
              key={p.slug}
              to={`/horoscope/${normalizedSign}/${p.slug}`}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${
                normalizedPeriod === p.slug
                  ? "bg-gold/10 border-gold/50 text-gold border"
                  : "bg-white/5 border-white/10 text-white/40 border hover:border-white/30"
              }`}
            >
              {p.name}
            </Link>
          ))}
        </div>

        <div className="glass rounded-[2rem] p-8">
          <div className="mb-4 flex items-center gap-2 text-xs uppercase tracking-widest text-white/35">
            {loading && <Loader2 size={14} className="animate-spin" />}
            <span>{loading ? "Refreshing live reading" : "Current guidance"}</span>
          </div>
          <p className="text-lg text-white/80 leading-relaxed font-light">
            {forecastText}
          </p>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {content.focusAreas.map((item) => (
            <section key={item.title} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <h2 className="text-sm font-semibold text-white/85">{item.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-white/50">{item.body}</p>
            </section>
          ))}
        </div>

        {/* Other signs */}
        <div className="mt-12">
          <h2 className="text-xs text-white/30 uppercase tracking-widest text-center mb-4">
            Other Signs
          </h2>
          <div className="flex flex-wrap gap-2 justify-center">
            {ZODIAC_SIGNS.filter((s) => s.slug !== normalizedSign).map((s) => (
              <Link
                key={s.slug}
                to={`/horoscope/${s.slug}/${normalizedPeriod}`}
                className="px-3 py-1.5 rounded-lg bg-white/5 text-white/40 text-xs hover:text-gold hover:border-gold/30 border border-white/10 transition-all"
              >
                {s.symbol} {s.name}
              </Link>
            ))}
          </div>
        </div>

        <nav aria-label="Related astrology tools" className="mt-10 flex flex-wrap justify-center gap-2">
          {relatedLinks.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className="rounded-full border border-gold/20 px-3 py-1.5 text-xs text-gold/80 hover:bg-gold/10"
              onClick={() => rememberSource(item.href)}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* CTA */}
        <div className="mt-12 text-center">
          <p className="text-white/40 text-sm mb-4">
            Want personalized predictions based on YOUR birth chart?
          </p>
          <Link
            to="/free-kundali"
            onClick={() => rememberSource("/free-kundali")}
            className="inline-block px-6 py-3 rounded-xl bg-gold text-black font-bold text-sm"
          >
            Get Free Kundali
          </Link>
        </div>
      </div>
    </div>
  );
}

function normalizeHoroscopeText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (!value || typeof value !== "object") return "";
  const data = value as { text?: unknown; horoscope?: unknown; prediction?: unknown; summary?: unknown };
  const text = data.text || data.horoscope || data.prediction || data.summary;
  return typeof text === "string" ? text.trim() : "";
}
