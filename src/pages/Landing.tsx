import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import CelestialEngine from "../components/CelestialEngine";
import { LandingSEO } from "../components/SEO";
import AuthModal from "../components/AuthModal";
import OnboardingModal from "../components/OnboardingModal";
import { useAuth } from "../lib/AuthContext";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Sparkles, Zap, ChevronDown, ScrollText } from "lucide-react";

interface InfluenceCardProps {
  number: string;
  title: string;
  description: string;
  theme: string;
  isActive: boolean;
  align?: "left" | "right" | "center";
}

const InfluenceCard = ({
  number,
  title,
  description,
  theme,
  isActive,
  align = "left",
}: InfluenceCardProps) => (
  <div
    className={`sticky top-[20%] p-8 md:p-12 rounded-[2rem] border border-white/10 glass/10 transition-all duration-700 transform max-w-xl mx-auto lg:mx-0 ${
      isActive
        ? "opacity-100 scale-100 translate-y-0"
        : "opacity-0 scale-95 translate-y-12"
    } ${
      align === "right"
        ? "lg:ml-auto"
        : align === "center"
        ? "lg:mx-auto"
        : "lg:mr-auto"
    }`}
    style={{ background: `rgba(255, 255, 255, 0.02)` }}
  >
    <div
      className={`w-12 h-12 rounded-full mb-8 flex items-center justify-center border border-white/20 text-sm font-bold ${theme}`}
    >
      {number}
    </div>
    <h3 className="text-3xl md:text-5xl font-display text-glow mb-6 leading-tight">
      {title}
    </h3>
    <p className="text-lg md:text-xl text-content-secondary font-sans font-light leading-relaxed max-w-lg">
      {description}
    </p>

    {/* Decorative cosmic element */}
    <div className="absolute top-8 right-8 w-px h-24 bg-gradient-to-b from-gold/50 to-transparent"></div>
  </div>
);

