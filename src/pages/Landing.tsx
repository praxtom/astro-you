import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { LandingSEO } from "../components/SEO";
import AuthModal from "../components/AuthModal";
import OnboardingModal from "../components/OnboardingModal";
import SectionErrorBoundary from "../components/SectionErrorBoundary";
import CosmosToSelfStory, {
  type LandingTrustSummary,
} from "../components/landing/CosmosToSelfStory";
import Header from "../components/layout/Header";
import Footer from "../components/layout/Footer";
import { useAuth } from "../lib/useAuth";
import { auth, db } from "../lib/firebase";
import { STORAGE_KEYS } from "../lib/constants";
import { captureReferralFromUrl } from "../lib/acquisition";
import {
  getPlanetStoryState,
  PLANET_STORY_CHAPTERS,
  type PlanetStoryChapter,
} from "../lib/landing-planet-story";

const CelestialEngine = lazy(() => import("../components/CelestialEngine"));

function PlanetStoryNarrative({
  chapter,
  isActive,
  onReveal,
  onSignIn,
}: {
  chapter: PlanetStoryChapter;
  isActive: boolean;
  onReveal: () => void;
  onSignIn: () => void;
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
          className="text-[10px] font-black uppercase tracking-[0.38em] sm:text-xs"
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
              <span className="font-display text-sm italic text-white/48">
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
        <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-white/42">
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
          <button className="btn btn-primary group px-8" onClick={onReveal}>
            Reveal my birth sky
            <span className="ml-2 transition-transform group-hover:translate-x-1">
              →
            </span>
          </button>
          {isOpening ? (
            <button
              className="btn border-0 bg-transparent px-8 text-white/70 underline decoration-white/20 underline-offset-8 hover:text-white"
              onClick={onSignIn}
            >
              I already have a chart
            </button>
          ) : null}
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

function Landing() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
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

  const handleLoginSuccess = async () => {
    const currentUser = auth.currentUser || user;
    if (currentUser) {
      const docSnap = await getDoc(doc(db, "users", currentUser.uid));
      if (docSnap.exists() && docSnap.data().name) {
        navigate("/dashboard");
      } else {
        sessionStorage.setItem(STORAGE_KEYS.MODE, "logged_in");
        setShowOnboardingModal(true);
      }
    } else {
      navigate("/dashboard");
    }
  };

  const handleRevealBirthSky = async () => {
    if (user) {
      const docSnap = await getDoc(doc(db, "users", user.uid));
      if (docSnap.exists() && docSnap.data().name) {
        navigate("/dashboard");
        return;
      }

      sessionStorage.setItem(STORAGE_KEYS.MODE, "logged_in");
      setShowOnboardingModal(true);
      return;
    }

    sessionStorage.setItem(STORAGE_KEYS.MODE, "guest");
    setShowOnboardingModal(true);
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
        onShowOnboarding={() => setShowOnboardingModal(true)}
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
                  onSignIn={() => setShowAuthModal(true)}
                />
              </div>

              {index === 0 ? (
                <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 text-white/35 motion-safe:animate-bounce">
                  <span className="text-[9px] font-bold uppercase tracking-[0.34em]">
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

      <OnboardingModal
        isOpen={showOnboardingModal}
        onClose={() => setShowOnboardingModal(false)}
        onComplete={() => navigate("/dashboard")}
      />

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={handleLoginSuccess}
        title="Secure Access"
        message="Sign in to save your profile and unlock unlimited insights."
      />
    </div>
  );
}

export default Landing;
