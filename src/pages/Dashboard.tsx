import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUpRight, ChevronDown } from "lucide-react";

import { useAuth } from "../lib/useAuth";
import {
  useUserProfile,
  useConsciousness,
  usePanchang,
  useLunarPhase,
  useLastChat,
  useDailyPrediction,
  useDashaPeriods,
  useKundali,
  useNakshatra,
  useSubscription,
} from "../hooks";
import { useProactiveTriggers } from "../hooks/useProactiveTriggers";
import AuthModal from "../components/AuthModal";
import { OPEN_AUTH_EVENT } from "../components/dashboard/PersonalCardNotice";
import { REPORT_PRICING } from "../lib/report-pricing";
import {
  createReportRequestId,
  postPdfReport,
  REPORT_IN_PROGRESS_MESSAGE,
} from "../lib/report-products";
import { SIGNUP_BONUS_CREDITS } from "../lib/signup-offer";
import { STORAGE_KEYS } from "../lib/constants";
import { parseStoredJSON } from "../lib/safeStorage";
import SectionErrorBoundary from "../components/SectionErrorBoundary";
import { useErrorToast } from "../components/ui/toast-context";

import OnboardingModal from "../components/OnboardingModal";
import ChartShareModal from "../components/ChartShareModal";
import { DailyAltar } from "../components/sadhana/DailyAltar";
import { DharmaList } from "../components/dharma/DharmaList";

import { HeroAlmanac } from "../components/dashboard/HeroAlmanac";
import {
  DayTile,
  FactTile,
  TileHead,
  TodayForYouTile,
} from "../components/dashboard/WeatherTiles";
import { approximateLunar } from "../lib/moon-phase";
import { AskJyotishBar } from "../components/dashboard/AskJyotishBar";
import { ExploreIndex } from "../components/dashboard/ExploreIndex";
import { buildTodayGuide } from "../lib/todayGuide";
import { resolveDashboardPanchangPlace } from "../lib/panchang-place";
import { buildChartThreeLines, deriveProfileSigns } from "../lib/chart-summary";
import { normalizeZodiacMode } from "../lib/zodiac-mode";
import { MemoryPanel } from "../components/dashboard/MemoryPanel";
import { UtilityDock } from "../components/dashboard/UtilityDock";

import { YogaCard } from "../components/dashboard/YogaCard";
import { RemediesCard } from "../components/dashboard/RemediesCard";
import { DashaCard } from "../components/dashboard/DashaCard";
import { SadeSatiCard } from "../components/dashboard/SadeSatiCard";
import { FestivalCard } from "../components/dashboard/FestivalCard";
import { SoulInsightCard } from "../components/dashboard/SoulInsightCard";
import { DashaTimeline } from "../components/astrology/DashaTimeline";
import { TextAction, Tile } from "../components/dashboard/primitives";
import { GlossaryTerm } from "../components/ui/GlossaryTerm";