const FAQItem = ({
  question,
  answer,
}: {
  question: string;
  answer: string;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="border-b border-white/10">
      <button
        className="w-full py-6 flex items-center justify-between text-left group"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="text-lg font-sans text-content-primary group-hover:text-gold transition-colors">
          {question}
        </span>
        <ChevronDown
          className={`text-gold transition-transform duration-300 ${
            isOpen ? "rotate-180" : ""
          }`}
          size={20}
        />
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ${
          isOpen ? "max-h-96 pb-6" : "max-h-0"
        }`}
      >
        <p className="text-content-secondary font-sans leading-relaxed">
          {answer}
        </p>
      </div>
    </div>
  );
};

function Landing() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const stackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);

      // Calculate progress of the scrollytelling stack
      if (stackRef.current) {
        const rect = stackRef.current.getBoundingClientRect();
        const start = rect.top + window.scrollY - window.innerHeight;
        const totalHeight = rect.height;
        const progress = (window.scrollY - start) / totalHeight;
        setScrollProgress(Math.min(Math.max(progress, 0), 1));
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Handle post-login navigation logic
  const handleLoginSuccess = async () => {
    navigate("/dashboard");
  };

  return (
    <div className="landing relative min-h-screen bg-surface-primary transition-colors duration-700">
      <LandingSEO />

      {/* Full-Screen Static Ambiance (Static) */}
      <div className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none">
        <div className="blob top-[-10%] right-[-5%] w-[60vw] h-[60vw] bg-violet/5 animate-float-slow"></div>
        <div
          className="blob bottom-[-10%] left-[-5%] w-[60vw] h-[60vw] bg-indigo/5 animate-float-slow"
          style={{ animationDelay: "-5s" }}
        ></div>
      </div>

      {/* Navigation */}
      <header
        className={`fixed top-0 left-0 right-0 z-[1000] transition-all duration-500 border-b border-transparent ${
          scrolled ? "header-scrolled" : "py-8"
        }`}
      >
        <div className="container mx-auto px-6 flex flex-row items-center justify-between">
          <a
            href="/"
            className="logo group flex items-center gap-3 active:scale-95 transition-transform"
          >
            <div className="relative w-8 h-8 flex items-center justify-center">
              <div className="absolute inset-0 border border-gold/30 rounded-full group-hover:rotate-180 transition-transform duration-1000"></div>
              <div className="w-1.5 h-1.5 bg-gold rounded-full shadow-[0_0_10px_var(--color-gold)]"></div>
            </div>
            <span className="font-display text-xl lg:text-2xl tracking-[0.3em] uppercase text-content-primary group-hover:tracking-[0.35em] transition-all">
              AstroYou
            </span>
          </a>

          <nav className="hidden md:flex items-center gap-10">
            <a href="#journey" className="nav-link">
              Journey
            </a>
            <a href="#features" className="nav-link">
              Features
            </a>
            <a href="#philosophy" className="nav-link">
              Philosophy
            </a>
            {user ? (
              <>
                <span className="text-caption text-gold/60 font-sans text-xs">
                  ✦ {user.displayName || user.email?.split("@")[0]}
                </span>
                <button
                  className="btn-premium"
                  onClick={async () => {
                    const docSnap = await getDoc(doc(db, "users", user.uid));
                    if (docSnap.exists() && docSnap.data().name) {
                      navigate("/dashboard");
                    } else {
                      sessionStorage.setItem("astroyou_mode", "logged_in");
                      setShowOnboardingModal(true);
                    }
                  }}
                >
                  Enter Portal
                </button>
              </>
            ) : (
              <>
                <button
                  className="btn-premium cursor-pointer"
                  onClick={() => setShowAuthModal(true)}
                >
                  Get Started
                </button>
              </>
            )}
          </nav>

          {/* Mobile Menu Toggle (Simplified for design focus) */}
          <button className="md:hidden w-6 h-6 flex flex-col justify-center gap-1.5">
            <div className="w-full h-px bg-content-primary"></div>
            <div className="w-2/3 h-px bg-content-primary self-end"></div>
          </button>
        </div>
      </header>

      {/* Unified Narrative Section: Hero + ScrollyStack */}
      <div className="relative" ref={stackRef}>
        {/* Persistent 3D Background */}
        <div className="sticky top-0 h-screen w-full z-0 overflow-hidden bg-[#030308]">
          <div className="w-full h-full translate-x-[10%]">
            <CelestialEngine progress={scrollProgress} />
          </div>
          {/* Subtle overlay to enhance text readability */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#030308]/60 via-transparent to-transparent"></div>
        </div>

        {/* Content Layers */}
        <div className="relative z-10 -mt-[100vh]">
          {/* 1. Hero Layer */}
          <section className="min-h-[100vh] flex items-center pt-[120px] pb-24 px-6 md:px-12">
            <div className="container mx-auto">
              <div className="max-w-4xl">
                <div className="transition-all duration-1000">
                  <span className="section-label font-black tracking-[0.5em] opacity-80 decoration-gold/50 underline underline-offset-8">
                    Modern Clarity
                  </span>
                  <h1 className="mb-10 text-glow !leading-[1.05] mt-6">
                    The Stars, <br />
                    <span className="italic font-light opacity-80 h-light">
                      revealed.
                    </span>
                  </h1>
                </div>
                <div>
                  <p className="text-body text-xl mb-14 max-w-2xl text-content-secondary/90 leading-relaxed font-sans font-light">
                    AstroYou combines ancient Vedic wisdom with modern precision
                    to deliver accurate personal insights. Your birth chart,
                    instantly calculated.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-6">
                  <button
                    className="btn btn-primary px-12 group"
                    onClick={async () => {
                      if (user) {
                        const docSnap = await getDoc(
                          doc(db, "users", user.uid)
                        );
                        if (docSnap.exists() && docSnap.data().name) {
                          navigate("/dashboard");
                        } else {
                          sessionStorage.setItem("astroyou_mode", "logged_in");
                          setShowOnboardingModal(true);
                        }
                      } else {
                        setShowAuthModal(true);
                      }
                    }}
                  >
                    Get Started
                    <span className="ml-2 group-hover:translate-x-1 transition-transform">
                      →
                    </span>
                  </button>
                  <button
                    className="btn btn-outline px-12"
                    onClick={() => {
                      sessionStorage.setItem("astroyou_mode", "guest");
                      setShowOnboardingModal(true);
                    }}
                  >
                    Try 5 Mins Free
                  </button>
                </div>
              </div>
            </div>

            {/* Scroll Indicator */}
            <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4 opacity-40 animate-bounce">
              <span className="text-[10px] tracking-[0.3em] uppercase">
                Descend
              </span>
              <div className="w-px h-12 bg-gradient-to-b from-gold to-transparent"></div>
            </div>
          </section>

          {/* 2. Influence Stack Layers */}
          <section className="container mx-auto px-6 md:px-12 py-32 space-y-[120vh]">
            <InfluenceCard
              number="01"
              title="Sun (Surya)"
              description="Represents the Atman, the eternal spark of consciousness within you. It signifies your ego, vitality, and natural leadership, determining the strength of your character and overall sense of self-authority."
              theme="text-gold border-gold/20 shadow-[0_0_20px_rgba(197,160,89,0.1)]"
              isActive={scrollProgress > 0.06 && scrollProgress < 0.12}
              align="left"
            />

            <InfluenceCard
              number="02"
              title="Moon (Chandr)"
              description="Represents the Mana, your emotional mind, instincts, and perceptions. It governs your mental peace and happiness, shaping how you feel and respond to the world through the lunar cycles."
              theme="text-indigo-300 border-indigo-500/20 shadow-[0_0_20px_rgba(99,102,241,0.1)]"
              isActive={scrollProgress > 0.12 && scrollProgress < 0.22}
              align="left"
            />

            <InfluenceCard
              number="03"
              title="Mercury (Budh)"
              description="Represents the Budhdhi,clear perception, communication, and commerce. It governs your ability to understand the world, your wit, and the power of speech, bridging the gap between thoughts and reality."
              theme="text-green-400 border-green-500/20 shadow-[0_0_20px_rgba(34,197,94,0.1)]"
              isActive={scrollProgress > 0.22 && scrollProgress < 0.32}
              align="left"
            />

            <InfluenceCard
              number="04"
              title="Venus (Shukr)"
              description="Represents love, beauty, and material comforts. It signifies creativity, aesthetic refinement, and the ability to find joy, providing the balance and harmony that enriches life."
              theme="text-pink-400 border-pink-500/20 shadow-[0_0_20px_rgba(236,72,153,0.1)]"
              isActive={scrollProgress > 0.36 && scrollProgress < 0.44}
              align="left"
            />

            <InfluenceCard
              number="05"
              title="Mars (Mangal)"
              description="Represents physical energy, courage, and determination. Known as the Commander-in-Chief, it fuels your ambition and gives you the capacity to protect and defend what you value most."
              theme="text-red-400 border-red-500/20 shadow-[0_0_20px_rgba(239,68,68,0.1)]"
              isActive={scrollProgress > 0.46 && scrollProgress < 0.52}
              align="left"
            />

            <InfluenceCard
              number="06"
              title="Jupiter (Guru)"
              description="Represents expansion, spirituality, and higher knowledge. As the bringer of light, it signifies luck and grace, governing your belief systems and your capacity for profound growth."
              theme="text-amber-400 border-amber-500/20 shadow-[0_0_20px_rgba(251,191,36,0.1)]"
              isActive={scrollProgress > 0.56 && scrollProgress < 0.64}
              align="left"
            />

            <InfluenceCard
              number="07"
              title="Saturn (Shani)"
              description="Represents time, structure, and the lessons learned through perseverance. As the Lord of Karma, it guides you toward maturity and responsibility through disciplined effort."
              theme="text-slate-400 border-slate-500/20 shadow-[0_0_20px_rgba(100,116,139,0.1)]"
              isActive={scrollProgress > 0.66 && scrollProgress < 0.72}
              align="left"
            />

            <InfluenceCard
              number="08"
              title="North Node (Rahu)"
              description="Represents worldly ambition and unconventional desire. It is the force that pulls you toward the future, compelling you to innovate and break new boundaries."
              theme="text-indigo-400 border-indigo-500/20 shadow-[0_0_20px_rgba(99,102,241,0.1)]"
              isActive={scrollProgress > 0.76 && scrollProgress < 0.84}
              align="left"
            />

            <InfluenceCard
              number="09"
              title="South Node (Ketu)"
              description="Represents spiritual detachment and past-life mastery. It signifies deep intuition and the inherent wisdom that guides the soul toward liberation from material cycles."
              theme="text-violet-400 border-violet-500/20 shadow-[0_0_20px_rgba(139,92,246,0.1)]"
              isActive={scrollProgress > 0.86 && scrollProgress < 0.92}
              align="left"
            />

            <InfluenceCard
              number="10"
              title="The Synthesis"
              description="True astrological wisdom emerges from the delicate balance of all celestial influences. The synthesis of planetary positions and house placements reveals the holistic map of the soul's evolution."
              theme="text-gold border-gold/20 shadow-[0_0_20px_rgba(197,160,89,0.1)]"
              isActive={scrollProgress > 0.93 && scrollProgress < 1}
              align="left"
            />
          </section>

          {/* Spacer to allow stack to finish scroll */}
          <div className="h-[20vh]"></div>
        </div>
      </div>

      {/* Kundali Genesis Section */}
      <section className="py-32 md:py-64 relative overflow-hidden border-t border-white/[0.05]">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60vw] h-[60vw] bg-gold/5 blur-[120px] rounded-full pointer-events-none"></div>

        <div className="container mx-auto px-6 relative z-10">
          <div className="max-w-4xl mx-auto text-center mb-32">
            <span className="section-label mb-6">Celestial Genesis</span>
            <h2 className="text-glow mb-8">
              The Birth of <br />
              <span className="text-gold italic">Your Story</span>
            </h2>
            <p className="text-xl text-content-secondary/80 font-sans font-light max-w-2xl mx-auto">
              A Kundali is more than a map; it is a celestial snapshot of the
              universe at the precise second of your arrival.
            </p>
          </div>

          <div className="relative max-w-5xl mx-auto">
            {/* Connecting Line (Desktop) */}
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-gold/10 to-transparent hidden md:block"></div>

            <div className="space-y-24 md:space-y-48">
              {/* Step 1: The Origin */}
              <div className="relative flex flex-col md:flex-row items-center gap-12 group">
                <div className="flex-1 md:text-right order-2 md:order-1">
                  <h3 className="text-3xl font-display text-white mb-4">
                    The Coordinates of Being
                  </h3>
                  <p className="text-lg text-content-secondary font-sans font-light leading-relaxed">
                    Your birth is defined by a unique intersection of{" "}
                    <span className="text-gold font-bold">
                      Time, Date, and Location
                    </span>
                    . This trinity acts as the anchor for your physical and
                    spiritual identity.
                  </p>
                </div>
                <div className="relative z-10 order-1 md:order-2">
                  <div className="w-24 h-24 rounded-full overflow-hidden border border-gold/20 shadow-[0_0_40px_rgba(197,160,89,0.2)] group-hover:scale-110 transition-transform duration-700">
                    <img
                      src="/assets/landing/coordinates.png"
                      alt="The Origin"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="absolute inset-[-20px] bg-gold/5 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>
                </div>
                <div className="flex-1 hidden md:block order-3"></div>
              </div>

              {/* Step 2: The Alignment */}
              <div className="relative flex flex-col md:flex-row items-center gap-12 group">
                <div className="flex-1 hidden md:block"></div>
                <div className="relative z-10">
                  <div className="w-24 h-24 rounded-full overflow-hidden border border-violet/20 shadow-[0_0_40px_rgba(139,92,246,0.2)] group-hover:scale-110 transition-transform duration-700">
                    <img
                      src="/assets/landing/imprint.png"
                      alt="Planetary Alignment"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="absolute inset-[-20px] bg-violet/5 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>
                </div>
                <div className="flex-1 md:text-left">
                  <h3 className="text-3xl font-display text-white mb-4">
                    The Celestial Imprint
                  </h3>
                  <p className="text-lg text-content-secondary font-sans font-light leading-relaxed">
                    At that exact second, the{" "}
                    <span className="text-gold font-bold">
                      Planetary Alignment
                    </span>{" "}
                    is eternally recorded. This captures the cosmic energy and
                    vibrational frequency of your first breath.
                  </p>
                </div>
              </div>

              {/* Step 3: The Blueprint */}
              <div className="relative flex flex-col md:flex-row items-center gap-12 group">
                <div className="flex-1 md:text-right order-2 md:order-1">
                  <h3 className="text-3xl font-display text-white mb-4">
                    The Living Blueprint
                  </h3>
                  <p className="text-lg text-content-secondary font-sans font-light leading-relaxed">
                    These markings unfold into a dynamic blueprint, defining
                    your{" "}
                    <span className="text-gold font-bold">
                      behavioral patterns, career trajectory, and the deep soul
                      resonance
                    </span>{" "}
                    of your relationships.
                  </p>
                </div>
                <div className="relative z-10 order-1 md:order-2">
                  <div className="w-24 h-24 rounded-full overflow-hidden border border-indigo/20 shadow-[0_0_40px_rgba(99,102,241,0.2)] group-hover:scale-110 transition-transform duration-700">
                    <img
                      src="/assets/landing/blueprint_icon.png"
                      alt="Cosmic Blueprint"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="absolute inset-[-20px] bg-indigo/5 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>
                </div>
                <div className="flex-1 hidden md:block order-3"></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* The Cosmic Journey */}
      <section className="py-32 md:py-48 relative overflow-hidden" id="journey">
        <div className="container mx-auto px-6 relative z-10">
          <div className="text-center mb-24">
            <span className="section-label">Where we come in</span>
            <h2 className="text-glow mb-6 text-4xl md:text-6xl text-white">
              Bridging Ancient Wisdom <br />
              <span className="text-gold italic">& Modern Clarity</span>
            </h2>
            <p className="text-body max-w-2xl mx-auto opacity-70">
              AstroYou acts as your celestial translator, bringing centuries of
              Vedic wisdom into clear focus for your daily life.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 lg:gap-24 items-center">
            {/* Step 1 */}
            <div className="flex flex-col items-center text-center group">
              <div className="w-full aspect-square mb-10 relative overflow-hidden rounded-3xl border border-white/5 bg-white/[0.02]">
                <img
                  src="/assets/landing/alignment.png"
                  alt="Birth Alignment"
                  className="w-full h-full object-cover opacity-60 group-hover:opacity-100 group-hover:scale-105 transition-all duration-1000"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#030308] to-transparent opacity-60"></div>
              </div>
              <h3 className="text-2xl mb-4 font-display text-gold">
                Precision Math
              </h3>
              <p className="text-sm text-content-secondary font-sans leading-relaxed px-6">
                We use the ancient science of the stars to calculate your exact
                planetary positions at the second of your birth, ensuring an
                authentic foundation.
              </p>
            </div>

            {/* Step 2 */}
            <div className="flex flex-col items-center text-center group pt-12 lg:pt-0">
              <div className="w-full aspect-square mb-10 relative overflow-hidden rounded-3xl border border-white/5 bg-white/[0.02]">
                <img
                  src="/assets/landing/synthesis.png"
                  alt="Synthesis"
                  className="w-full h-full object-cover opacity-60 group-hover:opacity-100 group-hover:scale-105 transition-all duration-1000"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#030308] to-transparent opacity-60"></div>
              </div>
              <h3 className="text-2xl mb-4 font-display text-gold">
                Intelligent Synthesis
              </h3>
              <p className="text-sm text-content-secondary font-sans leading-relaxed px-6">
                Jyotish interprets thousands of Dasha combinations and planetary
                aspects to weave a clear, relevant narrative for the modern
                seeker.
              </p>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col items-center text-center group pt-24 lg:pt-0">
              <div className="w-full aspect-square mb-10 relative overflow-hidden rounded-3xl border border-white/5 bg-white/[0.02]">
                <img
                  src="/assets/landing/blueprint.png"
                  alt="Cosmic Blueprint"
                  className="w-full h-full object-cover opacity-60 group-hover:opacity-100 group-hover:scale-105 transition-all duration-1000"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#030308] to-transparent opacity-60"></div>
              </div>
              <h3 className="text-2xl mb-4 font-display text-gold">
                Real-time Guidance
              </h3>
              <p className="text-sm text-content-secondary font-sans leading-relaxed px-6">
                We transform static charts into living documents. Receive
                real-time transit updates and predictions that evolve as you
                move through time.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Advanced Insights Grid */}
      <section
        className="py-32 md:py-48 bg-white/[0.01] border-y border-white/[0.05]"
        id="features"
      >
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-24 items-center">
            <div>
              <span className="section-label">Capabilities</span>
              <h2 className="text-glow mb-8 leading-tight">
                Infinite Depth. <br />
                Instant Access.
              </h2>
              <p className="text-body mb-12 opacity-70">
                Traditional horoscopes are static. AstroYou is dynamic,
                adjusting its guidance as the planets move through the houses of
                your unique chart.
              </p>

              <div className="grid gap-6">
                <div className="group p-6 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] hover:border-gold/20 transition-all duration-500 flex gap-6 items-center">
                  <div className="shrink-0 w-16 h-16 rounded-xl overflow-hidden border border-gold/10 bg-gold/5">
                    <img
                      src="/assets/landing/transits.png"
                      alt="Real-time Transits"
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                    />
                  </div>
                  <div>
                    <h4 className="text-lg font-display text-white mb-2 uppercase tracking-widest group-hover:text-gold transition-colors">
                      Real-time Transits
                    </h4>
                    <p className="text-sm text-content-secondary leading-relaxed opacity-70">
                      Know exactly how today's planetary movements affect your
                      specific lagna and dasha.
                    </p>
                  </div>
                </div>

                <div className="group p-6 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] hover:border-violet/20 transition-all duration-500 flex gap-6 items-center">
                  <div className="shrink-0 w-16 h-16 rounded-xl overflow-hidden border border-violet/10 bg-violet/5">
                    <img
                      src="/assets/landing/remedies.png"
                      alt="Remedial Upaay"
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                    />
                  </div>
                  <div>
                    <h4 className="text-lg font-display text-white mb-2 uppercase tracking-widest group-hover:text-violet transition-colors">
                      Remedial Upaay
                    </h4>
                    <p className="text-sm text-content-secondary leading-relaxed opacity-70">
                      Practical, non-dogmatic actions to balance energy during
                      difficult transits.
                    </p>
                  </div>
                </div>

                <div className="group p-6 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] hover:border-indigo/20 transition-all duration-500 flex gap-6 items-center">
                  <div className="shrink-0 w-16 h-16 rounded-xl overflow-hidden border border-indigo/10 bg-indigo/5">
                    <img
                      src="/assets/landing/precision.png"
                      alt="Celestial Precision"
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                    />
                  </div>
                  <div>
                    <h4 className="text-lg font-display text-white mb-2 uppercase tracking-widest group-hover:text-indigo transition-colors">
                      Celestial Precision
                    </h4>
                    <p className="text-sm text-content-secondary leading-relaxed opacity-70">
                      Deep calculations ensure the highest possible astronomical
                      precision for every movement and placement.
                    </p>
                  </div>
                </div>

                <div className="group p-6 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] hover:border-gold/20 transition-all duration-500 flex gap-6 items-center">
                  <div className="shrink-0 w-16 h-16 rounded-xl overflow-hidden border border-gold/10 bg-gold/5">
                    <img
                      src="/assets/landing/expansion.png"
                      alt="3D Chart Expansion"
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                    />
                  </div>
                  <div>
                    <h4 className="text-lg font-display text-white mb-2 uppercase tracking-widest group-hover:text-gold transition-colors">
                      3D Chart Expansion
                    </h4>
                    <p className="text-sm text-content-secondary leading-relaxed opacity-70">
                      Toggle between 3D Cosmic Circle and Sacred Diamond views
                      to explore your chart in an immersive environment.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative pt-12 lg:pt-0">
              <div className="absolute inset-0 bg-gold/10 blur-[120px] rounded-full animate-pulse-slow"></div>
              <div className="glass p-8 md:p-12 relative z-10 border border-white/10 rounded-[40px] shadow-[0_40px_100px_rgba(0,0,0,0.5)]">
                <div className="space-y-8">
                  <div className="flex items-center justify-between border-b border-white/10 pb-8">
                    <div className="flex items-center gap-5">
                      <div className="w-12 h-12 rounded-full bg-gold/20 flex items-center justify-center text-gold font-bold border border-gold/30">
                        10
                      </div>
                      <div>
                        <p className="text-[10px] text-gold uppercase tracking-[0.3em] font-black mb-1">
                          Current Cycle
                        </p>
                        <p className="text-xl font-display text-white">
                          Shukra-Rahu Dasha
                        </p>
                      </div>
                    </div>
                    <div className="px-4 py-1.5 rounded-full bg-green-500/10 border border-green-500/30 text-[10px] text-green-400 font-bold uppercase tracking-[0.2em] shadow-[0_0_15px_rgba(34,197,94,0.1)]">
                      Active
                    </div>
                  </div>

                  <div className="p-8 rounded-3xl bg-white/5 border border-white/5 relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-1 h-full bg-gold/40"></div>
                    <p className="italic text-base text-content-secondary leading-relaxed font-sans font-light">
                      "This is a period of intense creative expansion. Avoid
                      impulsive financial decisions between now and the next
                      Amavasya."
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] transition-colors">
                      <p className="text-[10px] text-content-tertiary uppercase tracking-[0.3em] mb-2 font-bold">
                        Focus
                      </p>
                      <p className="text-lg font-display text-gold">
                        Career Peak
                      </p>
                    </div>
                    <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] transition-colors">
                      <p className="text-[10px] text-content-tertiary uppercase tracking-[0.3em] mb-2 font-bold">
                        Energy
                      </p>
                      <p className="text-lg font-display text-gold">
                        High Satvic
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Philosophy */}
      <section
        className="py-32 md:py-48 relative border-t border-white/[0.05]"
        id="philosophy"
      >
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto text-center">
            <div className="w-20 h-20 mx-auto mb-12 rounded-full border border-gold/30 flex items-center justify-center p-4">
              <ScrollText className="text-gold" size={32} />
            </div>
            <h2 className="text-glow mb-12">
              Ancient Lineage. <br />
              Modern Mindset.
            </h2>
            <p className="text-xl text-body italic leading-relaxed opacity-90 mb-12 font-display">
              "Astrology is not about predicting the inevitable, but about
              understanding the potential. It is the weather map of the soul."
            </p>
            <div className="h-px w-24 bg-gold/30 mx-auto mb-12"></div>
            <p className="text-body opacity-70 leading-relaxed mb-16">
              Vedic wisdom is the bridge between two worlds. We don't replace
              the insight of the sages; we provide the tools to navigate the
              millions of celestial permutations they once mastered, making deep
              insights accessible to the modern seeker instantly.
            </p>
            <button
              className="btn btn-outline border-gold/20 text-gold hover:bg-gold hover:text-black transition-all"
              onClick={() => setShowAuthModal(true)}
            >
              Learn More About Our Methodology
            </button>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-32 md:py-48 bg-white/[0.01]">
        <div className="container mx-auto px-6 max-w-4xl">
          <div className="text-center mb-24">
            <span className="section-label">Questions</span>
            <h2 className="text-glow mb-6">Clarifying the Cosmic</h2>
          </div>

          <div className="space-y-2">
            <FAQItem
              question="How is Vedic astrology different from Western astrology?"
              answer="Vedic astrology (Jyotish) uses the Sidereal zodiac, which aligns with the actual physical constellations in the sky. It also places heavy emphasis on the Moon and uses an intricate system of Dashas (time-cycles) to predict trends with high precision."
            />
            <FAQItem
              question="Is my personal birth data kept private?"
              answer="Yes. We treat birth data as sacred. Your information is encrypted and never sold. We only use it to generate your unique celestial map within the AstroYou experience."
            />
            <FAQItem
              question="Can Jyotish truly understand a birth chart?"
              answer="Jyotish is incredibly thorough in the 'Math of the Stars', calculating planetary degrees and aspects. We've shaped Jyotish specifically on classic Vedic texts to ensure the interpretation is authentic and grounded in tradition."
            />
            <FAQItem
              question="What if I don't know my exact time of birth?"
              answer="We recommend finding your birth certificate if possible, as it's the most accurate. However, AstroYou can still provide insights based on your date and location, though some house-specific details may be less precise."
            />
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-32 md:py-64 relative overflow-hidden border-t border-white/[0.05]">
        <div className="absolute inset-0 bg-gold/5 blur-[150px] pointer-events-none"></div>
        <div className="container mx-auto px-6 relative z-10 text-center">
          <h2 className="text-5xl md:text-7xl text-glow mb-12 leading-tight">
            Your future is written <br />
            in the stars.
          </h2>
          <p className="text-xl opacity-70 mb-16 max-w-2xl mx-auto font-sans">
            Ready to decode the cosmic blueprint of your life? Join 10,000+
            seekers who trust AstroYou for daily direction.
          </p>
          <div className="flex flex-col sm:flex-row gap-6 justify-center">
            <button
              className="btn btn-primary px-16 group"
              onClick={() => setShowAuthModal(true)}
            >
              Begin Your Journey
              <Sparkles
                className="ml-3 group-hover:rotate-12 transition-transform"
                size={18}
              />
            </button>
          </div>
          <p className="mt-8 text-caption text-[10px] opacity-40">
            No credit card required to start.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="pt-32 pb-16 relative border-t border-white/[0.03] bg-[#030308]">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-16 mb-24">
            {/* Brand Column */}
            <div className="lg:col-span-1">
              <span className="font-display text-2xl tracking-[0.2em] uppercase text-content-primary mb-6 block">
                AstroYou
              </span>
              <p className="text-content-secondary text-sm leading-relaxed max-w-xs mb-8">
                Translating ancient celestial wisdom into precise digital
                insights for the modern seeker.
              </p>
              <div className="flex gap-4">
                <a href="#" className="social-icon">
                  𝕏
                </a>
                <a href="#" className="social-icon">
                  IG
                </a>
                <a href="#" className="social-icon">
                  FB
                </a>
              </div>
            </div>

            {/* Links Columns */}
            <div>
              <span className="footer-title">The Journey</span>
              <div className="flex flex-col gap-3">
                <a href="#journey" className="footer-link">
                  The Journey
                </a>
                <a href="#features" className="footer-link">
                  Features
                </a>
                <a href="#philosophy" className="footer-link">
                  Philosophy
                </a>
                <a href="/synthesis" className="footer-link">
                  Sage Synthesis
                </a>
              </div>
            </div>

            <div>
              <span className="footer-title">Privacy & Legal</span>
              <div className="flex flex-col gap-3">
                <a href="#" className="footer-link">
                  Privacy Policy
                </a>
                <a href="#" className="footer-link">
                  Terms of Service
                </a>
                <a href="#" className="footer-link">
                  Cookie Policy
                </a>
                <a href="#" className="footer-link">
                  Security
                </a>
              </div>
            </div>

            {/* Newsletter Column */}
            <div className="lg:col-span-1">
              <span className="footer-title">Cosmic Updates</span>
              <p className="text-content-secondary text-xs tracking-wider mb-6">
                Receive astrological updates and personal guidance.
              </p>
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="The stars await..."
                  className="cosmic-input"
                />
                <button className="bg-gold text-black px-4 py-2 text-xs font-bold uppercase transition-all hover:bg-[#dfc28c]">
                  Join
                </button>
              </div>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="pt-8 border-t border-white/[0.05] flex flex-col md:flex-row justify-between items-center gap-6 text-caption text-xs opacity-50">
            <p>© 2026 AstroYou. All rights reserved.</p>
            <div className="flex gap-8 italic">
              <span>Made for the modern seeker.</span>
              <span>Based in Ancient Wisdom.</span>
            </div>
          </div>
        </div>
      </footer>

      <OnboardingModal
        isOpen={showOnboardingModal}
        onClose={() => setShowOnboardingModal(false)}
        onComplete={() => navigate("/dashboard")}
      />

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={handleLoginSuccess}
        message="Sign in to save your profile and unlock unlimited insights."
      />
    </div>
  );
}

export default Landing;
