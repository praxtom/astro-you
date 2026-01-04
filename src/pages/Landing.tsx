import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import CelestialEngine from "../components/CelestialEngine";
import { LandingSEO } from "../components/SEO";

function Landing() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

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
            <a href="#about" className="nav-link">
              Philosophy
            </a>
            <a href="#experience" className="nav-link">
              Experience
            </a>
            <button className="text-caption text-content-secondary hover:text-gold transition-colors font-bold uppercase cursor-pointer bg-transparent border-none tracking-[0.2em]">
              Sign In
            </button>
            <button
              className="btn-premium"
              onClick={() => navigate("/onboarding")}
            >
              Begin Journey
            </button>
          </nav>

          {/* Mobile Menu Toggle (Simplified for design focus) */}
          <button className="md:hidden w-6 h-6 flex flex-col justify-center gap-1.5">
            <div className="w-full h-px bg-content-primary"></div>
            <div className="w-2/3 h-px bg-content-primary self-end"></div>
          </button>
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
              <p className="text-body text-xl mb-14 max-w-2xl text-content-secondary/90 leading-relaxed font-sans font-light">
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
              <span className="footer-title">Platform</span>
              <div className="flex flex-col gap-3">
                <a href="#experience" className="footer-link">
                  Experience
                </a>
                <a href="#" className="footer-link">
                  Technical Kundali
                </a>
                <a href="#" className="footer-link">
                  Sage Synthesis
                </a>
                <a href="#" className="footer-link">
                  Sacred Geometry
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
                Receive celestial transit alerts and soul guidance.
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
          <div className="pt-8 border-t border-white/[0.05] flex flex-col md:flex-row justify-between items-center gap-6 text-caption text-[10px] opacity-50">
            <p>© 2026 AstroYou Intelligence. All rights reserved.</p>
            <div className="flex gap-8 italic">
              <span>Made for the modern seeker.</span>
              <span>Based in Ancient Wisdom.</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Landing;