function DashboardSkeleton() {
  return (
    <div>
      <div className="container mx-auto pt-28 px-6 pb-12 max-w-6xl">
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
      </div>
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
  // One requestId per natal PDF purchase, kept until the server answers so a
  // retry after a network drop can never charge twice.
  const pendingNatalRequestId = useRef<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  // Secondary tiles stay folded (and unfetched) until asked for.
  const [showMore, setShowMore] = useState(false);
  const { credits } = useSubscription();
  const natalReportCost = REPORT_PRICING.natal.creditCost;

  // Personal cards ask for sign-in through a window event (see
  // PersonalCardNotice) so each card need not thread a callback.
  useEffect(() => {
    const open = () => setShowAuthModal(true);
    window.addEventListener(OPEN_AUTH_EVENT, open);
    return () => window.removeEventListener(OPEN_AUTH_EVENT, open);
  }, []);

  // Guest mode fallback — no account, but birth data stashed during
  // onboarding. sessionStorage is per tab, so a guest opening a new tab only
  // has the localStorage copy; read both before sending anyone to Landing.
  useEffect(() => {
    if (!user && !isLoading) {
      const stored =
        parseStoredJSON<Record<string, any>>(
          sessionStorage,
          STORAGE_KEYS.GUEST_PROFILE,
        ) ??
        parseStoredJSON<Record<string, any>>(
          localStorage,
          STORAGE_KEYS.PROFILE,
        );
      if (stored && typeof stored === "object") {
        setGuestData(stored);
      } else if (!profile?.dob) {
        navigate("/");
      }
    }
  }, [user, isLoading, navigate, profile?.dob]);

  const userData = profile || guestData;
  const hasBirthData = Boolean(userData?.dob);
  const displayName = userData?.profile?.name || userData?.name || "Seeker";

  // Panchang timings are local to where the user is now (onboarding's
  // current location), falling back to the birth place, then the server's
  // New Delhi default — and the tiles say which.
  const panchangPlace = useMemo(
    () => resolveDashboardPanchangPlace(userData),
    [userData],
  );
  const {
    panchang,
    loading: panchangLoading,
    error: panchangError,
  } = usePanchang(
    panchangPlace.city,
    panchangPlace.lat,
    panchangPlace.lng,
    userData?.timezone,
  );
  const { lunar: lunarFromService } = useLunarPhase(userData);
  // Never draw a blank or wrong moon: fall back to the date-based phase.
  const lunar = lunarFromService ?? approximateLunar();
  const lastChat = useLastChat();
  // Each of these is ONE request shared by every card that needs it — dasha
  // periods feed DashaCard, DashaTimeline, the three-lines card and the dasha
  // monitor; the nakshatra reading feeds NakshatraCard and the three lines.
  const dasha = useDashaPeriods(userData);
  const dashaPeriods = dasha.periods;
  const nakshatraState = useNakshatra(userData);
  const natal = useKundali(
    hasBirthData ? userData : null,
    "D1",
    profile?.zodiacMode,
  );

  // Proactive nudges (signed-in only; the hook no-ops for guests and keeps
  // persistent per-trigger cooldowns plus a daily cap).
  useProactiveTriggers({
    atmanState,
    userName: displayName === "Seeker" ? undefined : displayName,
    panchangData: panchang,
    dashaPeriods,
  });
  const {
    prediction,
    loading: isPredictionLoading,
    error: predictionError,
  } = useDailyPrediction(userData);

  // The natal Moon the day's guidance is read against: the saved sidereal
  // signs first, then the loaded Vedic chart (never a tropical one).
  const isVedic = normalizeZodiacMode(profile?.zodiacMode) === "vedic";
  const derivedSigns = isVedic ? deriveProfileSigns(natal.kundaliData) : null;
  const natalMoonSign: string | undefined =
    userData?.moonSign || derivedSigns?.moonSign;
  const natalMoonNakshatra: string | undefined =
    userData?.moonNakshatra ||
    derivedSigns?.moonNakshatra ||
    nakshatraState.nakshatra?.name;
  const todayGuide = useMemo(
    () =>
      buildTodayGuide(atmanState, panchang, panchangError, Boolean(user), {
        moonSign: natalMoonSign,
        moonNakshatra: natalMoonNakshatra,
      }),
    [
      atmanState,
      panchang,
      panchangError,
      user,
      natalMoonSign,
      natalMoonNakshatra,
    ],
  );
  // The hero carries the day's reading once. Without a prediction it falls back
  // to the day's nudge — never to Energy/Do, which the "Today for you" tile shows.
  const readingFallback = todayGuide.nudge;

  // Moon and Lagna lines for the "You" tiles (the Mahadasha lives in the season tile).
  const chartLines = useMemo(
    () =>
      buildChartThreeLines({
        kundali: natal.kundaliData,
        nakshatra:
          nakshatraState.nakshatra?.name ??
          deriveProfileSigns(natal.kundaliData)?.moonNakshatra ??
          null,
        dashaPeriods,
      }),
    [natal.kundaliData, nakshatraState.nakshatra?.name, dashaPeriods],
  );
  const moonLine = chartLines.find((l) => l.label === "Moon");
  const lagnaLine = chartLines.find((l) => l.label === "Lagna");

  const handleShareSign = () => {
    // Only ever the Moon sign — the Lagna is a different point and must never
    // be shared as "my Moon". Saved sidereal sign first, then the loaded
    // Vedic chart; with neither, share without claiming a sign.
    const moonSign =
      userData?.moonSign ||
      (normalizeZodiacMode(profile?.zodiacMode) === "vedic"
        ? deriveProfileSigns(natal.kundaliData)?.moonSign
        : undefined);
    const text = moonSign
      ? `I'm a ${moonSign} Moon ✨ What's your Moon sign? Find out free:`
      : "What's your Moon sign? Find yours free:";
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
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    // Not enough credits: send the user to the priced report flow, which
    // shows the price and offers a top-up — never a request that will fail.
    if (credits < natalReportCost) {
      navigate("/reports");
      return;
    }
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
      const requestId =
        pendingNatalRequestId.current ?? createReportRequestId();
      pendingNatalRequestId.current = requestId;
      const response = await postPdfReport({
        idToken,
        requestId,
        birthData,
        reportType: "natal",
      });
      // The server answered: this purchase attempt is settled either way.
      pendingNatalRequestId.current = null;
      const errorPayload = response.ok
        ? null
        : await response.json().catch(() => null);
      if (
        response.status === 409 &&
        errorPayload?.code === "report_in_progress"
      ) {
        throw new Error(errorPayload.error || REPORT_IN_PROGRESS_MESSAGE);
      }
      if (!response.ok) {
        throw new Error(errorPayload?.error || "Failed to generate PDF");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      // UTC is fine here: this is only a download filename.
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
    <div>

      <div className="container mx-auto pt-28 px-6 pb-16 relative z-10 max-w-6xl">
        <HeroAlmanac
          name={displayName}
          emotionalState={atmanState?.emotionalState}
          meditationStreak={atmanState?.meditationStreak}
          panchang={panchang}
          panchangLoading={panchangLoading}
          lunar={lunar}
          onShareSign={handleShareSign}
          reading={prediction || readingFallback}
          readingLoading={
            isPredictionLoading && !prediction && !predictionError
          }
          placeLabel={panchangPlace.label}
        />

        <div className="mt-10">
          <AskJyotishBar lastChat={lastChat} />
        </div>

        {/* One continuous grid of self-labelled tiles (Apple Weather structure):
            today first, then you, then the five spaces. Each tile has its own
            error boundary so one failing card never blanks the rest. */}
        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Today */}
          <SectionErrorBoundary label="day timings tile">
            <DayTile
              panchang={panchang}
              placeLabel={panchangPlace.label}
              className="sm:col-span-2 lg:col-span-4"
            />
          </SectionErrorBoundary>
          <SectionErrorBoundary label="today for you tile">
            <TodayForYouTile
              guide={todayGuide}
              showNudge={Boolean(prediction)}
              onSaveIntention={() =>
                user ? setShowDailyAltar(true) : setShowAuthModal(true)
              }
            />
          </SectionErrorBoundary>

          {/* Your journey (signed in) */}
          {user && atmanState && (
            <Tile className="sm:col-span-2">
              <SectionErrorBoundary label="soul insight tile">
                <SoulInsightCard
                  atmanState={atmanState}
                  onOpenSadhanaPath={() => setShowDailyAltar(true)}
                />
              </SectionErrorBoundary>
            </Tile>
          )}
          {user && (
            <Tile className="sm:col-span-2">
              <SectionErrorBoundary label="memory tile">
                <MemoryPanel
                  atmanState={atmanState}
                  hasBirthData={hasBirthData}
                />
              </SectionErrorBoundary>
            </Tile>
          )}
          {user && atmanState?.routines && atmanState.routines.length > 0 && (
            <Tile className="sm:col-span-2 lg:col-span-4">
              <SectionErrorBoundary label="daily practice tile">
                <TileHead>Your daily practice</TileHead>
                <DharmaList
                  routines={atmanState.routines}
                  userId={user.uid}
                  onComplete={refreshAtman}
                />
              </SectionErrorBoundary>
            </Tile>
          )}

          {/* You */}
          {hasBirthData && moonLine && (
            <SectionErrorBoundary label="Moon sign tile">
              <FactTile
                label="Moon sign"
                value={moonLine.value.split(" · ")[0]}
                note={
                  <>
                    {moonLine.value.split(" · ")[1] && (
                      <span className="block text-white/80">
                        {moonLine.value.split(" · ")[1]}
                      </span>
                    )}
                    {moonLine.meaning}
                  </>
                }
              >
                {nakshatraState.nakshatra &&
                  (nakshatraState.nakshatra.deity ||
                    nakshatraState.nakshatra.ruler) && (
                    <p className="mt-2 text-[0.9rem] text-white/50">
                      Birth star (
                      <GlossaryTerm k="nakshatra">nakshatra</GlossaryTerm>)
                      {nakshatraState.nakshatra.deity &&
                        `: deity ${nakshatraState.nakshatra.deity}`}
                      {nakshatraState.nakshatra.ruler &&
                        `, ruled by ${nakshatraState.nakshatra.ruler}`}
                    </p>
                  )}
              </FactTile>
            </SectionErrorBoundary>
          )}
          {hasBirthData && lagnaLine && (
            <SectionErrorBoundary label="rising sign tile">
              <FactTile
                label="Rising"
                value={lagnaLine.value}
                note={lagnaLine.meaning}
              />
            </SectionErrorBoundary>
          )}
          {hasBirthData && (
            <Tile className="sm:col-span-2 lg:col-span-4">
              <SectionErrorBoundary label="dasha tile">
                <DashaCard
                  periods={dashaPeriods}
                  loading={dasha.loading}
                  errorKind={dasha.errorKind}
                  onRetry={dasha.retry}
                  hasBirthData={hasBirthData}
                />
                {dashaPeriods.length > 0 && (
                  <div className="mt-6">
                    <DashaTimeline periods={dashaPeriods} />
                  </div>
                )}
              </SectionErrorBoundary>
            </Tile>
          )}

          {/* The five spaces */}
          <Tile className="sm:col-span-2 lg:col-span-4">
            <SectionErrorBoundary label="explore tile">
              <TileHead>Explore</TileHead>
              <ExploreIndex />
            </SectionErrorBoundary>
          </Tile>

          {/* Secondary tiles, folded (and not fetched) until asked for. */}
          <div className="sm:col-span-2 lg:col-span-4">
            <button
              type="button"
              aria-expanded={showMore}
              aria-controls="dashboard-more"
              onClick={() => setShowMore((v) => !v)}
              className="flex min-h-11 w-full items-center justify-between gap-3 rounded-[1.25rem] border border-white/[0.08] bg-white/[0.015] px-5 py-3 text-left text-[0.95rem] font-semibold text-white/75 transition-colors hover:border-white/20 hover:text-white"
            >
              <span>
                More for today
                <span className="ml-2 font-normal text-white/55">
                  {hasBirthData
                    ? "Sade Sati, yogas, remedies, festivals, tools"
                    : "Remedies, festivals, tools"}
                </span>
              </span>
              <ChevronDown
                size={18}
                aria-hidden="true"
                className={`shrink-0 transition-transform ${showMore ? "rotate-180" : ""}`}
              />
            </button>
          </div>
          {showMore && (
            <div
              id="dashboard-more"
              className="contents"
            >
              {hasBirthData && (
                <Tile className="sm:col-span-2">
                  <SectionErrorBoundary label="Sade Sati tile">
                    <SadeSatiCard birthData={userData} />
                  </SectionErrorBoundary>
                </Tile>
              )}
              {hasBirthData && (
                <Tile className="sm:col-span-2">
                  <SectionErrorBoundary label="yogas tile">
                    <YogaCard birthData={userData} />
                    {nakshatraState.nakshatra?.prediction && (
                      <div className="mt-6">
                        <TileHead>Birth star today</TileHead>
                        <p className="text-[0.98rem] leading-relaxed text-white/70">
                          {nakshatraState.nakshatra.prediction}
                        </p>
                      </div>
                    )}
                  </SectionErrorBoundary>
                </Tile>
              )}
              <Tile className="sm:col-span-2">
                <SectionErrorBoundary label="remedies tile">
                  <RemediesCard birthData={userData} />
                </SectionErrorBoundary>
              </Tile>
              <Tile className="sm:col-span-2 self-start">
                <SectionErrorBoundary label="festivals tile">
                  <FestivalCard region={profile?.festivalRegion} />
                  <div className="mt-4">
                    <TextAction to="/panchang">
                      Full Panchang
                      <ArrowUpRight size={12} />
                    </TextAction>
                  </div>
                </SectionErrorBoundary>
              </Tile>
              <Tile className="sm:col-span-2 lg:col-span-4">
                <SectionErrorBoundary label="tools tile">
                  <UtilityDock
                    profile={profile}
                    hasBirthData={hasBirthData}
                    downloadingNatal={downloadingNatal}
                    natalReportCost={natalReportCost}
                    onDownloadNatalReport={handleDownloadNatalReport}
                    onUpdateBirthData={() => setShowOnboardingModal(true)}
                    onOpenAltar={() => setShowDailyAltar(true)}
                    onShareChart={() => setShowChartShare(true)}
                  />
                </SectionErrorBoundary>
              </Tile>
            </div>
          )}
        </div>
      </div>

      <footer className="container mx-auto max-w-6xl px-6 py-8 border-t border-white/5 relative z-10">
        <p className="text-[0.6875rem] uppercase tracking-[0.3em] text-white/50">
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
            const stored = parseStoredJSON(
              sessionStorage,
              STORAGE_KEYS.GUEST_PROFILE,
            );
            if (stored) setGuestData(stored);
          }
        }}
        existingProfile={profile}
      />

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={() => setShowAuthModal(false)}
        title="Save your chart"
        message={`Sign in to save your chart and get ${SIGNUP_BONUS_CREDITS} free credits.`}
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
