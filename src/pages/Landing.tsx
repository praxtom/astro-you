import { useNavigate } from "react-router-dom";
import CelestialEngine from "../components/CelestialEngine";

function Landing() {
  const navigate = useNavigate();
  return (
    <div className="landing relative min-h-screen bg-surface-primary transition-colors duration-700">
      {/* Full-Screen Static Ambiance (Static) */}
      <div className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none">
        <div className="blob top-[-10%] right-[-5%] w-[60vw] h-[60vw] bg-violet/5"></div>
        <div className="blob bottom-[-10%] left-[-5%] w-[60vw] h-[60vw] bg-indigo/5"></div>
      </div>

      {/* Navigation */}
      <header className="fixed top-0 left-0 right-0 z-[1000] py-8 border-b border-white/[0.03] bg-surface-primary/80 backdrop-blur-md">
        <div className="container mx-auto px-6 flex flex-row items-center justify-between">
          <a href="/" className="logo group flex items-center gap-3">
            <span className="font-display text-2xl lg:text-3xl tracking-[0.2em] uppercase text-content-primary">
              AstroYou
            </span>
          </a>
          <nav className="hidden md:flex items-center gap-12">
            <a
              href="#about"
              className="section-label mb-0 hover:text-content-primary transition-colors cursor-pointer text-caption"
            >
              Philosophy
            </a>
            <a
              href="#experience"
              className="section-label mb-0 hover:text-content-primary transition-colors cursor-pointer text-caption"
            >
              Experience
            </a>
            <button className="text-caption hover:text-gold transition-colors font-bold uppercase cursor-pointer bg-transparent border-none">
              Sign In
            </button>
            <button
              className="btn btn-primary"
              onClick={() => navigate("/onboarding")}
            >
              Begin Journey
            </button>
          </nav>
        </div>
      </header>

      {/* Hero Section - The ONLY Animated Section */}
      <section className="relative min-h-[90vh] lg:min-h-screen flex items-center pt-[120px] pb-24 overflow-hidden bg-[#030308]">
        {/* Cinematic 3D Engine - Hero Exclusive Animation */}
        <div className="absolute inset-0 z-0 opacity-80 pointer-events-none">
          <CelestialEngine />
        </div>

        <div className="container mx-auto px-6 relative z-10">
          <div className="max-w-4xl">
            <div className="transition-all duration-1000">
              <span className="section-label font-black tracking-[0.5em] opacity-80">
                Celestial Intelligence
              </span>
              <h1 className="mb-10 text-glow !leading-[1.05]">
                The Stars, <br />
                <span className="italic font-light opacity-80 h-light">
                  reinterpreted.
                </span>
              </h1>
            </div>
            <div>
              <p className="text-body text-xl md:text-2xl mb-14 max-w-2xl text-content-secondary/90 leading-relaxed font-sans font-light">
                AstroYou combines ancient Vedic wisdom with modern precision to
                deliver profoundly accurate personal insights. Your cosmic
                blueprint, instantly calculated.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-6">
              <button
                className="btn btn-primary px-12 group"
                onClick={() => navigate("/onboarding")}
              >
                Map Your Destiny
                <span className="ml-2 group-hover:translate-x-1 transition-transform">
                  →
                </span>
              </button>
              <button
                className="btn btn-outline px-12"
                onClick={() => navigate("/synthesis")}
              >
                Explore the Voice
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Experience - Static Content */}
      <section
        className="py-32 md:py-48 relative border-t border-white/[0.05]"
        id="experience"
      >
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 lg:gap-16">
            <div className="experience-card glass p-10 md:p-14 flex flex-col gap-8 group hover:border-gold/30 hover:scale-[1.01] transition-all">
              <span className="font-display text-2xl text-gold opacity-30 group-hover:opacity-100 transition-opacity">
                01
              </span>
              <h3 className="text-title !text-3xl">Technical Kundali</h3>
              <p className="text-body">
                Advanced calculations map your planetary coordinates with
                astronomical accuracy to build your authentic Vedic birth chart.
              </p>
            </div>
            <div className="experience-card glass p-10 md:p-14 flex flex-col gap-8 group hover:border-gold/30 hover:scale-[1.01] transition-all bg-surface-accent/30">
              <span className="font-display text-2xl text-gold opacity-30 group-hover:opacity-100 transition-opacity">
                02
              </span>
              <h3 className="text-title !text-3xl">Sage Synthesis</h3>
              <p className="text-body">
                Meaning beyond data. Our interpretation layer translates complex
                planetary transits into clear, actionable life guidance.
              </p>
            </div>
            <div className="experience-card glass p-10 md:p-14 flex flex-col gap-8 group hover:border-gold/30 hover:scale-[1.01] transition-all">
              <span className="font-display text-2xl text-gold opacity-30 group-hover:opacity-100 transition-opacity">
                03
              </span>
              <h3 className="text-title !text-3xl">Sacred Geometry</h3>
              <p className="text-body">
                See your trajectory through beautiful, geometric chart
                visualizations designed for the modern spiritual seeker.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-24 border-t border-stroke-subtle">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <span className="font-display text-xl tracking-[0.2em] uppercase text-content-primary">
              AstroYou
            </span>
            <div className="flex gap-12 text-caption">
              <a href="#" className="hover:text-gold transition-colors">
                Privacy
              </a>
              <a href="#" className="hover:text-gold transition-colors">
                Terms
              </a>
            </div>
            <p className="text-caption">© 2026. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Landing;
