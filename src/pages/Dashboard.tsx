import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUpRight, Sparkles } from "lucide-react";

import { useAuth } from "../lib/useAuth";
import {
  useUserProfile,
  useConsciousness,
  usePanchang,
  useLunarPhase,
  useLastChat,
  useDailyPrediction,
  useDashaPeriods,
} from "../hooks";
import { STORAGE_KEYS } from "../lib/constants";
import { useErrorToast } from "../components/ui/toast-context";

import Header from "../components/layout/Header";
import OnboardingModal from "../components/OnboardingModal";
import ChartShareModal from "../components/ChartShareModal";
import { DailyAltar } from "../components/sadhana/DailyAltar";
import { DharmaList } from "../components/dharma/DharmaList";

import { HeroAlmanac } from "../components/dashboard/HeroAlmanac";
import { AskJyotishBar } from "../components/dashboard/AskJyotishBar";
import { ExploreIndex } from "../components/dashboard/ExploreIndex";
import { TodayTriptych } from "../components/dashboard/TodayTriptych";
import { buildTodayGuide } from "../lib/todayGuide";
import { MemoryPanel } from "../components/dashboard/MemoryPanel";
import { UtilityDock } from "../components/dashboard/UtilityDock";

import { PanchangCard } from "../components/dashboard/PanchangCard";
import { YogaCard } from "../components/dashboard/YogaCard";
import { RemediesCard } from "../components/dashboard/RemediesCard";
import { DashaCard } from "../components/dashboard/DashaCard";
import { SadeSatiCard } from "../components/dashboard/SadeSatiCard";
import { NakshatraCard } from "../components/dashboard/NakshatraCard";
import { FestivalCard } from "../components/dashboard/FestivalCard";
import { SoulInsightCard } from "../components/dashboard/SoulInsightCard";
import { DashaTimeline } from "../components/astrology/DashaTimeline";
import { NightSky } from "../components/layout/NightSky";

