import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getPersonaById, getPersonaAccent } from "../lib/personas";
import {
  AlertCircle,
  ArrowLeft,
  Loader2,
  Sparkles,
  Star,
  Wallet,
} from "lucide-react";
import AuthModal from "../components/AuthModal";
import Header from "../components/layout/Header";
import { NightSky } from "../components/layout/NightSky";
import { SpaceTabs } from "../components/layout/SpaceTabs";
import { useAuth } from "../lib/useAuth";
import { useSubscription, useTrustSummary, useUserProfile } from "../hooks";
import { useCreditTopup } from "../hooks/useCreditTopup";
import { DEFAULT_CREDIT_PACK } from "../lib/credit-packs";
import { PersonaPortrait } from "../components/consult/PersonaPortrait";
import {
  hasBirthChart,
  saveConsultIntent,
} from "../components/consult/consult-resume";
import { auth } from "../lib/firebase";
import { getPlatformLanguage } from "../lib/languages";
import { getPersonaTrustDisplay } from "../lib/trust-summary";
import { trackAcquisitionEvent } from "../lib/acquisition";
import { STORAGE_KEYS } from "../lib/constants";

export default function ConsultProfile() {
  const { personaId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile, birthData, loading: profileLoading } = useUserProfile();
  const { credits, loading: creditsLoading } = useSubscription();
  const { summary: trustSummary } = useTrustSummary();
  const { buyCredits, isPaying, error: paymentError } = useCreditTopup();
  const persona = getPersonaById(personaId || "");
  const [selectedLanguage, setSelectedLanguage] = useState(
    persona?.languages[0] || "English",
  );
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);

  useEffect(() => {
    if (!persona || !profile?.language) return;
    const preferred = getPlatformLanguage(profile.language).label;
    if (persona.languages.includes(preferred)) {
      setSelectedLanguage(preferred);
    }
  }, [persona, profile?.language]);

  useEffect(() => {
    if (!persona) return;
    trackAcquisitionEvent("consult_profile_viewed", {
      personaId: persona.id,
      pricePerMin: persona.pricePerMin,
    });
  }, [persona]);

  // An unknown guide sends you back to the Circle — after the render, not during.
  useEffect(() => {
    if (!persona) navigate("/consult", { replace: true });
  }, [persona, navigate]);

  if (!persona) return null;

  const accent = getPersonaAccent(persona.id);
  const isGuest = !user;
  const estimatedMinutes = Math.floor(credits / persona.pricePerMin);
  const hasEnoughCredits = credits >= persona.pricePerMin;
  const trustDisplay = getPersonaTrustDisplay(trustSummary, persona.id);

  /** Enter the sitting, carrying the opening question if there is one. */
  const enterSitting = (draftQuestion?: string | null) => {
    if (draftQuestion) {
      sessionStorage.setItem(STORAGE_KEYS.CONSULT_DRAFT, draftQuestion);
    }
    navigate(
      `/consult/${persona.id}/chat?lang=${encodeURIComponent(selectedLanguage)}`,
    );
  };

  const startSession = (draftQuestion?: string) => {
    if (!user) {
      setPendingQuestion(draftQuestion ?? null);
      setShowAuthModal(true);
      return;
    }
    // Signed in but no chart on file: the same detour, for the same reason.
    if (!profileLoading && !birthData) {
      if (draftQuestion) {
        sessionStorage.setItem(STORAGE_KEYS.CONSULT_DRAFT, draftQuestion);
      }
      saveConsultIntent({ personaId: persona.id, language: selectedLanguage });
      navigate("/onboarding");
      return;
    }
    enterSitting(draftQuestion);
  };

  /**
   * After signing in: this guide reads a chart, and a brand-new account has
   * none. Collect the birth details first, remembering the guide and the
   * question so the Circle can pick the sitting up again afterwards.
   */
  const resumeAfterSignIn = async (draftQuestion?: string | null) => {
    if (draftQuestion) {
      sessionStorage.setItem(STORAGE_KEYS.CONSULT_DRAFT, draftQuestion);
    }
    const uid = auth.currentUser?.uid;
    if (uid && (await hasBirthChart(uid))) {
      enterSitting(draftQuestion);
      return;
    }
    saveConsultIntent({ personaId: persona.id, language: selectedLanguage });
    navigate("/onboarding");
  };

  return (
    <div className="min-h-screen bg-bg-app text-white selection:bg-gold/30">
      <NightSky />
      <Header />

      <main className="container mx-auto pt-28 px-6 pb-16 relative z-10 max-w-5xl">
        <SpaceTabs />

        <button
          onClick={() => navigate("/consult")}
          className="mb-8 flex items-center gap-2 text-[0.65rem] font-bold uppercase tracking-[0.25em] text-white/35 hover:text-gold transition-colors"
        >
          <ArrowLeft size={13} /> The Circle
        </button>

        {/* ── Identity ── */}
        <section className="flex flex-col sm:flex-row sm:items-end gap-6 animate-reveal-progressive">
          <PersonaPortrait persona={persona} size="xl" />
          <div className="min-w-0 flex-1">
            <p
              className="text-[0.6rem] font-bold uppercase tracking-[0.35em] mb-2"
              style={{ color: accent }}
            >
              {persona.title}
            </p>
            <h1 className="font-display italic text-4xl md:text-5xl text-white leading-tight">
              {persona.name}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-white/40">
              <span className="inline-flex items-center gap-1.5 text-emerald-300/90">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Available now
              </span>
              <span className="rounded-full border border-white/20 bg-white/8 px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-[0.15em] text-white/60">
                AI guide · always available
              </span>
              <span className="text-gold font-display text-base">
                {persona.pricePerMin} cr / min
              </span>
              <span>{persona.specialty}</span>
              <span>{persona.languages.join(" · ")}</span>
              {trustDisplay.hasApprovedReviews && (
                <span className="inline-flex items-center gap-1 text-gold/90">
                  <Star size={11} className="fill-current" />
                  {trustDisplay.ratingLabel} · {trustDisplay.reviewLabel}
                </span>
              )}
            </div>
          </div>
        </section>

        <div
          className="mt-8 h-px"
          style={{
            background: `linear-gradient(to right, ${accent}55, transparent)`,
          }}
        />

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_20rem] gap-x-12 gap-y-10 items-start">
          {/* ── The reading ── */}
          <div className="space-y-10">
            <section className="animate-reveal-progressive">
              <p className="font-display italic text-xl md:text-2xl text-white/75 leading-relaxed">
                {persona.profileIntro}
              </p>
              <p className="mt-4 text-sm text-white/40 leading-relaxed">
                {persona.guidanceStyle}
              </p>
            </section>

            <section className="animate-reveal-progressive">
              <p className="text-[0.6rem] font-bold uppercase tracking-[0.35em] text-white/25 mb-4">
                Reads with
              </p>
              <div className="flex flex-wrap gap-2">
                {persona.methods.map((method) => (
                  <span
                    key={method}
                    className="rounded-full border border-white/10 px-3.5 py-1.5 text-xs text-white/55"
                  >
                    {method}
                  </span>
                ))}
              </div>
            </section>

            <section className="animate-reveal-progressive">
              <p className="text-[0.6rem] font-bold uppercase tracking-[0.35em] text-white/25 mb-4">
                Best for
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 border-t border-l border-white/8">
                {persona.bestFor.map((item, i) => (
                  <div
                    key={item}
                    className="px-4 py-3.5 border-b border-r border-white/8"
                  >
                    <span className="font-display italic text-white/20 text-sm mr-2">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="text-sm text-white/65">{item}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="animate-reveal-progressive">
              <p className="text-[0.6rem] font-bold uppercase tracking-[0.35em] text-white/25 mb-4">
                Open with one of these
              </p>
              <div className="space-y-2">
                {persona.sampleQuestions.map((question) => (
                  <button
                    key={question}
                    onClick={() => startSession(question)}
                    className="group flex w-full items-center justify-between gap-4 text-left rounded-2xl border border-white/8 bg-white/3 px-5 py-3.5 hover:border-gold/30 hover:bg-gold/4 transition-all"
                  >
                    <span className="font-display italic text-base text-white/70 group-hover:text-white/90 transition-colors">
                      “{question}”
                    </span>
                    <Sparkles
                      size={14}
                      className="shrink-0 text-gold/0 group-hover:text-gold transition-colors"
                    />
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-white/25">
                Tap a question to open the sitting with it.
              </p>
            </section>
          </div>

          {/* ── Before you sit ── */}
          <aside className="lg:sticky lg:top-28 rounded-3xl border border-white/10 bg-white/3 backdrop-blur-xl p-6 animate-reveal-progressive">
            <p className="text-[0.6rem] font-bold uppercase tracking-[0.35em] text-white/25">
              Before you sit
            </p>

            <div className="mt-5 space-y-3 text-sm">
              <div className="flex items-baseline justify-between">
                <span className="text-white/40">Balance</span>
                <span className="font-display text-lg text-white">
                  {isGuest ? "—" : creditsLoading ? "…" : `${credits} cr`}
                </span>
              </div>
              <div className="flex items-baseline justify-between border-t border-white/8 pt-3">
                <span className="text-white/40">Rate</span>
                <span className="font-display text-lg text-gold">
                  {persona.pricePerMin} cr / min
                </span>
              </div>
              <div className="flex items-baseline justify-between border-t border-white/8 pt-3">
                <span className="text-white/40">Time available</span>
                <span className="font-display text-lg text-white">
                  {isGuest
                    ? "—"
                    : creditsLoading
                      ? "…"
                      : `${estimatedMinutes} min`}
                </span>
              </div>
              {isGuest && (
                <p className="text-xs text-white/30">
                  Sign in to see your balance.
                </p>
              )}
              <label className="block border-t border-white/8 pt-3">
                <span className="text-white/40 text-xs">Language</span>
                <select
                  value={selectedLanguage}
                  onChange={(event) => setSelectedLanguage(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/75 outline-none focus:border-gold/40 cursor-pointer"
                >
                  {persona.languages.map((language) => (
                    <option
                      key={language}
                      value={language}
                      className="bg-[#111118]"
                    >
                      {language}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {!isGuest && !creditsLoading && !hasEnoughCredits && (
              <div className="mt-5 flex gap-3 rounded-xl border border-amber-400/20 bg-amber-500/10 p-3 text-left">
                <AlertCircle
                  size={16}
                  className="text-amber-300 shrink-0 mt-0.5"
                />
                <p className="text-xs text-amber-100/90 leading-relaxed">
                  This guide needs at least {persona.pricePerMin} credits for
                  the first minute.
                </p>
              </div>
            )}
            {paymentError && (
              <p className="mt-4 text-xs text-red-400">{paymentError}</p>
            )}

            {isGuest ? (
              <button
                onClick={() => {
                  setPendingQuestion(null);
                  setShowAuthModal(true);
                }}
                className="mt-6 w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gold text-black text-center text-[0.65rem] font-bold uppercase tracking-[0.12em] leading-relaxed hover:bg-gold/90 transition-colors"
              >
                <Sparkles size={14} className="shrink-0" />
                Sign in to begin — 15 free credits
              </button>
            ) : creditsLoading ? (
              <button
                disabled
                className="mt-6 w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white/40 text-[0.65rem] font-bold uppercase tracking-[0.2em]"
              >
                <Loader2 size={14} className="animate-spin" />
                Reading your balance
              </button>
            ) : hasEnoughCredits ? (
              <button
                onClick={() => startSession()}
                className="mt-6 w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gold text-black text-[0.65rem] font-bold uppercase tracking-[0.2em] hover:bg-gold/90 transition-colors"
              >
                <Sparkles size={14} />
                Begin the sitting
              </button>
            ) : (
              <button
                onClick={() => buyCredits(DEFAULT_CREDIT_PACK.minutes)}
                disabled={isPaying}
                className="mt-6 w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gold text-black text-[0.65rem] font-bold uppercase tracking-[0.2em] hover:bg-gold/90 transition-colors disabled:opacity-60"
              >
                {isPaying ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Wallet size={14} />
                )}
                Buy {DEFAULT_CREDIT_PACK.label}
              </button>
            )}
            <p className="mt-3 text-[0.65rem] text-white/30 leading-relaxed">
              Chart-aware guidance, billed in credits — charged only when the
              server closes the session.
            </p>
          </aside>
        </div>
      </main>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => {
          setShowAuthModal(false);
          setPendingQuestion(null);
        }}
        onSuccess={() => {
          setShowAuthModal(false);
          const draft = pendingQuestion;
          setPendingQuestion(null);
          void resumeAfterSignIn(draft);
        }}
        title="Sign in to begin"
        message={`${persona.name} reads your chart, so we need to know whose it is. New accounts start with 15 free credits.`}
      />
    </div>
  );
}
