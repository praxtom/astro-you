import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { useUserProfile, useHeaderScroll } from "../hooks";
import {
  MessageSquare,
  Map as MapIcon,
  Sun,
  Heart,
  History,
  Compass,
  FileText,
  ChevronRight,
  TrendingUp,
  Clock,
  LogOut,
  Crown,
  Settings,
} from "lucide-react";
import { auth } from "../lib/firebase";
import { signOut } from "firebase/auth";
import OnboardingModal from "../components/OnboardingModal";

interface FeatureCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  status: "Active" | "Beta" | "Coming Soon";
  onClick?: () => void;
  accentColor: string;
}

const FeatureCard = ({
  title,
  description,
  icon,
  status,
  onClick,
  accentColor,
}: FeatureCardProps) => (
  <button
    onClick={status === "Coming Soon" ? undefined : onClick}
    className={`group relative overflow-hidden glass p-8 text-left transition-all duration-500 hover:scale-[1.02] active:scale-[0.98] ${
      status === "Coming Soon"
        ? "opacity-60 cursor-default"
        : "cursor-pointer hover:border-white/20"
    }`}
  >
    {/* Hover Glow Effect */}
    <div
      className="absolute -inset-20 opacity-0 group-hover:opacity-20 transition-opacity duration-700 pointer-events-none"
      style={{
        background: `radial-gradient(circle, ${accentColor} 0%, transparent 70%)`,
      }}
    />

    <div className="relative z-10">
      <div className="flex justify-between items-start mb-6">
        <div
          className="p-3 rounded-2xl bg-white/5 border border-white/10 group-hover:border-white/20 transition-colors"
          style={{ color: accentColor }}
        >
          {icon}
        </div>
        <span
          className={`text-xs font-bold uppercase tracking-[0.2em] px-3 py-1 rounded-full border ${
            status === "Active"
              ? "bg-gold/10 border-gold/30 text-gold"
              : status === "Beta"
              ? "bg-violet-500/10 border-violet-500/30 text-violet-400"
              : "bg-white/5 border-white/10 text-white/40"
          }`}
        >
          {status}
        </span>
      </div>

      <h3 className="text-xl font-display tracking-wider text-white mb-3 group-hover:text-gold transition-colors">
        {title}
      </h3>
      <p className="text-sm text-white/50 leading-relaxed font-sans font-light">
        {description}
      </p>

      {status !== "Coming Soon" && (
        <div className="mt-8 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gold opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          Enter Now <ChevronRight size={14} />
        </div>
      )}
    </div>
  </button>
);

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Use centralized hook for profile data
  const { profile, loading: isLoading } = useUserProfile();
  const { isVisible, scrolled } = useHeaderScroll();

  // Also check for guest mode in sessionStorage
  const [guestData, setGuestData] = useState<any>(null);
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);

  useEffect(() => {
    if (!user && !isLoading) {
      const storedGuestData = sessionStorage.getItem("astroyou_guest_profile");
      if (storedGuestData) {
        setGuestData(JSON.parse(storedGuestData));
      } else {
        navigate("/");
      }
    }
  }, [user, isLoading, navigate]);

  // Combined userData from hook or guest storage
  const userData = profile || guestData;

  const handleLogout = async () => {
    await signOut(auth);
    sessionStorage.clear();
    localStorage.clear();
    navigate("/");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#030308] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gold"></div>
      </div>
    );
  }

  const features: FeatureCardProps[] = [
    {
      title: "Synthesis",
      description:
        "Chat with your personal AI thought partner powered by Vedic wisdom and modern psychology.",
      icon: <MessageSquare size={24} />,
      status: "Active",
      accentColor: "rgba(255, 215, 0, 0.8)", // Gold
      onClick: () => navigate("/synthesis"),
    },
    {
      title: "Natal Kundali",
      description:
        "Explore your authentic North Indian style birth chart with detailed planetary mapping.",
      icon: <MapIcon size={24} />,
      status: "Active",
      accentColor: "rgba(139, 92, 246, 0.8)", // Violet
      onClick: () => navigate("/synthesis"), // Both lead to synthesis for now
    },
    {
      title: "Daily Forecast",
      description:
        "Personalized transit insights based on your Moon sign and ongoing dashas.",
      icon: <Sun size={24} />,
      status: "Beta",
      accentColor: "rgba(245, 158, 11, 0.8)", // Amber
    },
    {
      title: "Compatibility Analysis",
      description:
        "Analyze Guna Milan and synastry between two birth charts for deep understanding.",
      icon: <Heart size={24} />,
      status: "Coming Soon",
      accentColor: "rgba(239, 68, 68, 0.8)", // Red
    },
    {
      title: "Dasha Timeline",
      description:
        "Track your Mahadasha and Antardasha periods to understand current life themes.",
      icon: <History size={24} />,
      status: "Coming Soon",
      accentColor: "rgba(16, 185, 129, 0.8)", // Emerald
    },
    {
      title: "Transit Oracle",
      description:
        "Real-time planetary movement visualization over your birth houses.",
      icon: <Compass size={24} />,
      status: "Coming Soon",
      accentColor: "rgba(59, 130, 246, 0.8)", // Blue
    },
    {
      title: "Life Reports",
      description:
        "Comprehensive 50+ page PDF analysis of your entire astrological identity.",
      icon: <FileText size={24} />,
      status: "Coming Soon",
      accentColor: "rgba(236, 72, 153, 0.8)", // Pink
    },
  ];

  return (
    <div className="min-h-screen bg-[#030308] text-white selection:bg-gold/30">
      {/* Background Ambiance */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-0 w-[50vw] h-[50vw] bg-violet-600/5 blur-[120px] rounded-full animate-pulse" />
        <div
          className="absolute bottom-0 left-0 w-[50vw] h-[50vw] bg-gold/5 blur-[120px] rounded-full animate-pulse"
          style={{ animationDelay: "2s" }}
        />
      </div>

      {/* Header */}
      <header
        className={`fixed top-0 left-0 right-0 z-[1000] transition-all duration-700 ease-in-out ${
          isVisible ? "translate-y-0" : "-translate-y-full"
        } ${
          scrolled
            ? "bg-black/40 backdrop-blur-xl border-b border-white/5 py-3"
            : "py-6"
        }`}
      >
        <div className="container mx-auto px-6 flex flex-row items-center justify-between">
          <div className="flex items-center gap-8">
            <a href="/" className="logo flex items-center gap-3 group">
              <div className="relative w-8 h-8 flex items-center justify-center">
                <div className="absolute inset-0 border border-gold/30 rounded-full animate-spin-slow group-hover:scale-110 transition-transform"></div>
                <div className="w-1.5 h-1.5 bg-gold rounded-full"></div>
              </div>
              <span className="font-display text-lg tracking-[0.4em] uppercase text-white/90 group-hover:text-gold transition-colors">
                AstroYou
              </span>
            </a>

            <nav className="hidden lg:flex items-center gap-8 text-xs font-black  tracking-[0.3em] text-white/40">
              <span className="text-gold border-b border-gold/50 pb-1 cursor-default">
                Dashboard
              </span>
              <button className="hover:text-white transition-colors">
                Calendar
              </button>
              <button className="hover:text-white transition-colors">
                Library
              </button>
            </nav>
          </div>

          <div className="flex items-center gap-6">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-xs font-bold text-white/90">
                {userData?.profile?.name || userData?.name || "Seeker"}
              </span>
              <span className="text-[10px] uppercase tracking-widest text-gold/60 font-black">
                {user ? "Premium Member" : "Guest Mode"}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="p-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-white/40 hover:text-white"
              title="Logout"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto pt-24 px-6 py-12 relative z-10">
        {/* Welcome Banner */}
        <section className="mb-20">
          <div className="relative glass p-10 md:p-14 overflow-hidden rounded-[2rem] border-white/10">
            {/* Ornament */}
            <div className="absolute top-0 right-0 p-8 text-gold/10">
              <Crown size={120} strokeWidth={0.5} />
            </div>

            <div className="relative z-10 max-w-2xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-px w-8 bg-gold/50"></div>
                <span className="text-xs font-bold uppercase tracking-[0.4em] text-gold">
                  Personal Dashboard
                </span>
              </div>
              <h2 className="text-4xl md:text-5xl font-display leading-tight mb-6">
                Welcome, <br />
                <span className="text-gold italic font-light">
                  {userData?.profile?.name || userData?.name || "Seeker"}
                </span>
                .
              </h2>
              <p className="text-body text-white/60 mb-10 leading-relaxed font-sans max-w-xl">
                The cosmic tides are currently shifting. The Moon resides in
                <span className="text-white font-medium">
                  {" "}
                  Chitra Nakshatra
                </span>
                , blessing today with architectural precision and creative
                clarity.
              </p>

              <div className="flex flex-wrap gap-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center text-gold">
                    <TrendingUp size={18} />
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-widest text-white/40">
                      Daily Vibe
                    </div>
                    <div className="text-sm font-medium">Radiant Mastery</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-violet-500/10 border border-violet-500/30 flex items-center justify-center text-violet-400">
                    <Clock size={18} />
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-widest text-white/40">
                      Vedic Insights
                    </div>
                    <div className="text-sm font-medium">Coming Soon</div>
                  </div>
                </div>

                <button className="p-4 rounded-3xl border border-white/5 bg-white/[0.02] flex items-center gap-4 hover:border-gold/30 hover:bg-gold/5 transition-all group/btn">
                  <div className="h-10 w-10 rounded-2xl bg-white/5 flex items-center justify-center text-white/40 group-hover/btn:bg-gold/10 group-hover/btn:text-gold transition-colors">
                    <Settings size={18} />
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-widest text-white/40 group-hover/btn:text-gold/60">
                      Settings
                    </div>
                    <div className="text-sm font-medium">Update Birth Data</div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section>
          <div className="flex justify-between items-end mb-12">
            <div>
              <h3 className="text-2xl font-display tracking-wider mb-2">
                Services
              </h3>
              <p className="text-white/40 text-sm font-sans font-light italic">
                Explore personalized astrological insights.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, idx) => (
              <FeatureCard key={idx} {...feature} />
            ))}
          </div>
        </section>
      </main>

      <footer className="container mx-auto px-6 py-20 border-t border-white/5 opacity-30 text-xs uppercase tracking-[0.3em] flex justify-between">
        <span>Coords: 28.6139° N, 77.2090° E</span>
      </footer>

      <OnboardingModal
        isOpen={showOnboardingModal}
        onClose={() => setShowOnboardingModal(false)}
        onComplete={() => {
          if (!user) {
            const stored = sessionStorage.getItem("astroyou_guest_profile");
            if (stored) setGuestData(JSON.parse(stored));
          }
        }}
      />
    </div>
  );
}
