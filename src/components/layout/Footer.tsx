export default function Footer() {
  return (
    <footer className="pt-32 pb-16 relative border-t border-white/[0.03] bg-[#030308]">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-16 mb-24">
          {/* Brand Column */}
          <div className="lg:col-span-1">
            <span className="font-display text-2xl tracking-[0.2em] uppercase text-content-primary mb-6 block">
              AstroYou
            </span>
            <p className="text-content-secondary text-sm leading-relaxed max-w-xs mb-8">
              Translating ancient celestial wisdom into precise digital insights
              for the modern seeker.
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
  );
}
