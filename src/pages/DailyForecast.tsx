import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { PageShell } from "../components/layout/PageShell";
import { AskJyotishBridge } from "../components/layout/AskJyotishBridge";
import {
  Sparkles,
  Sun,
  Clock,
  Star,
  Calendar,
  Zap,
  Target,
  MessageCircle,
  Activity,
  Heart,
  Briefcase,
  Shield,
  Download,
  Share2,
  RefreshCw,
  LogIn,
} from "lucide-react";
import { useSubscription, useUserProfile } from "../hooks";
import { useRequestBirthData } from "../hooks/useRequestBirthData";
import { useAuth } from "../lib/useAuth";
import AuthModal from "../components/AuthModal";
import { REPORT_PRICING, type ReportType } from "../lib/report-pricing";
import { FullPageSkeleton } from "../components/ui/Skeleton";
import type { ForecastData } from "../types";
import { postJson } from "../lib/apiFetch";
import { viewerDateKey } from "../lib/viewer-timezone";

const getAreaIcon = (area: string) => {
  switch (area.toLowerCase()) {
    case "love":
      return <Heart size={20} />;
    case "career":
      return <Briefcase size={20} />;
    case "finance":
      return <Shield size={20} />;
    case "health":
      return <Activity size={20} />;
    case "communication":
      return <MessageCircle size={20} />;
    case "identity":
      return <Target size={20} />;
    default:
      return <Sparkles size={20} />;
  }
};

const getAreaColor = (area: string) => {
  switch (area.toLowerCase()) {
    case "love":
      return "text-rose-400 bg-rose-400/10 border-rose-400/20";
    case "career":
      return "text-blue-400 bg-blue-400/10 border-blue-400/20";
    case "finance":
      return "text-emerald-400 bg-emerald-400/10 border-emerald-400/20";
    case "health":
      return "text-cyan-400 bg-cyan-400/10 border-cyan-400/20";
    case "communication":
      return "text-amber-400 bg-amber-400/10 border-amber-400/20";
    case "identity":
      return "text-violet-400 bg-violet-400/10 border-violet-400/20";
    default:
      return "text-gold bg-gold/10 border-gold/20";
  }
};