function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-bg-app text-white">
      <Header onShowOnboarding={() => {}} />
      <main className="container mx-auto pt-28 px-6 pb-12 max-w-6xl">
        <div className="h-3 w-40 bg-white/5 rounded animate-pulse" />
        <div className="mt-6 h-16 w-72 bg-white/5 rounded-xl animate-pulse" />
        <div className="mt-8 h-px bg-white/8" />
        <div className="mt-px flex gap-px">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-20 flex-1 bg-white/3 animate-pulse" />
          ))}
        </div>
        <div className="mt-8 h-14 bg-white/5 rounded-2xl animate-pulse" />
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-[1fr_22rem] gap-10">
          <div className="space-y-5">
            <div className="h-44 bg-white/3 rounded-2xl animate-pulse" />
            <div className="h-64 bg-white/3 rounded-2xl animate-pulse" />
          </div>
          <div className="space-y-5">
            <div className="h-40 bg-white/3 rounded-2xl animate-pulse" />
            <div className="h-56 bg-white/3 rounded-2xl animate-pulse" />
          </div>
        </div>
      </main>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const showError = useErrorToast();

  const { profile, loading: isLoading } = useUserProfile();
  const { atmanState, refreshAtman } = useConsciousness();

  const [guestData, setGuestData] = useState<any>(null);
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [showDailyAltar, setShowDailyAltar] = useState(false);
  const [showChartShare, setShowChartShare] = useState(false);
  const [downloadingNatal, setDownloadingNatal] = useState(false);

  // Guest mode fallback — no account, but birth data stashed during onboarding
  useEffect(() => {
    if (!user && !isLoading) {
      const stored = sessionStorage.getItem(STORAGE_KEYS.GUEST_PROFILE);
      if (stored) {
        setGuestData(JSON.parse(stored));
      } else {
        navigate("/");
      }
    }
  }, [user, isLoading, navigate]);

  const userData = profile || guestData;
  const hasBirthData = Boolean(userData?.dob);
  const displayName = userData?.profile?.name || userData?.name || "Seeker";

  const {
    panchang,
    loading: panchangLoading,
    error: panchangError,
  } = usePanchang(
    profile?.pob,
    profile?.coordinates?.lat,
    profile?.coordinates?.lng,
  );
  const { lunar } = useLunarPhase(userData);
  const lastChat = useLastChat();
  const dashaPeriods = useDashaPeriods(userData);
  const {
    prediction,
    loading: isPredictionLoading,
    error: predictionError,
  } = useDailyPrediction(userData);

  const readingFallback = useMemo(() => {
    const guide = buildTodayGuide(
      atmanState,
      panchang,
      panchangError,
      Boolean(user),
    );
    return `${guide.energy}. ${guide.action}`;
  }, [atmanState, panchang, panchangError, user]);

  const handleShareSign = () => {
    const ascendantSign =
      typeof profile?.ascendant === "string"
        ? profile.ascendant
        : profile?.ascendant?.sign;
    const moonSign = profile?.moonSign || ascendantSign || "a cosmic being";
    const text = `I'm a ${moonSign} Moon ✨ What's your Moon sign? Find out free:`;
    const url = `${window.location.origin}/free-kundali`;
    if (navigator.share) {
      navigator.share({ title: "My Moon Sign", text, url });
    } else {
      window.open(
        `https://wa.me/?text=${encodeURIComponent(text + "\n" + url)}`,
        "_blank",
      );
    }
  };

  const handleDownloadNatalReport = async () => {
    if (!userData || downloadingNatal) return;
    setDownloadingNatal(true);
    try {
      const idToken = user ? await user.getIdToken() : null;
      if (!idToken) throw new Error("Please sign in to generate reports.");
      const birthData = {
        name: userData.profile?.name || userData.name,
        dob: userData.dob,
        tob: userData.tob || "12:00",
        pob: userData.pob || "",
        lat: userData.coordinates?.lat,
        lng: userData.coordinates?.lng,
      };
      const response = await fetch("/api/pdf-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, birthData, reportType: "natal" }),
      });
      const errorPayload = response.ok
        ? null
        : await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(errorPayload?.error || "Failed to generate PDF");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `astroyou-natal-report-${new Date().toISOString().split("T")[0]}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Natal report download error:", err);
      showError(
        "Download Failed",
        err instanceof Error
          ? err.message
          : "Could not generate natal report. Please try again.",
      );
    } finally {
      setDownloadingNatal(false);
    }
  };

  if (isLoading) return <DashboardSkeleton />;

  return (
    <div className="min-h-screen bg-bg-app text-white selection:bg-gold/30">
      <NightSky />
      <Header onShowOnboarding={() => setShowOnboardingModal(true)} />

      <main className="container mx-auto pt-28 px-6 pb-16 relative z-10 max-w-6xl">
        <HeroAlmanac
          name={displayName}
          emotionalState={atmanState?.emotionalState}
          meditationStreak={atmanState?.meditationStreak}
          panchang={panchang}
          panchangLoading={panchangLoading}
          lunar={lunar}
          onShareSign={handleShareSign}
        />

        <div className="mt-8">
          <AskJyotishBar lastChat={lastChat} />
        </div>

        <div className="mt-10">
          <ExploreIndex />
        </div>

        <div className="mt-12 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_22rem] gap-x-10 gap-y-12 items-start">
          {/* ── The day, read closely ── */}
          <div className="space-y-10 min-w-0">
            <TodayTriptych
              atmanState={atmanState}
              panchang={panchang}
              panchangError={panchangError}
              isSignedIn={Boolean(user)}
              onSaveIntention={() =>
                user ? setShowDailyAltar(true) : navigate("/onboarding")
              }
            />

            {user && atmanState?.routines && atmanState.routines.length > 0 && (
              <div className="glass rounded-3xl p-5 animate-reveal-progressive">
                <DharmaList
                  routines={atmanState.routines}
                  userId={user.uid}
                  onComplete={refreshAtman}
                />
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-reveal-progressive">
              <PanchangCard />
              <YogaCard birthData={userData} />
            </div>

            {dashaPeriods.length > 0 && (
              <DashaTimeline periods={dashaPeriods} />
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-reveal-progressive">
              <SadeSatiCard birthData={userData} />
              <NakshatraCard birthData={userData} />
            </div>
          </div>

          {/* ── The margin notes ── */}
          <aside className="space-y-6 min-w-0">
            {/* Today's reading */}
            <section className="relative glass rounded-3xl p-6 animate-reveal-progressive overflow-visible">
              <span className="absolute -top-3 left-6 px-2 bg-bg-app text-gold/80 text-[0.6rem] font-bold uppercase tracking-[0.35em]">
                Today's Word
              </span>
              {isPredictionLoading && !prediction && !predictionError ? (
                <div className="flex items-center gap-2 text-sm text-white/45">
                  <Sparkles size={14} className="text-gold" />
                  Preparing today's guidance…
                </div>
              ) : (
                <>
                  <p className="font-display text-lg text-white/75 leading-relaxed italic">
                    {prediction || readingFallback}
                  </p>
                  <button
                    onClick={() => navigate("/forecast")}
                    className="mt-4 text-xs uppercase tracking-[0.2em] font-bold text-gold hover:text-white transition-colors inline-flex items-center gap-1.5 group"
                  >
                    Open forecast
                    <ArrowUpRight
                      size={12}
                      className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform"
                    />
                  </button>
                </>
              )}
            </section>

            {user && atmanState && (
              <SoulInsightCard
                atmanState={atmanState}
                onOpenSadhanaPath={() => setShowDailyAltar(true)}
              />
            )}

            {user && (
              <MemoryPanel
                atmanState={atmanState}
                hasBirthData={hasBirthData}
              />
            )}

            <DashaCard />
            <RemediesCard birthData={userData} />
            <FestivalCard />

            <UtilityDock
              profile={profile}
              hasBirthData={hasBirthData}
              downloadingNatal={downloadingNatal}
              onDownloadNatalReport={handleDownloadNatalReport}
              onUpdateBirthData={() => setShowOnboardingModal(true)}
              onOpenAltar={() => setShowDailyAltar(true)}
              onShareChart={() => setShowChartShare(true)}
            />
          </aside>
        </div>
      </main>

      <footer className="container mx-auto max-w-6xl px-6 py-8 border-t border-white/5 relative z-10">
        <p className="text-[0.6rem] uppercase tracking-[0.35em] text-white/20">
          {userData?.pob
            ? `Cast for ${userData.pob}`
            : "Cast under the open sky"}
          {" · "}as above, so below
        </p>
      </footer>

      <OnboardingModal
        isOpen={showOnboardingModal}
        onClose={() => setShowOnboardingModal(false)}
        onComplete={() => {
          if (!user) {
            const stored = sessionStorage.getItem(STORAGE_KEYS.GUEST_PROFILE);
            if (stored) setGuestData(JSON.parse(stored));
          }
        }}
        existingProfile={profile}
      />

      {user && (
        <DailyAltar
          isOpen={showDailyAltar}
          onClose={() => setShowDailyAltar(false)}
          userId={user.uid}
          atmanState={atmanState}
          onRefresh={refreshAtman}
        />
      )}

      <ChartShareModal
        isOpen={showChartShare}
        onClose={() => setShowChartShare(false)}
        birthData={
          userData?.dob
            ? {
                name: userData.profile?.name || userData.name,
                dob: userData.dob,
                tob: userData.tob || "12:00",
                pob: userData.pob || "",
                lat: userData.coordinates?.lat,
                lng: userData.coordinates?.lng,
              }
            : null
        }
      />
    </div>
  );
}
