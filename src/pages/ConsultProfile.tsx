import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getPersonaById } from "../lib/personas";
import {
  AlertCircle,
  ArrowLeft,
  Globe,
  Loader2,
  MessageSquare,
  Star,
  Wallet,
} from "lucide-react";
import Header from "../components/layout/Header";
import { useAuth } from "../lib/useAuth";
import { useTrustSummary, useUserProfile } from "../hooks";
import { useCreditTopup } from "../hooks/useCreditTopup";
import { DEFAULT_CREDIT_PACK } from "../lib/credit-packs";
import { PersonaPortrait } from "../components/consult/PersonaPortrait";
import { getPlatformLanguage } from "../lib/languages";
import { getPersonaTrustDisplay } from "../lib/trust-summary";
import { trackAcquisitionEvent } from "../lib/acquisition";

export default function ConsultProfile() {
  const { personaId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile, loading } = useUserProfile();
  const { summary: trustSummary } = useTrustSummary();
  const { buyCredits, isPaying, error: paymentError } = useCreditTopup();
  const persona = getPersonaById(personaId || "");
  const [selectedLanguage, setSelectedLanguage] = useState(
    persona?.languages[0] || "English",
  );

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

  if (!persona) {
    navigate("/consult");
    return null;
  }

  const credits = profile?.credits ?? 0;
  const estimatedMinutes = Math.floor(credits / persona.pricePerMin);
  const hasEnoughCredits = credits >= persona.pricePerMin;
  const trustDisplay = getPersonaTrustDisplay(trustSummary, persona.id);

  return (
    <div className="min-h-screen bg-[#030308] text-white">
      <Header />
      <main className="platform-main max-w-5xl">
        <button
          onClick={() => navigate("/consult")}
          className="mb-4 flex items-center gap-2 text-sm text-white/40 hover:text-white"
        >
          <ArrowLeft size={16} /> AI astrologers
        </button>

        <section className="grid grid-cols-1 lg:grid-cols-[1fr_20rem] gap-4 items-start">
          <article className="platform-panel p-4">
            <div className="flex flex-col sm:flex-row sm:items-start gap-4">
              <PersonaPortrait persona={persona} size="lg" />
              <div className="min-w-0 flex-1">
                <p className="platform-eyebrow mb-2">AI Astrologer</p>
                <h1 className="type-page-title text-white">{persona.name}</h1>
                <p className="type-card-title mt-2 text-white/70">{persona.title}</p>
                <p className="platform-copy mt-3 max-w-2xl">
                  {persona.profileIntro}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="platform-chip text-emerald-300">
                    Chart-aware session
                  </span>
                  <span className="platform-chip text-gold">
                    {persona.pricePerMin} credits/min
                  </span>
                  <span className="platform-chip text-white/55">
                    {persona.specialty}
                  </span>
                  <span className="platform-chip text-white/55">
                    {trustDisplay.hasApprovedReviews ? (
                      <span className="inline-flex items-center gap-1">
                        <Star size={13} className="fill-current text-gold" />
                        {trustDisplay.ratingLabel} · {trustDisplay.reviewLabel}
                      </span>
                    ) : (
                      "Collecting reviewed feedback"
                    )}
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Globe size={14} className="text-white/40" />
                  {persona.languages.map((language) => (
                    <span
                      key={language}
                      className="rounded-full border border-white/10 px-2 py-1 text-xs text-white/50"
                    >
                      {language}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </article>

          <aside className="platform-panel p-4">
            <div className="flex items-center gap-2 text-gold">
              <Wallet size={15} />
              <p className="type-meta uppercase">Before you start</p>
            </div>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between border-t border-white/10 pt-3">
                <span className="type-body-sm text-white/40">Balance</span>
                <span className="type-card-title text-white">
                  {loading ? "..." : `${credits} credits`}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-white/10 pt-3">
                <span className="type-body-sm text-white/40">Rate</span>
                <span className="type-card-title text-gold">
                  {persona.pricePerMin} credits/min
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-white/10 pt-3">
                <span className="type-body-sm text-white/40">Available time</span>
                <span className="type-card-title text-white">
                  {loading ? "..." : `${estimatedMinutes} min`}
                </span>
              </div>
              <label className="block border-t border-white/10 pt-3">
                <span className="type-body-sm text-white/40">Language</span>
                <select
                  value={selectedLanguage}
                  onChange={(event) => setSelectedLanguage(event.target.value)}
                  className="platform-field mt-2 py-2 px-3 text-sm text-white/70"
                >
                  {persona.languages.map((language) => (
                    <option key={language} value={language} className="bg-[#111118]">
                      {language}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </aside>
        </section>

        <section className="mt-4 grid grid-cols-1 lg:grid-cols-[1fr_20rem] gap-4 items-start">
          <div className="space-y-4">
            <article className="platform-panel p-4">
              <h2 className="type-section-title text-white">Best for</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {persona.bestFor.map((item) => (
                  <span key={item} className="platform-chip text-white/60">
                    {item}
                  </span>
                ))}
              </div>
            </article>

            <article className="platform-panel p-4">
              <h2 className="type-section-title text-white">Reads with</h2>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {persona.methods.map((method) => (
                  <div
                    key={method}
                    className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 type-body-sm text-white/60"
                  >
                    {method}
                  </div>
                ))}
              </div>
            </article>

            <article className="platform-panel p-4">
              <h2 className="type-section-title text-white">Good questions to ask</h2>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                {persona.sampleQuestions.map((question) => (
                  <div
                    key={question}
                    className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-3 type-body-sm text-white/60"
                  >
                    {question}
                  </div>
                ))}
              </div>
            </article>
          </div>

          <div className="space-y-4">
            <article className="platform-panel p-4">
              <h2 className="type-section-title text-white">Guidance style</h2>
              <p className="platform-copy mt-3">{persona.guidanceStyle}</p>
              <div className="mt-4 rounded-xl border border-gold/15 bg-gold/[0.06] p-3">
                <p className="type-body-sm text-gold">
                  Transparent AI astrologer
                </p>
                <p className="type-meta text-white/40 mt-1">
                  This session is AI-led, chart-aware, and billed in credits.
                  Human astrologer profiles can use the same structure later.
                </p>
              </div>
            </article>

            <aside className="platform-panel p-4">
              {!loading && !hasEnoughCredits && (
                <div className="mb-4 flex gap-3 rounded-xl border border-amber-400/20 bg-amber-500/10 p-3 text-left">
                  <AlertCircle size={18} className="text-amber-300 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-amber-100 font-medium">
                      Add credits before starting.
                    </p>
                    <p className="text-xs text-white/40 mt-1">
                      This guide needs at least {persona.pricePerMin} credits for
                      the first minute.
                    </p>
                  </div>
                </div>
              )}
              {paymentError && (
                <p className="text-sm text-red-400 mb-4">{paymentError}</p>
              )}
              {hasEnoughCredits ? (
                <button
                  onClick={() => {
                    if (!user) navigate("/onboarding");
                    else {
                      navigate(
                        `/consult/${persona.id}/chat?lang=${encodeURIComponent(
                          selectedLanguage,
                        )}`,
                      );
                    }
                  }}
                  className="platform-button-primary w-full"
                >
                  <MessageSquare size={20} />
                  Start consultation
                </button>
              ) : (
                <button
                  onClick={() =>
                    user
                      ? buyCredits(DEFAULT_CREDIT_PACK.minutes)
                      : navigate("/onboarding")
                  }
                  disabled={isPaying}
                  className="platform-button-primary w-full disabled:opacity-60"
                >
                  {isPaying ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : (
                    <Wallet size={20} />
                  )}
                  Buy {DEFAULT_CREDIT_PACK.label}
                </button>
              )}
              <p className="type-meta text-white/30 mt-3">
                Credits are charged only when the server closes the session.
              </p>
            </aside>
          </div>
        </section>
      </main>
    </div>
  );
}
