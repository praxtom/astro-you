import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../lib/AuthContext";
import { useHeaderScroll, useUserProfile } from "../../hooks";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../../lib/firebase";
import { LogOut, Menu, X } from "lucide-react";
import { signOut } from "firebase/auth";

interface HeaderProps {
  onShowAuth?: () => void;
  onShowOnboarding?: () => void;
}

export default function Header({ onShowAuth, onShowOnboarding }: HeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const { scrolled, isVisible } = useHeaderScroll();

  const isInternal =
    location.pathname !== "/" && location.pathname !== "/landing";

  const handleLogout = async () => {
    await signOut(auth);
    sessionStorage.clear();
    localStorage.clear();
    navigate("/");
  };

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-[1000] transition-all duration-500 border-b border-transparent ${isVisible || isMobileMenuOpen ? "translate-y-0" : "-translate-y-full"
          } ${scrolled ? "header-scrolled" : "py-8"}`}
      >
        <div className="container mx-auto px-6 flex flex-row items-center justify-between">
          <div className="flex items-center gap-8">
            <a
              href="/"
              className="logo group flex items-center gap-3 active:scale-95 transition-transform"
            >
              <div className="relative w-8 h-8 flex items-center justify-center">
                <div className="absolute inset-0 border border-gold/30 rounded-full group-hover:rotate-180 transition-transform duration-1000"></div>
                <div className="w-1.5 h-1.5 bg-gold rounded-full shadow-[0_0_10px_var(--color-gold)]"></div>
              </div>
              <span className="font-display text-xl lg:text-2xl tracking-[0.3em] text-content-primary group-hover:text-gold transition-all">
                AstroYou
              </span>
            </a>

            <nav className="hidden lg:flex items-center text-lg mt-2 gap-8 font-display !font-bold !tracking-wide text-white/70 ">
              {isInternal ? (
                <>
                  <button
                    onClick={() => navigate("/dashboard")}
                    className={`${location.pathname === "/dashboard"
                      ? "text-gold border-b border-gold/50"
                      : "hover:text-white"
                      } pb-1 transition-all`}
                  >
                    Dashboard
                  </button>
                  <button className="hover:text-white transition-colors">
                    Calendar
                  </button>
                  <button className="hover:text-white transition-colors">
                    Library
                  </button>
                </>
              ) : (
                <>
                  <a
                    href="#journey"
                    className="hover:text-white transition-colors pb-1"
                  >
                    Methodology
                  </a>
                  <a
                    href="#features"
                    className="hover:text-white transition-colors pb-1"
                  >
                    Insights
                  </a>
                  <a
                    href="/synthesis"
                    className="hover:text-white transition-colors pb-1"
                  >
                    Readings
                  </a>
                </>
              )}
            </nav>
          </div>

          <div className="hidden md:flex items-center gap-6">
            {user ? (
              <div className="flex items-center gap-6">
                <div className="flex flex-col items-end">
                  <button
                    onClick={async () => {
                      if (location.pathname === "/dashboard") return;
                      const docSnap = await getDoc(doc(db, "users", user.uid));
                      if (docSnap.exists() && docSnap.data().name) {
                        navigate("/dashboard");
                      } else {
                        sessionStorage.setItem("astroyou_mode", "logged_in");
                        onShowOnboarding?.();
                      }
                    }}
                    className="text-gold text-sm tracking-sm hover:text-white transition-all cursor-pointer group flex items-center gap-2 drop-shadow-[0_0_8px_rgba(255,215,0,0.3)]"
                  >
                    <span className="group-hover:scale-125 transition-transform duration-500 text-gold">
                      ✦
                    </span>
                    <span className="relative font-base text-lg font-bold tracking-wide">
                      {profile?.name ||
                        user.displayName ||
                        user.email?.split("@")[0]}
                      <span className="absolute -bottom-1 left-0 w-0 h-px bg-gold transition-all duration-500 group-hover:w-full"></span>
                    </span>
                  </button>
                </div>

                <button
                  onClick={handleLogout}
                  className="p-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-white/40 hover:text-white"
                  title="Logout"
                >
                  <LogOut size={16} />
                </button>
              </div>
            ) : (
              <>
                {isInternal ? (
                  /* Guest Mode in internal pages */
                  <div className="flex items-center gap-6">
                    <div className="flex flex-col items-end">
                      <span className="text-gold font-display text-sm tracking-[0.2em] uppercase drop-shadow-[0_0_8px_rgba(255,215,0,0.3)]">
                        ✦ Seeker
                      </span>
                      <span className="text-[10px] uppercase tracking-widest text-gold/40 font-black mt-0.5">
                        Guest Mode
                      </span>
                    </div>
                    <button
                      onClick={() => navigate("/")}
                      className="p-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-white/40 hover:text-white"
                      title="Exit to Landing"
                    >
                      <LogOut size={16} />
                    </button>
                  </div>
                ) : (
                  <button
                    className="px-8 py-3 bg-white text-black font-display font-bold! rounded-full hover:bg-gold hover:text-black transition-all active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.15)]"
                    onClick={onShowAuth}
                  >
                    Get Started
                  </button>
                )}
              </>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden w-10 h-10 flex items-center justify-center rounded-full bg-white/5 border border-white/10 text-white z-[1001]"
          >
            {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      <div
        className={`fixed inset-0 z-[999] bg-[#030308]/95 backdrop-blur-3xl transition-all duration-500 flex flex-col items-center justify-center gap-8 ${isMobileMenuOpen
          ? "opacity-100 pointer-events-auto"
          : "opacity-0 pointer-events-none"
          }`}
      >
        <nav className="flex flex-col items-center gap-6 font-display text-2xl">
          {isInternal ? (
            <>
              <button
                onClick={() => navigate("/dashboard")}
                className="hover:text-gold transition-colors"
              >
                Dashboard
              </button>
              <button className="hover:text-gold transition-colors">
                Calendar
              </button>
              <button className="hover:text-gold transition-colors">
                Library
              </button>
            </>
          ) : (
            <>
              <a href="#journey" onClick={() => setIsMobileMenuOpen(false)}>
                Methodology
              </a>
              <a href="#features" onClick={() => setIsMobileMenuOpen(false)}>
                Insights
              </a>
              <a href="/synthesis" onClick={() => setIsMobileMenuOpen(false)}>
                Readings
              </a>
            </>
          )}
        </nav>

        <div className="w-12 h-px bg-white/10"></div>

        <div className="flex flex-col items-center gap-6">
          {user ? (
            <>
              <div className="flex flex-col items-center text-center gap-2">
                <span className="text-gold font-display text-xl tracking-wide">
                  {profile?.name || user.displayName || "Seeker"}
                </span>
                <span className="text-xs uppercase tracking-[0.2em] text-white/40">
                  Currently Logged In
                </span>
              </div>

              <button
                onClick={async () => {
                  if (location.pathname !== "/dashboard") {
                    navigate("/dashboard");
                  }
                  setIsMobileMenuOpen(false);
                }}
                className="px-8 py-3 rounded-full bg-gold/10 border border-gold/30 text-gold font-bold tracking-widest uppercase text-xs"
              >
                Go to Dashboard
              </button>

              <button
                onClick={() => {
                  handleLogout();
                  setIsMobileMenuOpen(false);
                }}
                className="flex items-center gap-2 text-white/40 hover:text-white transition-colors"
              >
                <LogOut size={16} />
                <span className="text-sm uppercase tracking-widest">
                  Logout
                </span>
              </button>
            </>
          ) : (
            <>
              {isInternal ? (
                <button
                  onClick={() => {
                    navigate("/");
                    setIsMobileMenuOpen(false);
                  }}
                  className="px-8 py-3 bg-white/5 border border-white/10 rounded-full text-white/60 hover:text-white transition-all uppercase tracking-widest text-xs font-bold"
                >
                  Exit Guest Mode
                </button>
              ) : (
                <button
                  className="px-8 py-3 bg-white text-black font-display font-bold rounded-full hover:bg-gold hover:text-black transition-all shadow-[0_0_20px_rgba(255,255,255,0.15)]"
                  onClick={() => {
                    onShowAuth?.();
                    setIsMobileMenuOpen(false);
                  }}
                >
                  Get Started
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
