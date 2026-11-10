import React, { useState, useEffect, useRef } from "react";
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
  LogIn,
} from "lucide-react";
import { useSubscription, useUserProfile } from "../hooks";
import { useDialog } from "../hooks/useDialog";
import { useRequestBirthData } from "../hooks/useRequestBirthData";
import { useAuth } from "../lib/useAuth";
import AuthModal from "../components/AuthModal";
import { REPORT_PRICING, type ReportType } from "../lib/report-pricing";
import {
  createReportRequestId,
  postPdfReport,
  REPORT_IN_PROGRESS_MESSAGE,
} from "../lib/report-products";
import { CardSkeleton, FullPageSkeleton } from "../components/ui/Skeleton";
import { StatusNotice } from "../components/ui/StatusNotice";
import { GlossaryTerm } from "../components/ui/GlossaryTerm";
import type { ForecastData } from "../types";
import { postJson } from "../lib/apiFetch";
import { viewerDateKey } from "../lib/viewer-timezone";
import {
  FEATURE_CREDIT_COST,
  FORECAST_PERIOD_FEATURE,
  chargeConfirmationKey,
  chargeWindowKey,
  creditLabel,
  hasConfirmedCharge,
  rememberChargeConfirmation,
} from "../lib/feature-pricing";

/**
 * In-app confirmation before a paid PDF is generated. States the exact credit
 * cost and the current balance; the charge itself still happens in the page's
 * own handler once the user confirms.
 */
