import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { LandingSEO } from "../components/SEO";
import AuthModal from "../components/AuthModal";
import OnboardingModal from "../components/OnboardingModal";
import SectionErrorBoundary from "../components/SectionErrorBoundary";
import { useDialog } from "../hooks/useDialog";
import CosmosToSelfStory, {
  type LandingTrustSummary,
} from "../components/landing/CosmosToSelfStory";
import Header from "../components/layout/Header";
import Footer from "../components/layout/Footer";
import { useAuth } from "../lib/useAuth";
import { auth, db } from "../lib/firebase";
import { STORAGE_KEYS } from "../lib/constants";
import { captureReferralFromUrl } from "../lib/acquisition";
import { hasSavedBirthProfile } from "../lib/saved-profile";
import { SIGNUP_BONUS_CREDITS } from "../lib/signup-offer";
import { TIERS } from "../lib/subscriptions";
import {
  getPlanetStoryState,
  PLANET_STORY_CHAPTERS,
  type PlanetStoryChapter,
} from "../lib/landing-planet-story";

const CelestialEngine = lazy(() => import("../components/CelestialEngine"));

const PLANS_FROM_INR = TIERS.premium.prices.INR.toLocaleString("en-IN");

/**
 * The 3D sky costs ~890KB of three.js plus ~4.6MB of planet textures (loaded
 * by the engine itself, so they arrive only when it mounts). Only devices that
 * can comfortably afford it get it; everyone else sees the CSS starfield.
 */
function canAffordCelestialEngine(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  if (!window.matchMedia("(prefers-reduced-motion: no-preference)").matches) {
    return false;
  }
  if (!window.matchMedia("(min-width: 768px)").matches) return false;
  const nav = navigator as Navigator & {
    connection?: { saveData?: boolean };
    deviceMemory?: number;
  };
  if (nav.connection?.saveData) return false;
  if (typeof nav.deviceMemory === "number" && nav.deviceMemory < 4) {
    return false;
  }
  return true;
}

/** Static, CSS-only starfield: a few tiled dots, no JavaScript, no images. */
const CSS_STARFIELD = [
  "radial-gradient(1px 1px at 22px 34px, rgba(255,255,255,0.75), transparent)",
  "radial-gradient(1px 1px at 128px 86px, rgba(255,255,255,0.55), transparent)",
  "radial-gradient(1.5px 1.5px at 206px 154px, rgba(229,185,106,0.7), transparent)",
  "radial-gradient(1px 1px at 64px 196px, rgba(255,255,255,0.45), transparent)",
  "radial-gradient(1px 1px at 174px 18px, rgba(255,255,255,0.65), transparent)",
  "radial-gradient(1.5px 1.5px at 248px 232px, rgba(255,255,255,0.5), transparent)",
].join(", ");

