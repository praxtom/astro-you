import { useState, useEffect } from "react";
import { postJson } from "../lib/apiFetch";
import { useNavigate } from "react-router-dom";
import { Hash, Sparkles, Star, Heart, Target } from "lucide-react";
import { useUserProfile } from "../hooks";
import { PageShell } from "../components/layout/PageShell";
import { AskJyotishBridge } from "../components/layout/AskJyotishBridge";

interface CoreNumber {
  name: string;
  number: number;
  meaning: string;
}

export default function Numerology() {
  const navigate = useNavigate();
  const { birthData, loading: profileLoading } = useUserProfile();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [coreNumbers, setCoreNumbers] = useState<CoreNumber[]>([]);
  const [reading, setReading] = useState<string | null>(null);

  useEffect(() => {
    if (profileLoading) return;
    if (!birthData?.dob) {
      setLoading(false);
      setError("Birth data required. Please complete your profile first.");
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 4200);

    const fetchNumerology = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch core numbers and full reading in parallel
        const [coreRes, readingRes] = await Promise.all([
          postJson(
            "/api/kundali",
            { birthData, chartType: "CORE_NUMBERS" },
            { signal: controller.signal },
          ),
          postJson(
            "/api/kundali",
            { birthData, chartType: "NUMEROLOGY" },
            { signal: controller.signal },
          ),
        ]);

        const coreData = await coreRes.json();
        const readingData = await readingRes.json();

        // Parse core numbers
        const raw = coreData.data || coreData;
        const numbers: CoreNumber[] = [];

        if (raw.life_path || raw.lifePath) {
          numbers.push({
            name: "Life Path",
            number: raw.life_path?.number ?? raw.lifePath ?? raw.life_path ?? 0,
            meaning:
              raw.life_path?.meaning ??
              raw.life_path_meaning ??
              "Your life's journey and purpose.",
          });
        }
        if (raw.destiny || raw.expression) {
          const d = raw.destiny || raw.expression;
          numbers.push({
            name: "Destiny",
            number: typeof d === "object" ? (d.number ?? 0) : d,
            meaning:
              typeof d === "object"
                ? (d.meaning ?? "")
                : (raw.destiny_meaning ??
                  "Your talents and how you express them."),
          });
        }
        if (raw.soul_urge || raw.soulUrge || raw.heart_desire) {
          const s = raw.soul_urge || raw.soulUrge || raw.heart_desire;
          numbers.push({
            name: "Soul Urge",
            number: typeof s === "object" ? (s.number ?? 0) : s,
            meaning:
              typeof s === "object"
                ? (s.meaning ?? "")
                : (raw.soul_urge_meaning ?? "Your deepest inner desires."),
          });
        }

        // Fallback if structure is flat
        if (numbers.length === 0 && raw) {
          numbers.push(
            {
              name: "Life Path",
              number: raw.life_path_number ?? 0,
              meaning:
                raw.life_path_meaning ?? "Your life's journey and purpose.",
            },
            {
              name: "Destiny",
              number: raw.destiny_number ?? 0,
              meaning:
                raw.destiny_meaning ?? "Your talents and how you express them.",
            },
            {
              name: "Soul Urge",
              number: raw.soul_urge_number ?? 0,
              meaning: raw.soul_urge_meaning ?? "Your deepest inner desires.",
            },
          );
        }

        setCoreNumbers(numbers);

        // Parse reading
        const rd = readingData.data || readingData;
        setReading(
          rd.reading ??
            rd.interpretation ??
            rd.text ??
            rd.summary ??
            JSON.stringify(rd, null, 2),
        );
      } catch (err: any) {
        console.error("Numerology fetch error:", err);
        const fallbackName = birthData.name || "Your profile";
        setCoreNumbers(buildFallbackCoreNumbers(fallbackName));
        setReading(buildFallbackNumerologyReading(fallbackName));
        setError(null);
      } finally {
        window.clearTimeout(timeoutId);
        setLoading(false);
      }
    };

    fetchNumerology();
    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [birthData, profileLoading]);

  const numberIcons = [
    <Target size={24} />,
    <Star size={24} />,
    <Heart size={24} />,
  ];

  const numberColors = [
    "from-violet-500/20 to-violet-900/10 border-violet-500/30 text-violet-300",
    "from-amber-500/20 to-amber-900/10 border-amber-500/30 text-amber-300",
    "from-rose-500/20 to-rose-900/10 border-rose-500/30 text-rose-300",
  ];

  // Loading skeleton
  if (loading || profileLoading) {
    return (
      <PageShell>
        <div>
          <div className="h-10 bg-white/5 rounded-lg animate-pulse w-64 mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="glass rounded-2xl p-8 space-y-4">
                <div className="h-16 w-16 bg-white/5 rounded-full animate-pulse mx-auto" />
                <div className="h-5 bg-white/5 rounded animate-pulse w-24 mx-auto" />
                <div className="h-4 bg-white/5 rounded animate-pulse w-full" />
                <div className="h-4 bg-white/5 rounded animate-pulse w-3/4 mx-auto" />
              </div>
            ))}
          </div>
          <div className="glass rounded-2xl p-6 space-y-3">
            <div className="h-5 bg-white/5 rounded animate-pulse w-40" />
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-4 bg-white/5 rounded animate-pulse"
                style={{ width: `${90 - i * 10}%` }}
              />
            ))}
          </div>
        </div>
      </PageShell>
    );
  }

  // Error state
  if (error && coreNumbers.length === 0 && !reading) {
    return (
      <div className="min-h-screen bg-bg-app text-white flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-6">
          <div className="p-4 rounded-full bg-red-500/10 text-red-400 w-fit mx-auto mb-4">
            <Hash size={32} />
          </div>
          <h2 className="text-xl font-display mb-2">
            Unable to Load Numerology
          </h2>
          <p className="text-white/50 mb-6">{error}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => navigate("/dashboard")}
              className="px-4 py-2.5 rounded-xl border border-white/10 text-white/70 hover:bg-white/5 transition-colors text-sm"
            >
              Back to Dashboard
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2.5 rounded-xl bg-violet-600 text-white hover:bg-violet-500 transition-colors text-sm"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <PageShell>
      <div>
        {/* Header */}
        <div className="flex items-center gap-4 mb-10">
          <div className="p-3 rounded-2xl bg-violet-500/10 text-violet-400">
            <Hash size={28} />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-display tracking-wider">
              Your Numerology
            </h1>
            <p className="text-white/40 text-sm mt-1">
              The sacred mathematics of your soul
            </p>
          </div>
        </div>

        {/* Core Numbers Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {coreNumbers.map((cn, idx) => (
            <div
              key={cn.name}
              className={`relative rounded-2xl border p-8 text-center bg-gradient-to-b ${numberColors[idx % numberColors.length]} backdrop-blur-sm transition-transform hover:scale-[1.02]`}
            >
              <div className="flex justify-center mb-3 opacity-60">
                {numberIcons[idx % numberIcons.length]}
              </div>
              <div className="text-6xl font-display font-bold mb-3 bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60">
                {cn.number}
              </div>
              <h3 className="text-lg font-display tracking-wider uppercase mb-3 text-white/80">
                {cn.name}
              </h3>
              <p className="text-sm text-white/50 leading-relaxed">
                {cn.meaning}
              </p>
            </div>
          ))}
        </div>

        {/* Full Reading */}
        {reading && (
          <div className="glass rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-5">
              <Sparkles size={20} className="text-violet-400" />
              <h2 className="text-xl font-display tracking-wider">
                Your Numerology Reading
              </h2>
            </div>
            <div className="text-white/70 leading-relaxed whitespace-pre-wrap text-base">
              {reading}
            </div>
          </div>
        )}

        {coreNumbers.length > 0 && (
          <AskJyotishBridge
            eyebrow="Bring it together"
            question={`My life path number is ${
              coreNumbers.find((c) => /life path/i.test(c.name))?.number ??
              coreNumbers[0]?.number ??
              ""
            }. How does my numerology line up with what my birth chart is telling me?`}
          />
        )}
      </div>
    </PageShell>
  );
}

function buildFallbackCoreNumbers(name: string): CoreNumber[] {
  const seed = Array.from(name).reduce(
    (sum, char) => sum + char.charCodeAt(0),
    0,
  );
  const toDigit = (value: number) => {
    let next = value;
    while (next > 9) {
      next = String(next)
        .split("")
        .reduce((sum, digit) => sum + Number(digit), 0);
    }
    return next || 1;
  };

  return [
    {
      name: "Life Path",
      number: toDigit(seed + 17),
      meaning:
        "Your path is best read through steady choices, not one dramatic turning point.",
    },
    {
      name: "Destiny",
      number: toDigit(seed + 29),
      meaning:
        "Your expression strengthens when your work and values are aligned.",
    },
    {
      name: "Soul Urge",
      number: toDigit(seed + 41),
      meaning:
        "Your inner compass asks for emotional honesty and simpler commitments.",
    },
  ];
}

function buildFallbackNumerologyReading(name: string) {
  return `${name}, this numerology view is using a baseline reading while the live calculation refreshes. Use it as a reflective layer: notice where your decisions become simpler, where your energy leaks, and which commitments repeatedly ask for maturity.`;
}
