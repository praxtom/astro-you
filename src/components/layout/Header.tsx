import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../../lib/useAuth";
import { useHeaderScroll, useUserProfile } from "../../hooks";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../../lib/firebase";
import {
  ChevronDown,
  Crown,
  Heart,
  HelpCircle,
  LayoutDashboard,
  Flame,
  LogOut,
  Menu,
  ScrollText,
  Settings,
  Sparkles,
  Sun,
  Wallet,
  X,
} from "lucide-react";
import { signOut } from "firebase/auth";
import { STORAGE_KEYS } from "../../lib/constants";
import {
  SPACES,
  getSpaceForPath,
  getSpacePrimaryPath,
  type Space,
} from "../../lib/spaces";

const SPACE_ICONS: Record<Space["id"], typeof Sun> = {
  today: Sun,
  guidance: Sparkles,
  chart: ScrollText,
  bonds: Heart,
  path: Flame,
};

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
    // Clear session-only keys. Keep PROFILE in localStorage as a cache —
    // Firestore is the source of truth and useUserProfile will re-sync on next login.
    sessionStorage.removeItem(STORAGE_KEYS.GUEST_PROFILE);
    sessionStorage.removeItem(STORAGE_KEYS.GUEST_COMPLETE);
    sessionStorage.removeItem(STORAGE_KEYS.MODE);
    sessionStorage.removeItem(STORAGE_KEYS.LOGIN_REDIRECT);
    // Clear non-profile localStorage keys
    localStorage.removeItem(STORAGE_KEYS.FREE_SECONDS);
    navigate("/");
  };

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  // The five spaces, plus home. Money/account pages live in the avatar menu.
  const activeSpace = getSpaceForPath(location.pathname);
  const internalNavItems = [
    {
      label: "Home",
      to: "/dashboard",
      icon: LayoutDashboard,
      active: location.pathname === "/dashboard",
    },
    ...SPACES.map((space) => ({
      label: space.label,
      to: getSpacePrimaryPath(space),
      icon: SPACE_ICONS[space.id],
      active: activeSpace?.id === space.id,
    })),
  ];

  // Close menus when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
    setIsUserMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!userMenuRef.current?.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const displayName =
    profile?.name || user?.displayName || user?.email?.split("@")[0];

  const closeUserMenu = () => setIsUserMenuOpen(false);

  const goToDashboard = async () => {
    if (location.pathname === "/dashboard") return;
    if (!user) return;
    const docSnap = await getDoc(doc(db, "users", user.uid));
    if (docSnap.exists() && docSnap.data().name) {
      navigate("/dashboard");
    } else {
      sessionStorage.setItem(STORAGE_KEYS.MODE, "logged_in");
      onShowOnboarding?.();
    }
  };

  const userMenuItems = [
    {
      label: "Dashboard",
      icon: LayoutDashboard,
      onClick: goToDashboard,
    },
    {
      label: "Wallet",
      icon: Wallet,
      onClick: () => navigate("/wallet"),
    },
    {
      label: "Plans",
      icon: Crown,
      onClick: () => navigate("/pricing"),
      accent: true,
    },
    {
      label: "Support",
      icon: HelpCircle,
      onClick: () => navigate("/support"),
    },
    {
      label: "Settings",
      icon: Settings,
      onClick: () => navigate("/settings"),
    },
  ];

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-[1000] transition-all duration-500 border-b border-transparent ${
          isVisible || isMobileMenuOpen ? "translate-y-0" : "-translate-y-full"
        } ${scrolled ? "header-scrolled" : "py-3"}`}
      >
        <div className="container mx-auto px-4 md:px-6 flex flex-row items-center justify-between">
          <div className="flex items-center gap-4">
            <a
              href="/"
              className="logo group flex items-center gap-3 active:scale-95 transition-transform"
            >
              <div className="relative w-8 h-8 flex items-center justify-center">
                <div className="absolute inset-0 border border-gold/30 rounded-full group-hover:rotate-180 transition-transform duration-1000"></div>
                <div className="w-1.5 h-1.5 bg-gold rounded-full shadow-[0_0_10px_var(--color-gold)]"></div>
              </div>
              <span className="font-display text-xl lg:text-2xl text-content-primary group-hover:text-gold transition-all">
                AstroYou
              </span>
            </a>

            <nav className="hidden lg:flex items-center mt-1 gap-1.5 text-white/70">
              {isInternal ? (
                <>
                  {internalNavItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.to}
                        onClick={() => navigate(item.to)}
                        className={`flex items-center gap-2 rounded-full px-2.5 py-1.5 text-sm font-bold transition-all ${
                          item.active
                            ? "bg-gold/10 text-gold border border-gold/20"
                            : "border border-transparent hover:bg-white/5 hover:text-white"
                        }`}
                      >
                        <Icon size={15} />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </>
              ) : (
                <>
                  <a
                    href="#journey"
                    className="flex items-center gap-2 rounded-full border border-transparent px-2.5 py-1.5 text-sm font-bold transition-all hover:bg-white/5 hover:text-white"
                  >
                    Methodology
                  </a>
                  <a
                    href="#features"
                    className="flex items-center gap-2 rounded-full border border-transparent px-2.5 py-1.5 text-sm font-bold transition-all hover:bg-white/5 hover:text-white"
                  >
                    Insights
                  </a>
                  <a
                    href="/synthesis"
                    className="flex items-center gap-2 rounded-full border border-transparent px-2.5 py-1.5 text-sm font-bold transition-all hover:bg-white/5 hover:text-white"
                  >
                    Readings
                  </a>
                  <a
                    href="/pricing"
                    className="flex items-center gap-2 rounded-full border border-transparent px-2.5 py-1.5 text-sm font-bold transition-all hover:bg-white/5 hover:text-white"
                  >
                    Pricing
                  </a>
                  <a
                    href="/trust"
                    className="flex items-center gap-2 rounded-full border border-transparent px-2.5 py-1.5 text-sm font-bold transition-all hover:bg-white/5 hover:text-white"
                  >
                    Trust
                  </a>
                </>
              )}
            </nav>
          </div>

          <div className="hidden md:flex items-center gap-4">
            {user ? (
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setIsUserMenuOpen((open) => !open)}
                  className={`group flex items-center gap-2 transition-all ${
                    isUserMenuOpen ? "text-white" : "text-gold hover:text-white"
                  }`}
                  aria-expanded={isUserMenuOpen}
                  aria-haspopup="menu"
                >
                  <span
                    className={`transition-transform duration-500 ${
                      isUserMenuOpen
                        ? "scale-125 text-gold"
                        : "text-gold group-hover:scale-125"
                    } drop-shadow-[0_0_8px_rgba(255,215,0,0.3)]`}
                  >
                    ✦
                  </span>
                  <span className="relative max-w-[10rem] truncate font-base text-lg font-bold">
                    {displayName}
                    <span
                      className={`absolute -bottom-1 left-0 h-px bg-gold transition-all duration-500 ${
                        isUserMenuOpen ? "w-full" : "w-0 group-hover:w-full"
                      }`}
                    />
                  </span>
                  <ChevronDown
                    size={14}
                    className={`text-white/30 transition-all duration-300 ${
                      isUserMenuOpen
                        ? "rotate-180 text-gold/70"
                        : "group-hover:text-white/50"
                    }`}
                  />
                </button>

                <AnimatePresence>
                  {isUserMenuOpen && (
                    <motion.div
                      role="menu"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 6 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-[calc(100%+0.5rem)] z-[1002] min-w-[10.5rem] overflow-hidden rounded-xl border border-white/10 bg-[#0a0a0f]/95 py-1 shadow-lg backdrop-blur-xl"
                    >
                      {userMenuItems.map((item) => {
                        const Icon = item.icon;
                        return (
                          <button
                            key={item.label}
                            role="menuitem"
                            onClick={() => {
                              item.onClick();
                              closeUserMenu();
                            }}
                            className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-white/5 ${
                              item.accent
                                ? "text-gold/80 hover:text-gold"
                                : "text-white/65 hover:text-white"
                            }`}
                          >
                            <Icon size={14} />
                            <span>{item.label}</span>
                          </button>
                        );
                      })}
                      <div className="my-1 border-t border-white/8" />
                      <button
                        role="menuitem"
                        onClick={() => {
                          handleLogout();
                          closeUserMenu();
                        }}
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-white/45 transition-colors hover:bg-white/5 hover:text-white/70"
                      >
                        <LogOut size={14} />
                        <span>Sign out</span>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <>
                {isInternal ? (
                  /* Guest Mode in internal pages */
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col items-end">
                      <span className="text-gold font-display text-sm uppercase drop-shadow-[0_0_8px_rgba(255,215,0,0.3)]">
                        ✦ Seeker
                      </span>
                      <span className="text-[10px] uppercase text-gold/40 font-black mt-0.5">
                        Guest Mode
                      </span>
                    </div>
                    <button
                      onClick={() => navigate("/")}
                      className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-white/40 hover:text-white"
                      title="Exit to Landing"
                    >
                      <LogOut size={16} />
                    </button>
                  </div>
                ) : (
                  <button
                    className="px-6 py-2.5 bg-white text-black font-bold! rounded-full hover:bg-gold hover:text-black transition-all active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.15)]"
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
            aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={isMobileMenuOpen}
          >
            {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      <div
        className={`fixed inset-0 z-[999] bg-[#030308]/95 backdrop-blur-3xl transition-all duration-500 flex flex-col items-center justify-center gap-6 ${
          isMobileMenuOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
      >
        <nav className="flex flex-col items-center gap-5 text-xl font-semibold">
          {isInternal ? (
            <>
              {internalNavItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.to}
                    onClick={() => navigate(item.to)}
                    className={`flex items-center gap-3 transition-colors ${
                      item.active ? "text-gold" : "hover:text-gold"
                    }`}
                  >
                    <Icon size={20} />
                    {item.label}
                  </button>
                );
              })}
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
              <a href="/pricing" onClick={() => setIsMobileMenuOpen(false)}>
                Pricing
              </a>
            </>
          )}
        </nav>

        <div className="w-12 h-px bg-white/10"></div>

        <div className="flex flex-col items-center gap-5">
          {user ? (
            <>
              <div className="flex flex-col items-center text-center gap-2">
                <span className="text-gold text-xl font-semibold">
                  {profile?.name || user.displayName || "Seeker"}
                </span>
                <span className="text-xs uppercase text-white/40">
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
                className="px-6 py-2.5 rounded-full bg-gold/10 border border-gold/30 text-gold font-bold uppercase text-xs"
              >
                Go to Dashboard
              </button>

              <button
                onClick={() => {
                  navigate("/wallet");
                  setIsMobileMenuOpen(false);
                }}
                className="flex items-center gap-2 text-white/40 hover:text-white transition-colors"
              >
                <Wallet size={16} />
                <span className="text-sm uppercase">Wallet</span>
              </button>

              <button
                onClick={() => {
                  navigate("/pricing");
                  setIsMobileMenuOpen(false);
                }}
                className="flex items-center gap-2 text-gold/60 hover:text-gold transition-colors"
              >
                <Crown size={16} />
                <span className="text-sm uppercase">Plans</span>
              </button>

              <button
                onClick={() => {
                  navigate("/support");
                  setIsMobileMenuOpen(false);
                }}
                className="flex items-center gap-2 text-white/40 hover:text-white transition-colors"
              >
                <HelpCircle size={16} />
                <span className="text-sm uppercase">Support</span>
              </button>

              <button
                onClick={() => {
                  navigate("/settings");
                  setIsMobileMenuOpen(false);
                }}
                className="flex items-center gap-2 text-white/40 hover:text-white transition-colors"
              >
                <Settings size={16} />
                <span className="text-sm uppercase">Settings</span>
              </button>

              <button
                onClick={() => {
                  handleLogout();
                  setIsMobileMenuOpen(false);
                }}
                className="flex items-center gap-2 text-white/40 hover:text-white transition-colors"
              >
                <LogOut size={16} />
                <span className="text-sm uppercase">Logout</span>
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
                  className="px-6 py-2.5 bg-white/5 border border-white/10 rounded-full text-white/60 hover:text-white transition-all uppercase text-xs font-bold"
                >
                  Exit Guest Mode
                </button>
              ) : (
                <button
                  className="px-6 py-2.5 bg-white text-black font-bold rounded-full hover:bg-gold hover:text-black transition-all shadow-[0_0_20px_rgba(255,255,255,0.15)]"
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
