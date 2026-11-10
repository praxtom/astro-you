import { useState, useEffect, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { Loader2, ArrowLeft } from "lucide-react";
import NotFound from "./NotFound";
import { horoscopeRoute } from "../lib/seo-routing";
import SEO from "../components/SEO";
import {
  captureAcquisitionSource,
  trackAcquisitionEvent,
} from "../lib/acquisition";
import {
  HOROSCOPE_PERIODS,
  ZODIAC_SIGNS,
  getSignHoroscopeContent,
} from "../lib/sign-horoscope-content";
import { viewerDateKey } from "../lib/viewer-timezone";
import { getSiteOrigin, siteUrl } from "../lib/site-url";

export default function SignHoroscope() {
  const { sign, period } = useParams();
  const route = horoscopeRoute(sign, period);
  return route && sign ? (
    <HoroscopeReading
      key={route.path}
      sign={sign}
      period={period}
      route={route}
    />
  ) : (
    <NotFound />
  );
}

function HoroscopeReading({
  sign,
  period = "daily",
  route,
}: {
  sign: string;
  period?: string;
  route: NonNullable<ReturnType<typeof horoscopeRoute>>;
}) {
  const content = getSignHoroscopeContent(sign, period);
  const normalizedSign = content.sign.slug;
  const normalizedPeriod = content.period.slug;
  const signName = content.sign.name;
  const [horoscope, setHoroscope] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fallbackForecast = useMemo(() => content.forecast, [content.forecast]);
  // The viewer's calendar day, fixed for this visit so the date line and the
  // live request agree on which day / week / month / year is being read.
  const viewerToday = useMemo(() => viewerDateKey(), []);
  const periodLabel = useMemo(
    () => formatPeriodSpan(normalizedPeriod, viewerToday),
    [normalizedPeriod, viewerToday],
  );

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    setLoading(true);
    fetch("/api/sign-horoscope", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sign: signName,
        period: normalizedPeriod,
        localDate: viewerToday,
      }),
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
  }, [signName, normalizedPeriod, viewerToday]);

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

  const liveForecast = normalizeHoroscopeText(horoscope);
  const canonicalPath = route.path;
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
      headline: route.title,
      description: content.description,
      mainEntityOfPage: siteUrl(canonicalPath),
      publisher: { "@type": "Organization", name: "AstroYou" },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Home",
          item: getSiteOrigin(),
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Horoscope",
          item: siteUrl("/daily-horoscope"),
        },
        {
          "@type": "ListItem",
          position: 3,
          name: route.title,
          item: siteUrl(canonicalPath),
        },
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
        url: siteUrl(`/horoscope/${normalizedSign}/${item.slug}`),
      })),
    },
  ];

  return (
    <div>
      <SEO
        title={route.title}
        description={content.description}
        url={siteUrl(canonicalPath)}
        canonical={siteUrl(canonicalPath)}
        type="article"
        structuredData={structuredData}
      />
      <div className="max-w-2xl mx-auto px-4 pt-28 pb-16">
        <Link
          to="/free-kundali"
          className="flex items-center gap-2 text-white/60 hover:text-white mb-8 text-sm"
        >
          <ArrowLeft size={16} aria-hidden="true" /> Free Kundali
        </Link>

        <div className="text-center mb-8">
          <span className="text-5xl" aria-hidden="true">
            {content.sign.symbol}
          </span>
          <h1 className="type-page-title mt-4">{route.title}</h1>
          <p className="text-white/60 text-sm mt-2">{periodLabel}</p>
        </div>

        {/* Period tabs */}
        {/* Wraps at 375px: four tracked uppercase tabs overflow one line. */}
        <nav
          aria-label="Horoscope period"
          className="flex flex-wrap gap-2 justify-center mb-8"
        >
          {HOROSCOPE_PERIODS.map((p) => (
            <Link
              key={p.slug}
              to={`/horoscope/${normalizedSign}/${p.slug}`}
              aria-current={normalizedPeriod === p.slug ? "page" : undefined}
              className={`inline-flex min-h-11 items-center px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${
                normalizedPeriod === p.slug
                  ? "bg-gold/10 border-gold/50 text-gold border"
                  : "bg-white/5 border-white/10 text-white/60 border hover:border-white/30"
              }`}
            >
              {p.name}
            </Link>
          ))}
        </nav>

        <div className="glass rounded-[2rem] p-6 sm:p-8" aria-busy={loading}>
          <div className="mb-4 flex items-center gap-2 text-xs uppercase tracking-widest text-white/55">
            {loading && (
              <Loader2 size={14} className="animate-spin" aria-hidden="true" />
            )}
            <span>
              {loading ? "Refreshing live reading" : "Current guidance"}
            </span>
          </div>
          {/* The fallback stays in flow (hidden once the live reading lands) so
              the card never shrinks when the text swaps — no layout jump. */}
          <div className="grid">
            <p
              className={`col-start-1 row-start-1 text-base sm:text-lg text-white/80 leading-relaxed ${
                liveForecast ? "invisible" : ""
              }`}
            >
              {fallbackForecast}
            </p>
            {liveForecast && (
              <p className="col-start-1 row-start-1 text-base sm:text-lg text-white/80 leading-relaxed">
                {liveForecast}
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {content.focusAreas.map((item) => (
            <section
              key={item.title}
              className="rounded-xl border border-white/10 bg-white/[0.03] p-4"
            >
              <h2 className="font-body text-sm font-semibold text-white/85">
                {item.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-white/65">
                {item.body}
              </p>
            </section>
          ))}
        </div>

        {/* Other signs */}
        <div className="mt-12">
          <h2 className="font-body text-xs font-bold text-white/55 uppercase tracking-widest text-center mb-4">
            Other Signs
          </h2>
          <div className="flex flex-wrap gap-2 justify-center">
            {ZODIAC_SIGNS.filter((s) => s.slug !== normalizedSign).map((s) => (
              <Link
                key={s.slug}
                to={`/horoscope/${s.slug}/${normalizedPeriod}`}
                className="inline-flex min-h-11 items-center px-3 py-1.5 rounded-lg bg-white/5 text-white/60 text-xs hover:text-gold hover:border-gold/30 border border-white/10 transition-all"
              >
                {s.symbol} {s.name}
              </Link>
            ))}
          </div>
        </div>

        <nav
          aria-label="Related astrology tools"
          className="mt-10 flex flex-wrap justify-center gap-2"
        >
          {relatedLinks.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className="inline-flex min-h-11 items-center rounded-full border border-gold/20 px-3 py-1.5 text-xs text-gold/80 hover:bg-gold/10"
              onClick={() => rememberSource(item.href)}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* CTA */}
        <div className="mt-12 text-center">
          <p className="text-white/60 text-sm mb-4">
            Want a reading based on your own birth chart?
          </p>
          <Link
            to="/free-kundali"
            onClick={() => rememberSource("/free-kundali")}
            className="inline-flex min-h-11 items-center px-6 py-3 rounded-xl bg-gold text-black font-bold text-sm"
          >
            Get Free Kundali
          </Link>
        </div>
      </div>
    </div>
  );
}

/**
 * The span a reading covers, in en-IN style, from the viewer's YYYY-MM-DD day.
 * Weeks run Monday to Sunday — the same week the sign-horoscope API reads.
 *   daily   → "Tuesday, 10 November 2026"
 *   weekly  → "9–15 November 2026"
 *   monthly → "November 2026"
 *   yearly  → "2026"
 */
function formatPeriodSpan(period: string, dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d));
  // Dates are built at UTC midnight, so format in UTC to keep the same day.
  switch (period) {
    case "weekly": {
      const sinceMonday = (day.getUTCDay() + 6) % 7;
      const start = new Date(Date.UTC(y, m - 1, d - sinceMonday));
      const end = new Date(Date.UTC(y, m - 1, d - sinceMonday + 6));
      const part = (date: Date, withMonth: boolean, withYear: boolean) =>
        date.toLocaleDateString("en-IN", {
          day: "numeric",
          month: withMonth ? "long" : undefined,
          year: withYear ? "numeric" : undefined,
          timeZone: "UTC",
        });
      const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
      const sameMonth = sameYear && start.getUTCMonth() === end.getUTCMonth();
      // "9–15 November 2026", "30 November – 6 December 2026",
      // "28 December 2026 – 3 January 2027"
      if (sameMonth)
        return `${part(start, false, false)}–${part(end, true, true)}`;
      return `${part(start, true, !sameYear)} – ${part(end, true, true)}`;
    }
    case "monthly":
      return day.toLocaleDateString("en-IN", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      });
    case "yearly":
      return String(y);
    default:
      return day.toLocaleDateString("en-IN", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      });
  }
}

function normalizeHoroscopeText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (!value || typeof value !== "object") return "";
  const data = value as {
    text?: unknown;
    horoscope?: unknown;
    prediction?: unknown;
    summary?: unknown;
  };
  const text = data.text || data.horoscope || data.prediction || data.summary;
  return typeof text === "string" ? text.trim() : "";
}