function PdfChargeConfirmDialog({
  reportTitle,
  price,
  balance,
  onConfirm,
  onCancel,
}: {
  reportTitle: string;
  price: number;
  balance: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialog(dialogRef, onCancel, true);
  return (
    <div
      className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm px-4 pb-4 sm:pb-0"
      onClick={onCancel}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pdf-confirm-title"
        aria-describedby="pdf-confirm-desc"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-[2rem] border border-white/10 bg-[#0b0b14] p-6 shadow-2xl"
      >
        <h2
          id="pdf-confirm-title"
          className="text-lg font-semibold text-white mb-2"
        >
          Download {reportTitle}?
        </h2>
        <p id="pdf-confirm-desc" className="text-sm text-white/70 mb-1">
          This PDF costs {creditLabel(price)}. It will also be saved to your
          Reports library.
        </p>
        <p className="text-sm text-white/60 mb-6">
          You have {creditLabel(balance)}; {creditLabel(balance - price)} will
          remain.
        </p>
        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-11 px-5 rounded-xl border border-white/15 text-white/70 hover:text-white hover:border-white/30 text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="min-h-11 px-5 rounded-xl bg-gold text-black font-semibold text-sm hover:bg-gold/90 transition-colors"
          >
            Download for {creditLabel(price)}
          </button>
        </div>
      </div>
    </div>
  );
}

const PERIOD_WINDOW_NAME = {
  weekly: "this week",
  monthly: "this month",
  yearly: "this year",
} as const;

/** Plain word for a 1–5 rating, so "4/5" says what it means. */
const ratingWord = (rating: number) => {
  if (rating >= 5) return "excellent";
  if (rating >= 4) return "good";
  if (rating >= 3) return "mixed";
  if (rating >= 2) return "go gently";
  return "keep it light";
};

const PERIOD_NOUN = {
  daily: "day",
  weekly: "week",
  monthly: "month",
  yearly: "year",
} as const;

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
  // Report type awaiting the user's in-app charge confirmation.
  const [pdfConfirmType, setPdfConfirmType] = useState<ReportType | null>(null);
  // One requestId per PDF purchase, kept until the server answers so a retry
  // after a network drop can never charge twice (same as Reports.tsx).
  const pendingPdfRequestIds = useRef<Partial<Record<ReportType, string>>>({});
  const [feedbackSignal, setFeedbackSignal] = useState<
    "accurate" | "partly" | "missed" | null
  >(null);
  const [feedbackNotes, setFeedbackNotes] = useState("");
  const [feedbackStatus, setFeedbackStatus] = useState("");
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  // Bumped when the user confirms a charge, so the session flag is re-read.
  const [, setConfirmNonce] = useState(0);

  // Weekly/monthly/yearly spend credits once per chart per period window.
  // Show the price, and ask once per window per session before the first
  // request that would spend it.
  const periodFeature = FORECAST_PERIOD_FEATURE[period];
  const periodCost = periodFeature ? FEATURE_CREDIT_COST[periodFeature] : 0;
  const chargeKey =
    user && periodFeature && birthData
      ? chargeConfirmationKey(
          user.uid,
          periodFeature,
          chargeWindowKey(periodFeature, viewerDateKey()),
          birthData,
        )
      : null;
  // Read every render (a cheap sessionStorage lookup); confirming bumps
  // confirmNonce, which re-renders and so re-reads it.
  const needsChargeConfirm = chargeKey ? !hasConfirmedCharge(chargeKey) : false;
  const confirmCharge = () => {
    if (!chargeKey) return;
    rememberChargeConfirmation(chargeKey);
    setConfirmNonce((n) => n + 1);
  };

  useEffect(() => {
    if (profileLoading) return;

    if (!birthData || needsChargeConfirm) {
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
  }, [birthData, profileLoading, period, retryNonce, user, needsChargeConfirm]);

  // The forecast PDF goes through the priced reports flow (/api/pdf-report),
  // which charges credits and saves the report to the user's library.
  // Monthly has no PDF product, so it hands off to the reports page.
  const pdfReportType: ReportType | null =
    period === "monthly" ? null : (period as ReportType);
  const pdfPrice = pdfReportType
    ? REPORT_PRICING[pdfReportType].creditCost
    : null;

  const handleDownloadPDF = () => {
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
    // Ask in-app first; the charge runs from the dialog's confirm button.
    setPdfConfirmType(pdfReportType);
  };

  const generatePdf = async (reportType: ReportType) => {
    if (!birthData || !user || downloading) return;
    const reportPrice = REPORT_PRICING[reportType].creditCost;
    setDownloading(true);
    try {
      const idToken = await user.getIdToken();
      const requestId =
        pendingPdfRequestIds.current[reportType] ?? createReportRequestId();
      pendingPdfRequestIds.current[reportType] = requestId;
      const response = await postPdfReport({
        idToken,
        requestId,
        birthData: {
          name: birthData.name || profile?.name || "Seeker",
          dob: birthData.dob,
          tob: birthData.tob,
          pob: birthData.pob || profile?.pob || "",
          lat: birthData.coordinates?.lat ?? profile?.coordinates?.lat,
          lng: birthData.coordinates?.lng ?? profile?.coordinates?.lng,
        },
        reportType,
        date: viewerDateKey(),
        localDate: viewerDateKey(),
      });
      // The server answered: this purchase attempt is settled either way.
      delete pendingPdfRequestIds.current[reportType];
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        if (response.status === 409 && payload?.code === "report_in_progress") {
          throw new Error(payload.error || REPORT_IN_PROGRESS_MESSAGE);
        }
        if (response.status === 402) {
          throw new Error(
            payload?.error ||
              `You need ${reportPrice} credits for this PDF. Top up on the Reports page.`,
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
        `astroyou-${reportType}-report.pdf`;
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
      // Sign in on this page (its own AuthModal), not a detour to onboarding.
      setShowAuthModal(true);
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

  // Full-page skeleton only for the first load. Switching period keeps the
  // tabs and title in place and skeletons just the reading below.
  if (profileLoading || (loading && !forecast && !error)) {
    return <FullPageSkeleton />;
  }

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
                type="button"
                onClick={() => navigate("/onboarding")}
                className="rounded-xl bg-gold px-5 py-3 text-sm font-bold uppercase tracking-widest text-black transition hover:bg-gold/90"
              >
                Create Profile
              </button>
              <button
                type="button"
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
  const influences = h?.planetary_influences ?? [];
  const lucky = h?.lucky_elements;
  const luckyRows = (
    [
      ["Colors", lucky?.colors],
      ["Numbers", lucky?.numbers],
      ["Stones", lucky?.stones],
      ["Directions", lucky?.directions],
    ] as const
  )
    .map(([label, list]) => [label, (list ?? []).join(", ")] as const)
    .filter(([, value]) => value.trim() !== "");
  const luckyTimes = lucky?.times ?? [];

  return (
    <PageShell>
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col gap-2 mb-4 sm:flex-row sm:items-center">
          <div
            role="tablist"
            aria-label="Forecast period"
            className="grid grid-cols-4 gap-1.5 sm:flex sm:gap-2"
          >
            {(["daily", "weekly", "monthly", "yearly"] as const).map((p) => {
              const feature = FORECAST_PERIOD_FEATURE[p];
              const cost = feature ? FEATURE_CREDIT_COST[feature] : 0;
              const name = p.charAt(0).toUpperCase() + p.slice(1);
              return (
                <button
                  key={p}
                  type="button"
                  role="tab"
                  aria-selected={period === p}
                  aria-controls="forecast-panel"
                  aria-label={
                    cost ? `${name}, ${creditLabel(cost)}` : `${name}, free`
                  }
                  onClick={() => setPeriod(p)}
                  className={`min-h-11 min-w-0 px-1.5 sm:px-4 py-1.5 rounded-xl border text-xs sm:text-sm font-bold uppercase tracking-wide sm:tracking-widest transition-all ${
                    period === p
                      ? "bg-gold/10 border-gold/50 text-gold"
                      : "bg-white/5 border-white/10 text-white/60 hover:border-white/30"
                  }`}
                >
                  <span className="block">{name}</span>
                  <span
                    className="block text-[0.68rem] font-semibold normal-case tracking-normal opacity-70"
                    aria-hidden="true"
                  >
                    {cost ? creditLabel(cost) : "Free"}
                  </span>
                </button>
              );
            })}
          </div>
          {forecast && !loading && (
            <div className="flex gap-2 sm:ml-auto">
              <button
                type="button"
                onClick={handleDownloadPDF}
                disabled={downloading}
                className="px-4 py-2 min-h-11 rounded-xl border border-white/10 text-white/60 hover:text-gold hover:border-gold/30 text-xs uppercase tracking-widest transition-all flex items-center gap-2 disabled:opacity-50"
              >
                <Download size={14} aria-hidden="true" />
                {downloading
                  ? "Generating..."
                  : pdfPrice !== null
                    ? `PDF Report · ${pdfPrice} credits`
                    : "PDF Reports"}
              </button>
              <button
                type="button"
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
                <Share2 size={14} aria-hidden="true" />
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
          <div className="flex flex-wrap items-center gap-3 text-white/60 text-sm">
            <div className="flex items-center gap-2">
              <Calendar size={14} aria-hidden="true" />
              {today}
            </div>
            {!loading && h?.overall_rating && (
              <div className="flex items-center gap-2 text-xs font-bold bg-white/5 border border-white/10 px-3 py-1 rounded-full text-gold">
                Your {PERIOD_NOUN[period]} overall: {h.overall_rating}/5 ·{" "}
                {ratingWord(h.overall_rating)}
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
              type="button"
              onClick={() => navigate("/reports")}
              className="min-h-11 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-white/70 hover:border-gold/30 hover:text-gold"
            >
              Open Reports
            </button>
          </div>
        )}

        <div
          id="forecast-panel"
          role="tabpanel"
          aria-label={`${period.charAt(0).toUpperCase() + period.slice(1)} forecast`}
        >
          {needsChargeConfirm && period !== "daily" ? (
            <div
              role="region"
              aria-label={`Unlock your ${period} forecast`}
              className="rounded-2xl border border-gold/20 bg-gold/5 p-5 md:p-6"
            >
              <p className="text-xs font-bold uppercase tracking-widest text-gold/80">
                {period.charAt(0).toUpperCase() + period.slice(1)} ·{" "}
                {creditLabel(periodCost)}
              </p>
              <p className="mt-2 text-base leading-relaxed text-white/80">
                Your {period} forecast is read from your chart and costs{" "}
                {creditLabel(periodCost)} for {PERIOD_WINDOW_NAME[period]}.
                Opening it again {PERIOD_WINDOW_NAME[period]} is free.
              </p>
              <p className="mt-1 text-sm text-white/55">
                You have {creditLabel(credits)}.
              </p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                {credits >= periodCost ? (
                  <button
                    type="button"
                    onClick={confirmCharge}
                    className="min-h-11 rounded-xl bg-gold px-5 py-2.5 text-sm font-bold text-black transition hover:bg-gold/90"
                  >
                    Open for {creditLabel(periodCost)}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => navigate("/wallet")}
                    className="min-h-11 rounded-xl bg-gold px-5 py-2.5 text-sm font-bold text-black transition hover:bg-gold/90"
                  >
                    Top up credits
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setPeriod("daily")}
                  className="min-h-11 rounded-xl border border-white/15 px-5 py-2.5 text-sm font-semibold text-white/75 transition hover:border-white/30 hover:text-white"
                >
                  Back to daily (free)
                </button>
              </div>
            </div>
          ) : loading ? (
            <div aria-busy="true" aria-live="polite" className="space-y-4">
              <span className="sr-only">Loading your {period} forecast</span>
              <CardSkeleton />
              <CardSkeleton />
            </div>
          ) : error ? (
            errorKind === "auth" ? (
              <StatusNotice
                tone="info"
                size="section"
                title="Sign in to see your personal forecast"
                message="Your forecast is read from your own chart, so it needs your AstroYou account."
                action={{
                  label: "Sign in",
                  icon: LogIn,
                  onClick: () => setShowAuthModal(true),
                }}
              />
            ) : errorKind === "credits" ? (
              <StatusNotice
                tone="info"
                size="section"
                message={error}
                action={{ label: "Top up credits", to: "/wallet" }}
              />
            ) : (
              <StatusNotice
                size="section"
                message={
                  <>
                    <p>{error}</p>
                    <p className="mt-1 text-white/60">
                      Nothing is wrong with your chart — our forecast service is
                      just busy.
                    </p>
                  </>
                }
                onRetry={() => setRetryNonce((n) => n + 1)}
              />
            )
          ) : (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-1000">
              {/* The Daily Pulse (Theme) */}
              <div className="glass p-5 md:p-6 rounded-2xl border border-white/5 relative overflow-hidden group">
                <div
                  className="absolute top-0 right-0 p-5 opacity-5 group-hover:opacity-10 transition-opacity"
                  aria-hidden="true"
                >
                  <Sun size={120} className="text-gold" />
                </div>

                <div className="relative z-10">
                  <div className="flex items-center gap-3 text-gold mb-3">
                    <span
                      className="w-8 h-[1px] bg-gold/30"
                      aria-hidden="true"
                    ></span>
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
                    <p className="max-w-[65ch] text-base md:text-[1.0625rem] leading-relaxed text-white/85">
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
                <div className="glass rounded-2xl p-5 md:p-6">
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
                            {day.description ||
                              day.theme ||
                              day.prediction ||
                              ""}
                          </p>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              )}

              {period === "monthly" && (h?.key_dates || h?.keyDates) && (
                <div className="glass rounded-2xl p-5 md:p-6">
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
                          <span className="text-gold text-sm font-bold">
                            {kd.date || kd.day}
                          </span>
                          <p className="text-white/70 text-sm leading-relaxed mt-1">
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
                <div className="glass rounded-2xl p-5 md:p-6">
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
                      <h4 className="text-xs uppercase tracking-widest text-white/55 mb-1">
                        Big planet moves this year
                      </h4>
                      <p className="text-xs text-white/55 mb-3">
                        When a slow planet changes sign or turns backward, the
                        themes it rules in your chart shift for months.
                      </p>
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

              {/* Planetary Influences (Transit Activations). Without any, the
                sidebar takes the full width instead of leaving 2/3 empty. */}
              <section
                className={`grid grid-cols-1 gap-6 ${
                  influences.length > 0 ? "lg:grid-cols-3" : ""
                }`}
              >
                {influences.length > 0 && (
                  <div className="lg:col-span-2">
                    <div className="flex items-center gap-4 mb-1">
                      <h2 className="text-xl font-light tracking-wide">
                        Planets shaping your {PERIOD_NOUN[period]}
                      </h2>
                      <div
                        className="h-[1px] flex-grow bg-white/5"
                        aria-hidden="true"
                      ></div>
                    </div>
                    <p className="mb-5 text-sm text-white/55">
                      Where the moving planets meet your birth chart. Higher
                      influence means you'll notice it more.
                    </p>
                    <div className="space-y-4">
                      {influences.map((inf, idx) => (
                        <div
                          key={idx}
                          className="glass p-5 md:p-6 rounded-3xl border border-white/5 flex gap-4 md:gap-6 items-start"
                        >
                          <div
                            className="shrink-0 w-11 h-11 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-gold"
                            aria-hidden="true"
                          >
                            <Zap size={20} />
                          </div>
                          <div className="min-w-0 flex-grow">
                            <div className="flex flex-wrap justify-between items-center gap-x-3 gap-y-1 mb-1.5">
                              <h3 className="text-[0.95rem] font-semibold text-white/90">
                                {inf.natal_planet
                                  ? `${inf.planet} now → your birth ${inf.natal_planet}`
                                  : `${inf.planet}${inf.aspect_type ? ` · ${inf.aspect_type}` : ""}`}
                              </h3>
                              <span className="text-xs font-bold text-gold/80 bg-gold/5 px-2 py-0.5 rounded-full border border-gold/10">
                                Influence:{" "}
                                {inf.strength <= 5
                                  ? `${inf.strength}/5`
                                  : inf.strength}
                              </span>
                            </div>
                            <p className="max-w-[65ch] text-[0.95rem] text-white/70 leading-relaxed">
                              {inf.description}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sidebar: Dasha & Lucky Elements */}
                <div
                  className={
                    influences.length > 0
                      ? "space-y-6"
                      : "grid grid-cols-1 gap-6 md:grid-cols-2"
                  }
                >
                  {/* Dasha Block */}
                  {(forecast?.dasha?.mahadasha || forecast?.dasha?.bhukti) && (
                    <div className="glass p-6 rounded-[2rem] border border-violet-500/20 bg-violet-500/5">
                      <div className="flex items-center gap-3 text-violet-400 mb-2">
                        <Clock size={16} aria-hidden="true" />
                        <span className="text-xs font-black uppercase tracking-widest">
                          Your life chapter (
                          <GlossaryTerm k="dasha">dasha</GlossaryTerm>)
                        </span>
                      </div>
                      <p className="mb-5 text-xs leading-relaxed text-white/60">
                        The planet ruling this stretch of your life colours
                        every forecast above.
                      </p>
                      {forecast?.dasha?.mahadasha && (
                        <div className="mb-4">
                          <div className="text-xs text-white/55 uppercase tracking-[0.2em] mb-1">
                            <GlossaryTerm k="mahadasha">
                              Main period
                            </GlossaryTerm>
                          </div>
                          <div className="text-xl font-light text-violet-200">
                            {forecast.dasha.mahadasha}
                          </div>
                        </div>
                      )}
                      {forecast?.dasha?.bhukti && (
                        <div className="mb-5">
                          <div className="text-xs text-white/55 uppercase tracking-[0.2em] mb-1">
                            <GlossaryTerm k="antardasha">
                              Sub-period
                            </GlossaryTerm>
                          </div>
                          <div className="text-xl font-light text-violet-300">
                            {forecast.dasha.bhukti}
                          </div>
                        </div>
                      )}
                      {forecast?.dasha?.ends && (
                        <div className="pt-4 border-t border-violet-500/10 flex items-center justify-between text-xs">
                          <span className="text-white/55">Sub-period ends</span>
                          <span className="text-violet-300/90 font-bold">
                            {new Date(forecast.dasha.ends).toLocaleDateString(
                              "en-IN",
                              {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              },
                            )}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Rahu Kaal Warning */}
                  {forecast?.panchang?.rahu_kaal &&
                    forecast.panchang.rahu_kaal !== "—" && (
                      <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                        <span className="text-xs text-red-300/80 uppercase tracking-widest font-bold">
                          <GlossaryTerm k="rahu-kaal">Rahu Kaal</GlossaryTerm>{" "}
                          today
                        </span>
                        <p className="text-sm text-red-300 mt-1">
                          {forecast.panchang.rahu_kaal}
                        </p>
                        <p className="mt-1 text-xs text-white/60">
                          Hold off on starting new things in this window;
                          routine work is fine.
                        </p>
                      </div>
                    )}

                  {/* Moon Phase & Sign */}
                  {h?.moon && (h.moon.phase || h.moon.sign) && (
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                      <span className="text-xs text-white/55 uppercase tracking-widest font-bold">
                        Moon today
                      </span>
                      <p className="text-sm text-white/70 mt-1">
                        {[h.moon.phase, h.moon.sign]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      <p className="mt-1 text-xs text-white/55">
                        The Moon sets the day's mood and how you react.
                      </p>
                    </div>
                  )}

                  {/* Lucky Elements: only the rows the forecast filled in. */}
                  {(luckyRows.length > 0 || luckyTimes.length > 0) && (
                    <div className="glass p-6 rounded-[2rem] border border-white/5">
                      <div className="flex items-center gap-3 text-gold mb-5">
                        <Star size={16} aria-hidden="true" />
                        <span className="text-xs font-black uppercase tracking-widest">
                          Your lucky picks
                        </span>
                      </div>
                      <p className="-mt-3 mb-4 text-xs text-white/55">
                        Small ways to lean into the {PERIOD_NOUN[period]}: wear,
                        carry or face these.
                      </p>
                      {luckyRows.length > 0 && (
                        <dl className="space-y-3">
                          {luckyRows.map(([label, value]) => (
                            <div
                              key={label}
                              className="flex items-baseline justify-between gap-4"
                            >
                              <dt className="text-xs text-white/55 uppercase tracking-widest">
                                {label}
                              </dt>
                              <dd className="text-sm text-white/75 text-right">
                                {value}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      )}

                      {luckyTimes.length > 0 && (
                        <div
                          className={
                            luckyRows.length > 0
                              ? "mt-5 pt-5 border-t border-white/5"
                              : ""
                          }
                        >
                          <div className="text-xs text-white/55 uppercase tracking-widest mb-3">
                            Best times to begin things
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {luckyTimes.map((t, i) => (
                              <span
                                key={i}
                                className="bg-white/5 border border-white/10 px-2 py-1 rounded-lg text-xs text-gold/85"
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </section>

              {/* Tips Section */}
              {h?.tips && h.tips.length > 0 && (
                <section className="glass p-6 rounded-[2rem] border border-emerald-500/10 bg-emerald-500/[0.02]">
                  <div className="flex items-center gap-3 text-emerald-400 mb-5">
                    <Sparkles size={16} aria-hidden="true" />
                    <h2 className="text-xs font-black uppercase tracking-widest">
                      What to do with it
                    </h2>
                  </div>
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {h.tips.map((tip, i) => (
                      <li key={i} className="flex gap-3 items-start">
                        <span
                          className="w-1 h-1 rounded-full bg-emerald-400 mt-2.5 shrink-0"
                          aria-hidden="true"
                        ></span>
                        <p className="text-[0.95rem] text-white/75 leading-relaxed">
                          {tip}
                        </p>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Life Areas Grid */}
              {h?.life_areas && h.life_areas.length > 0 && (
                <section>
                  <div className="flex items-center gap-4 mb-5">
                    <h2 className="text-xl font-light tracking-wide">
                      Love, work, money &amp; health
                    </h2>
                    <div
                      className="h-[1px] flex-grow bg-white/5"
                      aria-hidden="true"
                    ></div>
                  </div>
                  <p className="-mt-3 mb-5 text-sm text-white/55">
                    Each area is rated out of 5 for this {PERIOD_NOUN[period]}.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {h.life_areas.map((area, idx) => (
                      <div
                        key={idx}
                        className="glass p-5 md:p-6 rounded-[2rem] border border-white/5 flex flex-col"
                      >
                        <div className="flex justify-between items-start mb-4">
                          <div
                            className={`p-3 rounded-2xl border ${getAreaColor(
                              area.area,
                            )}`}
                            aria-hidden="true"
                          >
                            {getAreaIcon(area.area)}
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className="text-xs font-bold text-white/60"
                              aria-hidden="true"
                            >
                              {area.rating}/5
                            </span>
                            <div
                              className="flex gap-1"
                              role="img"
                              aria-label={`Rated ${area.rating} of 5`}
                            >
                              {[...Array(5)].map((_, i) => (
                                <div
                                  key={i}
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    i < area.rating ? "bg-gold" : "bg-white/15"
                                  }`}
                                ></div>
                              ))}
                            </div>
                          </div>
                        </div>
                        <h3 className="text-lg font-medium text-white/90 mb-2 tracking-tight">
                          {area.title}
                        </h3>
                        <p className="text-[0.95rem] text-white/70 leading-relaxed mb-auto">
                          {area.prediction}
                        </p>
                        {area.keywords?.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-5">
                            {area.keywords.map((kw, kidx) => (
                              <span
                                key={kidx}
                                className="text-xs font-bold uppercase tracking-tight text-white/60 bg-white/5 px-2 py-0.5 rounded-md border border-white/5"
                              >
                                {kw}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Prediction feedback. The note sits above the buttons because a
                button press sends it. */}
              <section className="glass rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <p className="text-xs font-black uppercase tracking-widest text-gold/80">
                  Prediction feedback
                </p>
                <h2 className="mt-1 text-lg font-light tracking-wide">
                  Did this feel accurate?
                </h2>
                <p className="mt-1 text-xs text-white/60">
                  Tap one below. It helps us check how often forecasts land, and
                  is never shown publicly.
                </p>
                <label htmlFor="forecast-feedback-note" className="sr-only">
                  Optional note with your feedback
                </label>
                <textarea
                  id="forecast-feedback-note"
                  value={feedbackNotes}
                  onChange={(event) => setFeedbackNotes(event.target.value)}
                  placeholder="Optional: what landed or missed?"
                  className="mt-4 min-h-20 w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-base md:text-sm text-white outline-none placeholder:text-white/50 focus:border-gold/40"
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  {[
                    { value: "accurate", label: "Accurate" },
                    { value: "partly", label: "Partly" },
                    { value: "missed", label: "Missed" },
                  ].map((item) => (
                    <button
                      type="button"
                      key={item.value}
                      aria-pressed={feedbackSignal === item.value}
                      onClick={() =>
                        submitPredictionFeedback(
                          item.value as "accurate" | "partly" | "missed",
                        )
                      }
                      disabled={feedbackSubmitting}
                      className={`min-h-11 rounded-xl border px-4 py-2 text-xs font-bold uppercase tracking-widest transition-all ${
                        feedbackSignal === item.value
                          ? "border-gold/50 bg-gold/10 text-gold"
                          : "border-white/10 bg-white/5 text-white/60 hover:border-gold/30 hover:text-gold"
                      } disabled:opacity-50`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                {feedbackStatus && (
                  <p role="status" className="mt-2 text-xs text-white/60">
                    {feedbackStatus}
                  </p>
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
                <p className="text-white/50 text-[0.6875rem] uppercase tracking-[0.3em] max-w-md mx-auto leading-relaxed">
                  As above, so below.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
      {pdfConfirmType && (
        <PdfChargeConfirmDialog
          reportTitle={REPORT_PRICING[pdfConfirmType].title}
          price={REPORT_PRICING[pdfConfirmType].creditCost}
          balance={credits}
          onCancel={() => setPdfConfirmType(null)}
          onConfirm={() => {
            const type = pdfConfirmType;
            setPdfConfirmType(null);
            void generatePdf(type);
          }}
        />
      )}
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