function PlanetStoryNarrative({
  chapter,
  isActive,
  onReveal,
  onHaveChart,
}: {
  chapter: PlanetStoryChapter;
  isActive: boolean;
  onReveal: () => void;
  onHaveChart: () => void;
}) {
  const isOpening = chapter.id === "moving-sky";
  const isSynthesis = chapter.id === "synthesis";
  const StoryHeading = isOpening ? "h1" : "h2";
  const alignment =
    chapter.alignment === "right"
      ? "lg:ml-auto lg:mr-16 xl:mr-24"
      : chapter.alignment === "center"
        ? "lg:mx-auto lg:text-center"
        : "lg:mr-auto";
  const inactiveMotion =
    chapter.alignment === "right"
      ? "translate-y-6 lg:translate-x-12 lg:translate-y-0"
      : chapter.alignment === "center"
        ? "translate-y-10"
        : "translate-y-6 lg:-translate-x-12 lg:translate-y-0";
  const narrativeWidth = isOpening
    ? "max-w-[48rem]"
    : isSynthesis
      ? "max-w-[52rem]"
      : "max-w-[39rem]";

  return (
    <article
      data-planet-story-chapter={chapter.id}
      data-story-active={isActive ? "true" : "false"}
      data-story-treatment="cinematic"
      className={`relative w-full border-0 bg-transparent px-1 py-4 transition-all duration-700 sm:px-2 ${narrativeWidth} ${alignment} ${
        isActive
          ? "translate-x-0 translate-y-0 opacity-100 blur-0"
          : `${inactiveMotion} opacity-0 blur-[2px]`
      }`}
    >
      <div
        className={`flex items-center gap-4 ${isSynthesis ? "lg:justify-center" : ""}`}
      >
        <span
          className="h-px w-10 sm:w-14"
          style={{
            backgroundColor: chapter.accent,
            boxShadow: `0 0 18px ${chapter.glow}`,
          }}
          aria-hidden="true"
        />
        <span
          className="text-[0.6875rem] font-black uppercase tracking-[0.38em] sm:text-xs"
          style={{ color: chapter.accent }}
        >
          {chapter.eyebrow}
        </span>
      </div>

      <StoryHeading
        id={`planet-story-title-${chapter.id}`}
        className={`mt-6 font-display leading-[0.98] tracking-[-0.025em] text-white [text-shadow:0_3px_28px_rgba(0,0,0,0.9)] ${
          isOpening
            ? "text-6xl sm:text-7xl md:text-[7rem] lg:text-[8rem]"
            : isSynthesis
              ? "text-5xl sm:text-6xl md:text-7xl"
              : "text-4xl sm:text-5xl md:text-6xl lg:text-[4.5rem]"
        }`}
      >
        {isOpening ? (
          <>
            The stars,{" "}
            <span className="font-light italic text-white/72">revealed.</span>
          </>
        ) : (
          chapter.title
        )}
      </StoryHeading>

      {chapter.forces.length > 0 ? (
        <div
          className={`mt-7 flex flex-wrap gap-x-7 gap-y-2 ${
            isSynthesis ? "lg:justify-center" : ""
          }`}
        >
          {chapter.forces.map((force) => (
            <div key={force.name} className="flex items-baseline gap-2">
              <span className="text-sm font-semibold uppercase tracking-[0.16em] text-white/90">
                {force.name}
              </span>
              <span className="font-display text-sm italic text-white/55">
                {force.sanskrit}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      <p
        className={`mt-7 max-w-xl text-base font-light leading-relaxed text-white/78 [text-shadow:0_2px_18px_rgba(0,0,0,0.95)] sm:text-lg md:text-xl ${
          isSynthesis ? "lg:mx-auto" : ""
        }`}
      >
        {chapter.body}
      </p>

      <div
        className={`mt-7 max-w-xl border-t pt-4 ${isSynthesis ? "lg:mx-auto lg:text-left" : ""}`}
        style={{ borderColor: `${chapter.accent}55` }}
      >
        <span className="text-xs font-bold uppercase tracking-[0.3em] text-white/55">
          In Jyotish
        </span>
        <p className="mt-2 text-sm leading-relaxed text-white/64 [text-shadow:0_2px_14px_rgba(0,0,0,0.95)]">
          {chapter.jyotish}
        </p>
      </div>

      <p
        className={`mt-6 max-w-xl font-display text-base italic [text-shadow:0_2px_16px_rgba(0,0,0,0.95)] sm:text-lg ${
          isSynthesis ? "lg:text-center" : ""
        }`}
        style={{ color: chapter.accent }}
      >
        {chapter.question}
      </p>

      {isOpening || isSynthesis ? (
        <div
          className={`mt-8 flex flex-col gap-3 sm:flex-row ${
            isSynthesis ? "lg:justify-center" : ""
          }`}
        >
          <button
            type="button"
            className="btn btn-primary group px-8"
            onClick={onReveal}
          >
            See my free Kundali
            <span className="ml-2 transition-transform group-hover:translate-x-1">
              →
            </span>
          </button>
          {isOpening ? (
            <button
              type="button"
              className="btn border-0 bg-transparent px-8 text-white/70 underline decoration-white/20 underline-offset-8 hover:text-white"
              onClick={onHaveChart}
            >
              I already have a chart
            </button>
          ) : null}
        </div>
      ) : null}

      {isOpening ? (
        <div className="mt-6 max-w-xl space-y-1 text-sm leading-relaxed text-white/70 [text-shadow:0_2px_14px_rgba(0,0,0,0.95)]">
          <p>
            A Jyotish guide reads your birth chart and answers in plain
            language. It is not a human astrologer.
          </p>
          <p className="text-white/55">
            Free to start · plans from ₹{PLANS_FROM_INR}/month
          </p>
        </div>
      ) : null}
    </article>
  );
}

function getPlanetStoryScrimClass(chapter: PlanetStoryChapter) {
  const mobileScrim =
    "bg-[linear-gradient(180deg,rgba(3,3,8,0.08)_0%,rgba(3,3,8,0.7)_24%,rgba(3,3,8,0.88)_72%,rgba(3,3,8,0.2)_100%)]";

  if (chapter.alignment === "right") {
    return `${mobileScrim} lg:bg-[linear-gradient(270deg,rgba(3,3,8,0.82)_0%,rgba(3,3,8,0.52)_30%,rgba(3,3,8,0.08)_54%,transparent_72%)]`;
  }

  if (chapter.alignment === "center") {
    return `${mobileScrim} lg:bg-[radial-gradient(ellipse_at_center,rgba(3,3,8,0.8)_0%,rgba(3,3,8,0.42)_36%,rgba(3,3,8,0.06)_60%,transparent_76%)]`;
  }

  return `${mobileScrim} lg:bg-[linear-gradient(90deg,rgba(3,3,8,0.82)_0%,rgba(3,3,8,0.52)_30%,rgba(3,3,8,0.08)_54%,transparent_72%)]`;
}

function HaveChartChoice({
  isOpen,
  onClose,
  onUpload,
  onSignIn,
}: {
  isOpen: boolean;
  onClose: () => void;
  onUpload: () => void;
  onSignIn: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  // Focus moves in on open, Tab is trapped, Escape closes, and focus returns
  // to the "I already have a chart" trigger on close.
  useDialog(dialogRef, onClose, isOpen);

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/85 backdrop-blur-md"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="have-chart-title"
        className="relative z-10 w-full max-w-md rounded-[2rem] border border-white/10 bg-[#0a0a0f] p-6 shadow-2xl"
      >
        <h2 id="have-chart-title" className="font-display text-2xl text-white">
          Welcome back to your sky
        </h2>
        <p className="mt-2 text-sm text-white/55">
          How would you like to bring your chart in?
        </p>
        <div className="mt-6 space-y-3">
          <button
            type="button"
            onClick={onSignIn}
            className="w-full rounded-2xl border border-gold/30 bg-gold/10 px-5 py-4 text-left transition-colors hover:bg-gold/15"
          >
            <span className="block text-sm font-bold uppercase tracking-widest text-gold">
              Sign in
            </span>
            <span className="mt-1 block text-sm text-white/60">
              Your chart is already saved with AstroYou.
            </span>
          </button>
          <button
            type="button"
            onClick={onUpload}
            className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-left transition-colors hover:border-gold/30"
          >
            <span className="block text-sm font-bold uppercase tracking-widest text-white/80">
              Upload a Kundali
            </span>
            <span className="mt-1 block text-sm text-white/50">
              Photo of a printed or handwritten chart — we read the birth details from it.
            </span>
          </button>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full text-xs uppercase tracking-widest text-white/55 hover:text-white/70"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function Landing() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  // "I already have a chart": choose between uploading a Kundali image and
  // signing in to a saved chart. Upload is only offered on this path.
  const [showHaveChartChoice, setShowHaveChartChoice] = useState(false);
  const [onboardingStartsWithUpload, setOnboardingStartsWithUpload] =
    useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [showCelestialEngine, setShowCelestialEngine] = useState(false);
  const [trustSummary, setTrustSummary] = useState<LandingTrustSummary | null>(
    null,
  );
  const stackRef = useRef<HTMLDivElement>(null);
  const storyState = getPlanetStoryState(scrollProgress);

  useEffect(() => {
    captureReferralFromUrl();
  }, []);

  useEffect(() => {
    if (!canAffordCelestialEngine()) return;
    const timer = window.setTimeout(() => setShowCelestialEngine(true), 600);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    let alive = true;
    fetch("/api/trust/summary")
      .then((response) => response.json())
      .then((data) => {
        if (alive && !data?.error) setTrustSummary(data);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let animationFrame = 0;

    const updateProgress = () => {
      animationFrame = 0;
      if (!stackRef.current) return;

      const rect = stackRef.current.getBoundingClientRect();
      const stackTop = rect.top + window.scrollY;
      const scrollDistance = Math.max(rect.height - window.innerHeight, 1);
      const progress = (window.scrollY - stackTop) / scrollDistance;
      setScrollProgress(Math.min(Math.max(progress, 0), 1));
    };

    const scheduleProgressUpdate = () => {
      if (!animationFrame) {
        animationFrame = window.requestAnimationFrame(updateProgress);
      }
    };

    updateProgress();
    window.addEventListener("scroll", scheduleProgressUpdate, { passive: true });
    window.addEventListener("resize", scheduleProgressUpdate);
    return () => {
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("scroll", scheduleProgressUpdate);
      window.removeEventListener("resize", scheduleProgressUpdate);
    };
  }, []);

  useEffect(() => {
    if (user && sessionStorage.getItem(STORAGE_KEYS.LOGIN_REDIRECT)) {
      sessionStorage.removeItem(STORAGE_KEYS.LOGIN_REDIRECT);
      navigate("/dashboard");
    }
  }, [user, navigate]);

  // Returning signed-in users with a saved birth profile belong on their
  // dashboard, not the marketing page.
  useEffect(() => {
    if (!user) return;
    let alive = true;
    getDoc(doc(db, "users", user.uid))
      .then((snap) => {
        if (alive && snap.exists() && hasSavedBirthProfile(snap.data())) {
          navigate("/dashboard", { replace: true });
        }
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [user, navigate]);

  const userHasSavedProfile = async (uid: string) => {
    try {
      const docSnap = await getDoc(doc(db, "users", uid));
      return docSnap.exists() && hasSavedBirthProfile(docSnap.data());
    } catch {
      return false;
    }
  };

  const openOnboarding = (startWithUpload: boolean) => {
    setOnboardingStartsWithUpload(startWithUpload);
    setShowOnboardingModal(true);
  };

  const handleLoginSuccess = async () => {
    const currentUser = auth.currentUser || user;
    if (currentUser) {
      if (await userHasSavedProfile(currentUser.uid)) {
        navigate("/dashboard");
      } else {
        sessionStorage.setItem(STORAGE_KEYS.MODE, "logged_in");
        openOnboarding(false);
      }
    } else {
      navigate("/dashboard");
    }
  };

  const handleRevealBirthSky = async () => {
    if (user) {
      if (await userHasSavedProfile(user.uid)) {
        navigate("/dashboard");
        return;
      }

      sessionStorage.setItem(STORAGE_KEYS.MODE, "logged_in");
      openOnboarding(false);
      return;
    }

    sessionStorage.setItem(STORAGE_KEYS.MODE, "guest");
    openOnboarding(false);
  };

  const handleUploadChart = () => {
    setShowHaveChartChoice(false);
    sessionStorage.setItem(STORAGE_KEYS.MODE, user ? "logged_in" : "guest");
    openOnboarding(true);
  };

  const handleSignInFromChoice = () => {
    setShowHaveChartChoice(false);
    setShowAuthModal(true);
  };

  return (
    <div className="landing relative min-h-screen bg-surface-primary transition-colors duration-700">
      <LandingSEO />

      <div
        className="pointer-events-none fixed inset-0 z-[-1] overflow-hidden"
        aria-hidden="true"
      >
        <div className="blob top-[-10%] right-[-5%] h-[60vw] w-[60vw] bg-violet/5 animate-float-slow" />
        <div
          className="blob bottom-[-10%] left-[-5%] h-[60vw] w-[60vw] bg-indigo/5 animate-float-slow"
          style={{ animationDelay: "-5s" }}
        />
      </div>

      <Header
        onShowAuth={() => setShowAuthModal(true)}
        onShowOnboarding={() => openOnboarding(false)}
      />

      <div
        className="relative bg-[#030308]"
        ref={stackRef}
        data-planet-story-stack
      >
        <div
          className="sticky top-0 z-0 h-screen w-full overflow-hidden bg-[#030308]"
          aria-hidden="true"
        >
          <div className="absolute inset-0 flex items-center justify-center opacity-70">
            <div className="h-[min(72vw,38rem)] w-[min(72vw,38rem)] rounded-full border border-gold/10 shadow-[0_0_120px_rgba(229,185,106,0.08)]" />
            <div className="absolute h-3 w-3 rounded-full bg-gold shadow-[0_0_45px_rgba(229,185,106,0.8)]" />
          </div>

          {!showCelestialEngine ? (
            <div
              className="absolute inset-0 opacity-70"
              style={{
                backgroundImage: CSS_STARFIELD,
                backgroundSize: "260px 260px",
              }}
            />
          ) : null}

          <div className="h-full w-full motion-reduce:hidden">
            {showCelestialEngine ? (
              <SectionErrorBoundary label="celestial story">
                <Suspense fallback={null}>
                  <CelestialEngine progress={scrollProgress} />
                </Suspense>
              </SectionErrorBoundary>
            ) : null}
          </div>

          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_20%,rgba(3,3,8,0.24)_62%,rgba(3,3,8,0.84)_100%)]" />
        </div>

        <div className="relative z-10 -mt-[100vh]">
          {PLANET_STORY_CHAPTERS.map((chapter, index) => (
            <section
              key={chapter.id}
              className="relative flex min-h-[100svh] items-center px-4 pb-14 pt-24 sm:px-6 md:px-12 md:pb-20 md:pt-28"
              aria-labelledby={`planet-story-title-${chapter.id}`}
            >
              <div
                className={`pointer-events-none absolute inset-0 ${getPlanetStoryScrimClass(chapter)}`}
                aria-hidden="true"
              />
              <div className="container relative z-10 mx-auto lg:px-8 xl:px-12">
                <PlanetStoryNarrative
                  chapter={chapter}
                  isActive={storyState.activeIndex === index}
                  onReveal={handleRevealBirthSky}
                  onHaveChart={() => setShowHaveChartChoice(true)}
                />
              </div>

              {index === 0 ? (
                <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 text-white/50 motion-safe:animate-bounce">
                  <span className="text-xs font-bold uppercase tracking-[0.34em]">
                    Descend
                  </span>
                  <div className="h-8 w-px bg-gradient-to-b from-gold/80 to-transparent" />
                </div>
              ) : null}
            </section>
          ))}
        </div>
      </div>

      <CosmosToSelfStory
        trustSummary={trustSummary}
        onReveal={handleRevealBirthSky}
      />

      <Footer />

      <HaveChartChoice
        isOpen={showHaveChartChoice}
        onClose={() => setShowHaveChartChoice(false)}
        onUpload={handleUploadChart}
        onSignIn={handleSignInFromChoice}
      />

      <OnboardingModal
        isOpen={showOnboardingModal}
        onClose={() => setShowOnboardingModal(false)}
        onComplete={() => navigate("/dashboard")}
        startWithUpload={onboardingStartsWithUpload}
        onSignIn={() => {
          setShowOnboardingModal(false);
          setShowAuthModal(true);
        }}
      />

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={handleLoginSuccess}
        title="Welcome back"
        message={`Sign in to save your chart and get ${SIGNUP_BONUS_CREDITS} free credits.`}
      />
    </div>
  );
}

export default Landing;