const DailyForecast: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    birthData: profileBirthData,
    profile,
    loading: profileLoading,
  } = useUserProfile();
  // Stable on the birth fields only, so a credits/user-doc write doesn't
  // refetch the forecast and flash the skeleton.
  const requestBirthData = useRequestBirthData(profileBirthData);
  const birthData = requestBirthData?.dob ? requestBirthData : null;
  const { credits } = useSubscription();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Why the personal forecast is missing. We never substitute invented
  // content for the user's forecast: each failure gets an honest state.
  const [errorKind, setErrorKind] = useState<
    "auth" | "credits" | "unavailable" | null
  >(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfSuccess, setPdfSuccess] = useState<string | null>(null);
  const [forecast, setForecast] = useState<ForecastData | null>(null);
  const [period, setPeriod] = useState<
    "daily" | "weekly" | "monthly" | "yearly"
  >("daily");
  const [downloading, setDownloading] = useState(false);
  const [feedbackSignal, setFeedbackSignal] = useState<
    "accurate" | "partly" | "missed" | null
  >(null);
  const [feedbackNotes, setFeedbackNotes] = useState("");
  const [feedbackStatus, setFeedbackStatus] = useState("");
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);

  useEffect(() => {
    if (profileLoading) return;

    if (!birthData) {
      setForecast(null);
      setError(null);
      setErrorKind(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const fetchForecast = async () => {
      try {
        setLoading(true);
        const response = await postJson(
          "/api/horoscope",
          {
            birthData,
            date: viewerDateKey(),
            localDate: viewerDateKey(),
            period,
          },
          { signal: controller.signal },
        );

        if (!response.ok) {
          const body = await response.json().catch(() => ({}) as any);
          // Out of credits must be SHOWN, not papered over with fallback
          // content — otherwise the user never learns why the real forecast
          // isn't loading.
          if (response.status === 402) {
            setForecast(null);
            setErrorKind("credits");
            setError(
              body.error ||
                "You're out of credits. Top up to unlock this forecast.",
            );
            return;
          }
          if (response.status === 401) {
            setForecast(null);
            setErrorKind("auth");
            setError("Sign in to see your personal forecast.");
            return;
          }
          // 503 forecast_unavailable: the server refunded the reservation and
          // says so ("No credits were used") — show its copy, not ours.
          if (response.status === 503) {
            setForecast(null);
            setErrorKind("unavailable");
            setError(
              typeof body.error === "string" && body.error
                ? body.error
                : "Your forecast is temporarily unavailable. Please try again in a moment.",
            );
            return;
          }
          throw new Error(body.error || `Forecast failed: ${response.status}`);
        }
        const data = await response.json();
        if (controller.signal.aborted) return;
        setForecast(data);
        setError(null);
        setErrorKind(null);
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        console.error("Error fetching forecast:", err);
        setForecast(null);
        setErrorKind("unavailable");
        setError(
          "Your forecast is temporarily unavailable. Please try again in a moment.",
        );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    fetchForecast();
    return () => controller.abort();
  }, [birthData, profileLoading, period, retryNonce, user]);

  // The forecast PDF goes through the priced reports flow (/api/pdf-report),
  // which charges credits and saves the report to the user's library.
  // Monthly has no PDF product, so it hands off to the reports page.
  const pdfReportType: ReportType | null =
    period === "monthly" ? null : (period as ReportType);
  const pdfPrice = pdfReportType
    ? REPORT_PRICING[pdfReportType].creditCost
    : null;

  const handleDownloadPDF = async () => {
    if (!birthData || downloading) return;
    setPdfError(null);
    setPdfSuccess(null);
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    if (!pdfReportType || pdfPrice === null) {
      navigate("/reports");
      return;
    }
    if (credits < pdfPrice) {
      setPdfError(
        `This PDF costs ${pdfPrice} credits and you have ${credits}. Top up on the Reports page to continue.`,
      );
      return;
    }
    const confirmed = window.confirm(
      `Generate your ${REPORT_PRICING[pdfReportType].title} for ${pdfPrice} credits? It will also be saved to your Reports library.`,
    );
    if (!confirmed) return;

    setDownloading(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch("/api/pdf-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idToken,
          birthData: {
            name: birthData.name || profile?.name || "Seeker",
            dob: birthData.dob,
            tob: birthData.tob,
            pob: birthData.pob || profile?.pob || "",
            lat: birthData.coordinates?.lat ?? profile?.coordinates?.lat,
            lng: birthData.coordinates?.lng ?? profile?.coordinates?.lng,
          },
          reportType: pdfReportType,
          date: viewerDateKey(),
          localDate: viewerDateKey(),
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        if (response.status === 402) {
          throw new Error(
            payload?.error ||
              `You need ${pdfPrice} credits for this PDF. Top up on the Reports page.`,
          );
        }
        throw new Error(
          payload?.error ||
            "We couldn't generate the PDF right now. No credits were used — please try again.",
        );
      }
      const blob = await response.blob();
      const filename =
        response.headers
          .get("Content-Disposition")
          ?.match(/filename="([^"]+)"/)?.[1] ||
        `astroyou-${pdfReportType}-report.pdf`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      setPdfSuccess("PDF generated and saved to your Reports library.");
    } catch (err) {
      setPdfError(
        err instanceof Error ? err.message : "Could not generate the PDF.",
      );
    } finally {
      setDownloading(false);
    }
  };

  const submitPredictionFeedback = async (
    signal: "accurate" | "partly" | "missed",
  ) => {
    if (!user) {
      navigate("/onboarding", { replace: true });
      return;
    }
    setFeedbackSignal(signal);
    setFeedbackSubmitting(true);
    setFeedbackStatus("");
    try {
      const idToken = await user.getIdToken();
      const forecastDate = viewerDateKey();
      const response = await fetch("/api/trust/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idToken,
          kind: "prediction_feedback",
          source: "daily_forecast",
          period,
          forecastDate,
          signal,
          notes: feedbackNotes,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(data.error || `Feedback failed: ${response.status}`);
      setFeedbackStatus(
        "Feedback saved. We use this in aggregate accuracy tracking.",
      );
    } catch (err: any) {
      console.error("Prediction feedback failed:", err);
      setFeedbackStatus(
        "Your feedback couldn't be saved. Check your connection and try again.",
      );
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  if (profileLoading || loading) return <FullPageSkeleton />;

  if (!birthData) {
    return (
      <PageShell>
        <div className="mx-auto max-w-3xl">
          <div className="rounded-2xl border border-white/10 bg-white/3 p-6 md:p-8">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-gold/20 bg-gold/10 px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-gold">
              <Calendar size={14} />
              Personal forecast
            </div>
            <h1 className="type-page-title">
              Create your birth profile to see a personal forecast.
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-white/55">
              Your daily, weekly, monthly, and yearly readings need birth date,
              birth time, and birthplace so the forecast can use your chart.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <button
                onClick={() => navigate("/onboarding")}
                className="rounded-xl bg-gold px-5 py-3 text-sm font-bold uppercase tracking-widest text-black transition hover:bg-gold/90"
              >
                Create Profile
              </button>
              <button
                onClick={() => navigate("/horoscope/aries/daily")}
                className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold uppercase tracking-widest text-white/70 transition hover:border-gold/30 hover:text-gold"
              >
                Browse Sign Forecasts
              </button>
            </div>
          </div>
        </div>
      </PageShell>
    );
  }

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const h = forecast?.horoscope;

  return (
    <PageShell>
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col gap-2 mb-4 sm:flex-row sm:items-center">
          <div
            role="tablist"
            aria-label="Forecast period"
            className="grid grid-cols-4 gap-1.5 sm:flex sm:gap-2"
          >
          {(["daily", "weekly", "monthly", "yearly"] as const).map((p) => (
            <button
              key={p}
              type="button"
              role="tab"
              aria-selected={period === p}
              onClick={() => setPeriod(p)}
              className={`min-h-11 min-w-0 px-1.5 sm:px-4 py-1.5 rounded-xl border text-xs sm:text-sm font-bold uppercase tracking-wide sm:tracking-widest transition-all ${
                period === p
                  ? "bg-gold/10 border-gold/50 text-gold"
                  : "bg-white/5 border-white/10 text-white/60 hover:border-white/30"
              }`}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
          </div>
          {forecast && !loading && (
            <div className="flex gap-2 sm:ml-auto">
              <button
                onClick={handleDownloadPDF}
                disabled={downloading}
                className="px-4 py-2 min-h-11 rounded-xl border border-white/10 text-white/60 hover:text-gold hover:border-gold/30 text-xs uppercase tracking-widest transition-all flex items-center gap-2 disabled:opacity-50"
              >
                <Download size={14} />
                {downloading
                  ? "Generating..."
                  : pdfPrice !== null
                    ? `PDF Report · ${pdfPrice} credits`
                    : "PDF Reports"}
              </button>
              <button
                onClick={() => {
                  const text = `My ${period} forecast: ${forecast?.horoscope?.overall_theme || "Check your stars!"}\n\nGet yours free: ${window.location.origin}/free-kundali`;
                  if (navigator.share) {
                    navigator.share({
                      title: "AstroYou Forecast",
                      text,
                      url: `${window.location.origin}/free-kundali`,
                    });
                  } else {
                    window.open(
                      `https://wa.me/?text=${encodeURIComponent(text)}`,
                      "_blank",
                    );
                  }
                }}
                className="px-4 py-2 min-h-11 rounded-xl border border-white/10 text-white/60 hover:text-gold hover:border-gold/30 text-xs uppercase tracking-widest transition-all flex items-center gap-2"
              >
                <Share2 size={14} />
                Share
              </button>
            </div>
          )}
        </div>

        <header className="mb-4">
          <h1 className="type-page-title mb-3">
            {period === "yearly"
              ? `Your ${new Date().getFullYear()} Forecast`
              : period === "monthly"
                ? `Your Monthly Forecast — ${new Date().toLocaleDateString("en-US", { month: "long" })}`
                : period === "weekly"
                  ? "Your Weekly Forecast"
                  : "Your Daily Forecast"}
          </h1>
          <div className="flex flex-wrap items-center gap-3 text-white/60 font-sans italic text-sm">
            <div className="flex items-center gap-2">
              <Calendar size={14} />
              {today}
            </div>
            {h?.overall_rating && (
              <div className="flex items-center gap-2 non-italic font-sans text-xs font-bold bg-white/5 border border-white/10 px-3 py-1 rounded-full text-gold">
                Overall Alignment: {h.overall_rating}/5
              </div>
            )}
          </div>
        </header>

        {(pdfError || pdfSuccess) && (
          <div
            role="status"
            className={`mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 text-sm ${
              pdfError
                ? "border-amber-400/20 bg-amber-400/5 text-amber-200"
                : "border-emerald-400/20 bg-emerald-400/5 text-emerald-200"
            }`}
          >
            <span>{pdfError || pdfSuccess}</span>
            <button
              onClick={() => navigate("/reports")}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-white/70 hover:border-gold/30 hover:text-gold"
            >
              Open Reports
            </button>
          </div>
        )}

        {error ? (
          <div className="glass p-6 rounded-2xl border border-white/10 text-center">
            {errorKind === "auth" ? (
              <>
                <p className="text-white/80 mb-2 text-lg font-light">
                  Sign in to see your personal forecast
                </p>
                <p className="text-white/60 text-sm mb-5">
                  Your forecast is read from your own chart, so it needs your
                  AstroYou account.
                </p>
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-3 text-sm font-bold uppercase tracking-widest text-black transition hover:bg-gold/90"
                >
                  <LogIn size={14} />
                  Sign in
                </button>
              </>
            ) : errorKind === "credits" ? (
              <>
                <p className="text-amber-200 mb-4">{error}</p>
                <button
                  onClick={() => navigate("/wallet")}
                  className="px-6 py-2 bg-white/5 hover:bg-white/10 rounded-full text-xs font-bold transition-all border border-white/10"
                >
                  Top up credits
                </button>
              </>
            ) : (
              <>
                <p className="text-white/75 mb-2">{error}</p>
                <p className="text-white/60 text-sm mb-5">
                  Nothing is wrong with your chart — our forecast service is
                  just busy.
                </p>
                <button
                  onClick={() => setRetryNonce((n) => n + 1)}
                  className="inline-flex items-center gap-2 px-6 py-2 bg-white/5 hover:bg-white/10 rounded-full text-xs font-bold transition-all border border-white/10"
                >
                  <RefreshCw size={12} />
                  Try again
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            {/* The Daily Pulse (Theme) */}
            <div className="glass p-4 rounded-2xl border border-white/5 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-5 opacity-5 group-hover:opacity-10 transition-opacity">
                <Sun size={120} className="text-gold" />
              </div>

              <div className="relative z-10">
                <div className="flex items-center gap-3 text-gold mb-5 font-sans">
                  <span className="w-8 h-[1px] bg-gold/30"></span>
                  <span className="text-xs font-black uppercase tracking-widest">
                    {period === "yearly"
                      ? "This Year's Theme"
                      : period === "monthly"
                        ? "This Month's Theme"
                        : period === "weekly"
                          ? "This Week's Theme"
                          : "Today's Theme"}
                  </span>
                </div>

                {forecast?.narrative || h?.overall_theme ? (
                  <p className="text-xl leading-relaxed text-white/90 font-light italic mb-2 first-letter:text-6xl first-letter:font-bold first-letter:text-gold first-letter:mr-3 first-letter:float-left">
                    {forecast?.narrative || h?.overall_theme}
                  </p>
                ) : (
                  <p className="text-base text-white/60 mb-2">
                    No theme was returned for this period. The details below
                    are still read from your chart.
                  </p>
                )}
              </div>
            </div>

            {/* Period-specific content */}
            {period === "weekly" && h?.key_days && (
              <div className="glass rounded-2xl p-6 mb-6">
                <h3 className="text-sm uppercase tracking-widest text-white/55 font-bold mb-4">
                  Key Days This Week
                </h3>
                <div className="space-y-3">
                  {(h.key_days || h.day_by_day || []).map(
                    (day: any, i: number) => (
                      <div
                        key={i}
                        className="flex items-start gap-3 py-2 border-b border-white/5 last:border-0"
                      >
                        <span className="text-gold text-sm font-medium min-w-[80px]">
                          {day.date || day.day || `Day ${i + 1}`}
                        </span>
                        <p className="text-white/70 text-sm">
                          {day.description || day.theme || day.prediction || ""}
                        </p>
                      </div>
                    ),
                  )}
                </div>
              </div>
            )}

            {period === "monthly" && (h?.key_dates || h?.keyDates) && (
              <div className="glass rounded-2xl p-6 mb-6">
                <h3 className="text-sm uppercase tracking-widest text-white/55 font-bold mb-4">
                  Key Dates This Month
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {(h.key_dates || h.keyDates || []).map(
                    (kd: any, i: number) => (
                      <div
                        key={i}
                        className="p-3 rounded-xl bg-white/5 border border-white/10"
                      >
                        <span className="text-gold text-xs font-bold">
                          {kd.date || kd.day}
                        </span>
                        <p className="text-white/60 text-xs mt-1">
                          {kd.description || kd.event || kd.prediction}
                        </p>
                        {kd.type && (
                          <span
                            className={`text-xs mt-1 inline-block px-2 py-0.5 rounded-full ${kd.type === "peak" || kd.type === "auspicious" ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-300"}`}
                          >
                            {kd.type}
                          </span>
                        )}
                      </div>
                    ),
                  )}
                </div>
              </div>
            )}

            {period === "yearly" && (h?.quarters || h?.major_transits) && (
              <div className="glass rounded-2xl p-6 mb-6">
                <h3 className="text-sm uppercase tracking-widest text-white/55 font-bold mb-4">
                  Yearly Overview
                </h3>
                {h.quarters && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    {(h.quarters || []).map((q: any, i: number) => (
                      <div
                        key={i}
                        className="p-4 rounded-xl bg-white/5 border border-white/10"
                      >
                        <span className="text-gold text-sm font-bold">
                          Q{i + 1}
                        </span>
                        <p className="text-white/60 text-sm mt-2">
                          {q.theme || q.description || q.prediction}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
                {(h.major_transits || h.retrograde_periods) && (
                  <div>
                    <h4 className="text-xs uppercase tracking-widest text-white/55 mb-3">
                      Major Transits
                    </h4>
                    <div className="space-y-2">
                      {(h.major_transits || h.retrograde_periods || [])
                        .slice(0, 6)
                        .map((t: any, i: number) => (
                          <div
                            key={i}
                            className="flex items-center gap-2 text-sm"
                          >
                            <span className="text-amber-400 min-w-[100px]">
                              {t.date || t.period}
                            </span>
                            <span className="text-white/60">
                              {t.description ||
                                t.event ||
                                `${t.planet} ${t.type || ""}`}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Planetary Influences (Transit Activations) */}
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <div className="flex items-center gap-4 mb-5">
                  <h2 className="text-xl font-light tracking-wide">
                    Transit Activations
                  </h2>
                  <div className="h-[1px] flex-grow bg-white/5"></div>
                </div>
                <div className="space-y-4">
                  {h?.planetary_influences?.map((inf, idx) => (
                    <div
                      key={idx}
                      className="glass p-6 rounded-3xl border border-white/5 flex gap-6 items-center group"
                    >
                      <div className="shrink-0 w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-gold group-hover:scale-110 transition-transform">
                        <Zap size={20} />
                      </div>
                      <div className="flex-grow">
                        <div className="flex justify-between items-center mb-1">
                          <h4 className="text-sm font-bold font-sans text-white/90 uppercase tracking-widest">
                            {inf.planet} Natal {inf.natal_planet}
                          </h4>
                          <span className="text-xs font-bold text-gold/80 bg-gold/5 px-2 py-0.5 rounded-full border border-gold/10">
                            Strength: {inf.strength}
                          </span>
                        </div>
                        <p className="text-xs text-white/60 font-sans font-light leading-relaxed italic">
                          {inf.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sidebar: Dasha & Lucky Elements */}
              <div className="space-y-6">
                {/* Dasha Block */}
                <div className="glass p-6 rounded-[2rem] border border-violet-500/20 bg-violet-500/5">
                  <div className="flex items-center gap-3 text-violet-400 mb-6 font-sans">
                    <Clock size={16} />
                    <span className="text-xs font-black uppercase tracking-widest">
                      Active Life Cycle
                    </span>
                  </div>
                  <div className="mb-4">
                    <div className="text-xs text-white/55 uppercase tracking-[0.2em] mb-1 font-sans">
                      Mahadasha
                    </div>
                    <div className="text-xl font-light text-violet-200">
                      {forecast?.dasha?.mahadasha}
                    </div>
                  </div>
                  <div className="mb-6">
                    <div className="text-xs text-white/55 uppercase tracking-[0.2em] mb-1 font-sans">
                      Antardasha
                    </div>
                    <div className="text-xl font-light text-violet-300">
                      {forecast?.dasha?.bhukti}
                    </div>
                  </div>
                  <div className="pt-4 border-t border-violet-500/10 flex items-center justify-between text-xs font-sans">
                    <span className="text-white/55">Phase Ends</span>
                    <span className="text-violet-400/80 font-bold">
                      {forecast?.dasha?.ends
                        ? new Date(forecast.dasha.ends).toLocaleDateString()
                        : "N/A"}
                    </span>
                  </div>
                </div>

                {/* Rahu Kaal Warning */}
                {forecast?.panchang?.rahu_kaal &&
                  forecast.panchang.rahu_kaal !== "—" && (
                    <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 mb-4">
                      <span className="text-xs text-red-300/80 uppercase tracking-widest font-bold">
                        Rahu Kaal
                      </span>
                      <p className="text-sm text-red-300 mt-1">
                        {forecast.panchang.rahu_kaal}
                      </p>
                    </div>
                  )}

                {/* Moon Phase & Sign */}
                {h?.moon && (
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10 mb-4">
                    <span className="text-xs text-white/55 uppercase tracking-widest font-bold">
                      Moon
                    </span>
                    <p className="text-sm text-white/70 mt-1">
                      {h.moon.phase && `${h.moon.phase} · `}
                      {h.moon.sign || ""}
                    </p>
                  </div>
                )}

                {/* Lucky Elements */}
                <div className="glass p-6 rounded-[2rem] border border-white/5">
                  <div className="flex items-center gap-3 text-gold mb-6 font-sans">
                    <Star size={16} />
                    <span className="text-xs font-black uppercase tracking-widest">
                      Lucky Elements
                    </span>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-white/55 uppercase tracking-widest font-sans">
                        Colors
                      </span>
                      <div className="flex gap-2">
                        {h?.lucky_elements?.colors?.map((c, i) => (
                          <span key={i} className="text-xs text-white/70">
                            {c}
                            {i < (h?.lucky_elements?.colors?.length ?? 0) - 1
                              ? ","
                              : ""}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-white/55 uppercase tracking-widest font-sans">
                        Numbers
                      </span>
                      <span className="text-xs text-white/70">
                        {h?.lucky_elements?.numbers?.join(", ")}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-white/55 uppercase tracking-widest font-sans">
                        Stones
                      </span>
                      <span className="text-xs text-white/70 italic">
                        {h?.lucky_elements?.stones?.join(", ")}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-white/55 uppercase tracking-widest font-sans">
                        Directions
                      </span>
                      <span className="text-xs text-white/70 uppercase tracking-widest">
                        {h?.lucky_elements?.directions?.join(", ")}
                      </span>
                    </div>
                  </div>

                  <div className="mt-6 pt-5 border-t border-white/5">
                    <div className="text-xs text-white/55 uppercase tracking-widest font-sans mb-3">
                      Auspicious Times
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {h?.lucky_elements?.times?.map((t, i) => (
                        <span
                          key={i}
                          className="bg-white/5 border border-white/10 px-2 py-1 rounded-lg text-xs font-sans text-gold/80"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Tips Section */}
            {h?.tips && h.tips.length > 0 && (
              <section className="glass p-6 rounded-[2rem] border border-emerald-500/10 bg-emerald-500/[0.02]">
                <div className="flex items-center gap-3 text-emerald-400 mb-6 font-sans">
                  <Sparkles size={16} />
                  <span className="text-xs font-black uppercase tracking-widest">
                    Celestial Guidance
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {h.tips.map((tip, i) => (
                    <div key={i} className="flex gap-3 items-start">
                      <div className="w-1 h-1 rounded-full bg-emerald-400 mt-2 shrink-0"></div>
                      <p className="text-sm text-white/70 font-sans font-light leading-relaxed italic">
                        {tip}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Life Areas Grid */}
            <section>
              <div className="flex items-center gap-4 mb-5">
                <h2 className="text-xl font-light tracking-wide">Life Areas</h2>
                <div className="h-[1px] flex-grow bg-white/5"></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {h?.life_areas?.map((area, idx) => (
                  <div
                    key={idx}
                    className="glass p-6 rounded-[2rem] border border-white/5 hover:border-white/10 transition-all group flex flex-col"
                  >
                    <div className="flex justify-between items-start mb-6">
                      <div
                        className={`p-3 rounded-2xl border ${getAreaColor(
                          area.area,
                        )}`}
                      >
                        {getAreaIcon(area.area)}
                      </div>
                      <div className="flex gap-1">
                        {[...Array(5)].map((_, i) => (
                          <div
                            key={i}
                            className={`w-1.5 h-1.5 rounded-full ${
                              i < area.rating ? "bg-gold" : "bg-white/10"
                            }`}
                          ></div>
                        ))}
                      </div>
                    </div>
                    <h3 className="text-lg font-medium text-white/90 mb-2 font-sans tracking-tight">
                      {area.title}
                    </h3>
                    <p className="text-xs text-white/50 leading-relaxed font-sans font-light mb-auto">
                      {area.prediction}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-6">
                      {area.keywords.map((kw, kidx) => (
                        <span
                          key={kidx}
                          className="text-xs font-black uppercase tracking-tight text-white/55 bg-white/5 px-2 py-0.5 rounded-md border border-white/5"
                        >
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Wisdom Footer */}
            <section className="glass rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-gold/80">
                    Prediction feedback
                  </p>
                  <h2 className="mt-1 text-lg font-light tracking-wide">
                    Did this feel accurate?
                  </h2>
                  <p className="mt-1 text-xs text-white/60">
                    Your response is stored as feedback, not shown publicly.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: "accurate", label: "Accurate" },
                    { value: "partly", label: "Partly" },
                    { value: "missed", label: "Missed" },
                  ].map((item) => (
                    <button
                      key={item.value}
                      onClick={() =>
                        submitPredictionFeedback(
                          item.value as "accurate" | "partly" | "missed",
                        )
                      }
                      disabled={feedbackSubmitting}
                      className={`rounded-xl border px-3 py-2 text-xs font-bold uppercase tracking-widest transition-all ${
                        feedbackSignal === item.value
                          ? "border-gold/50 bg-gold/10 text-gold"
                          : "border-white/10 bg-white/5 text-white/60 hover:border-gold/30 hover:text-gold"
                      } disabled:opacity-50`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                value={feedbackNotes}
                onChange={(event) => setFeedbackNotes(event.target.value)}
                placeholder="Optional note for the team"
                className="mt-4 min-h-20 w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/25 focus:border-gold/40"
              />
              {feedbackStatus && (
                <p role="status" className="mt-2 text-xs text-white/60">{feedbackStatus}</p>
              )}
            </section>

            <AskJyotishBridge
              eyebrow="Take this further"
              question={`My ${period} forecast points to ${
                h?.overall_theme || "a shifting period"
              }. What should I actually do about it this ${
                period === "daily" ? "week" : period.replace("ly", "")
              }?`}
            />

            <div className="text-center py-8 border-t border-white/5">
              <p className="text-white/20 text-[10px] uppercase tracking-[0.3em] font-light font-sans max-w-md mx-auto leading-relaxed">
                As above, so below. Infinite wisdom is yours.
              </p>
            </div>
          </div>
        )}
      </div>
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={() => {
          setShowAuthModal(false);
          setRetryNonce((n) => n + 1);
        }}
        title="Sign in for your forecast"
        message="Your personal forecast and PDF reports are tied to your AstroYou account and birth chart."
      />
    </PageShell>
  );
};

export default DailyForecast;

