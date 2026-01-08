import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { useUserProfile } from "../hooks";
import {
  MessageSquare,
  Sun,
  Heart,
  History,
  Compass,
  FileText,
  ChevronRight,
  Crown,
  Settings,
  ArrowUpRight,
} from "lucide-react";
import OnboardingModal from "../components/OnboardingModal";
import Header from "../components/layout/Header";
import type { FeatureCardProps } from "../types";

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
    className={`group relative overflow-hidden glass p-6 text-left transition-all duration-500 hover:scale-[1.02] active:scale-[0.98] ${
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
        {status && (
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
        )}
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

  // also check for guest mode in sessionStorage
  const [guestData, setGuestData] = useState<any>(null);
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [prediction, setPrediction] = useState<string | null>(null);
  const [isPredictionLoading, setIsPredictionLoading] = useState(false);

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

  const getZodiacSign = (day: number, month: number) => {
    const signs = [
      "Capricorn",
      "Aquarius",
      "Pisces",
      "Aries",
      "Taurus",
      "Gemini",
      "Cancer",
      "Leo",
      "Virgo",
      "Libra",
      "Scorpio",
      "Sagittarius",
    ];
    const boundaries = [20, 19, 21, 20, 21, 21, 23, 23, 23, 23, 22, 22];
    return day < boundaries[month - 1] ? signs[month - 1] : signs[month % 12];
  };

  useEffect(() => {
    const fetchPrediction = async () => {
      if (!userData || !userData.dob || prediction || isPredictionLoading)
        return;

      setIsPredictionLoading(true);
      try {
        const [year, month, day] = userData.dob.split("-").map(Number);
        const [hour, minute] = (userData.tob || "12:00").split(":").map(Number);

        // Simple extraction for city/country from pob "City, Country"
        const pobParts = (userData.pob || "Unknown")
          .split(",")
          .map((s: string) => s.trim());
        const city = pobParts[0] || "Unknown";
        const countryCode = pobParts[1]?.substring(0, 2).toUpperCase() || "US";

        const zodiacSign = userData.sunSign || getZodiacSign(day, month);

        const url = "/.netlify/functions/daily-prediction";
        const body = {
          sign: zodiacSign,
          format: "short",
          subject: {
            name: userData.name || "Seeker",
            birth_data: {
              year,
              month,
              day,
              hour,
              minute,
              city,
              country_code: countryCode === "KA" ? "IN" : countryCode,
            },
          },
          options: {
            house_system: "P",
            zodiac_type: "Tropic",
            active_points: [
              "Sun",
              "Moon",
              "Mercury",
              "Venus",
              "Mars",
              "Jupiter",
              "Saturn",
            ],
            precision: 2,
          },
        };

        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        const result = await response.json();
        if (result.success && result.data?.text) {
          setPrediction(result.data.text);
        }
      } catch (err) {
        console.error("Failed to fetch prediction:", err);
      } finally {
        setIsPredictionLoading(false);
      }
    };

    fetchPrediction();
  }, [userData]);

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
        "Chat with your personal thought partner powered by Vedic wisdom and modern psychology.",
      icon: <MessageSquare size={24} />,
      status: null,
      accentColor: "rgba(255, 215, 0, 0.8)", // Gold
      onClick: () => navigate("/synthesis"),
    },
    {
      title: "Daily Forecast",
      description:
        "Personalized transit insights based on your Moon sign and ongoing dashas.",
      icon: <Sun size={24} />,
      status: null,
      accentColor: "rgba(245, 158, 11, 0.8)", // Amber
      onClick: () => navigate("/forecast"),
    },
    {
      title: "Transit Oracle",
      description:
        "Real-time planetary movement visualization over your birth houses.",
      icon: <Compass size={24} />,
      status: null,
      accentColor: "rgba(59, 130, 246, 0.8)", // Blue
      onClick: () => navigate("/transit"),
    },
    {
      title: "Compatibility Analysis",
      description:
        "Analyze Guna Milan and synastry between two birth charts for deep understanding.",
      icon: <Heart size={24} />,
      status: null,
      accentColor: "rgba(239, 68, 68, 0.8)", // Red
      onClick: () => navigate("/compatibility"),
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

      <Header onShowOnboarding={() => setShowOnboardingModal(true)} />

      <main className="container mx-auto pt-24 px-6 py-12 relative z-10">
        {/* Welcome Banner */}
        <section className="mb-20">
          <div className="relative glass p-6 md:p-10 overflow-hidden rounded-[2rem] border-white/10">
            {/* Ornament */}
            <div className="absolute top-0 right-0 p-8 text-gold/10">
              <Crown size={60} strokeWidth={0.5} />
            </div>

            <div className="relative z-10 max-w-5xl">
              <h2 className="text-4xl md:text-5xl font-display leading-tight mb-4">
                Welcome,{" "}
                <span className="text-gold italic font-base">
                  {userData?.profile?.name || userData?.name || "Seeker"}
                </span>
              </h2>
              {isPredictionLoading ? (
                <div className="space-y-3 mb-10 max-w-2xl">
                  <div className="h-4 bg-white/5 rounded-full animate-pulse w-full"></div>
                  <div className="h-4 bg-white/5 rounded-full animate-pulse w-5/6"></div>
                  <div className="h-4 bg-white/5 rounded-full animate-pulse w-4/6"></div>
                </div>
              ) : (
                <p className="text-2xl text-white/90 font-display !leading-tight !font-semibold !tracking-tight italic mb-2 font-sans mb-6">
                  {prediction ||
                    "The cosmic tides are currently shifting. The stars are aligning to bring you unique insights today."}
                  {prediction && (
                    <button
                      onClick={() => navigate("/forecast")}
                      className="ml-2 text-gold hover:text-white transition-colors inline-flex items-center gap-1 group whitespace-nowrap"
                    >
                      View full forecast{" "}
                      <ArrowUpRight
                        size={14}
                        className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform"
                      />
                    </button>
                  )}
                </p>
              )}

              <div className="flex flex-wrap gap-8">
                <button
                  onClick={() => setShowOnboardingModal(true)}
                  className="p-4 rounded-3xl border border-white/5 bg-white/[0.02] flex items-center gap-4 hover:border-gold/30 hover:bg-gold/5 transition-all group/btn"
                >
                  <div className="h-10 w-10 rounded-2xl bg-white/5 flex items-center justify-center text-white/40 group-hover/btn:bg-gold/10 group-hover/btn:text-gold transition-colors">
                    <Settings size={18} />
                  </div>
                  <div className="text-sm font-medium">Update Birth Data</div>
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
