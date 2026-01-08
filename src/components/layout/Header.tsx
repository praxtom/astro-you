import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../lib/AuthContext";
import { useHeaderScroll, useUserProfile } from "../../hooks";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../../lib/firebase";
import { LogOut } from "lucide-react";
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

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-[1000] transition-all duration-500 border-b border-transparent ${
        isVisible ? "translate-y-0" : "-translate-y-full"
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
                  className={`${
                    location.pathname === "/dashboard"
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
                  className="px-8 py-3 bg-white text-black font-display font-bold rounded-full hover:bg-gold hover:text-black transition-all active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.15)]"
                  onClick={onShowAuth}
                >
                  Get Started
                </button>
              )}
            </>
          )}
        </div>

        {/* Mobile Menu Toggle (Simplified for design focus) */}
        <button className="md:hidden w-6 h-6 flex flex-col justify-center gap-1.5">
          <div className="w-full h-px bg-content-primary"></div>
          <div className="w-2/3 h-px bg-content-primary self-end"></div>
        </button>
      </div>
    </header>
  );
}
