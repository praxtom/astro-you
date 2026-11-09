import { useState, useEffect } from "react";
import { postJson } from "../lib/apiFetch";
import { Hash, Sparkles, Star, Heart, Target, RotateCcw } from "lucide-react";
import { useUserProfile } from "../hooks";
import { useRequestBirthData } from "../hooks/useRequestBirthData";
import { PageShell } from "../components/layout/PageShell";
import { AskJyotishBridge } from "../components/layout/AskJyotishBridge";
import BirthProfileRequired from "../components/BirthProfileRequired";

interface CoreNumber {
  name: string;
  number: number | string;
  meaning: string;
}

function toDisplayNumber(value: unknown): number | string | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) return value.trim();
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return toDisplayNumber(obj.number ?? obj.value);
  }
  return null;
}

function toText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function parseCoreNumbers(raw: Record<string, any>): CoreNumber[] {
  const defs: { name: string; keys: string[]; meaningKeys: string[] }[] = [
    { name: "Life Path", keys: ["life_path", "lifePath", "life_path_number"], meaningKeys: ["life_path_meaning"] },
    { name: "Destiny", keys: ["destiny", "expression", "destiny_number", "expression_number"], meaningKeys: ["destiny_meaning", "expression_meaning"] },
    { name: "Soul Urge", keys: ["soul_urge", "soulUrge", "heart_desire", "soul_urge_number"], meaningKeys: ["soul_urge_meaning"] },
  ];
  const out: CoreNumber[] = [];
  for (const def of defs) {
    const key = def.keys.find((k) => raw[k] !== undefined && raw[k] !== null);
    if (!key) continue;
    const value = raw[key];
    const number = toDisplayNumber(value);
    if (number === null) continue;
    const meaning =
      (typeof value === "object" ? toText(value?.meaning) : "") ||
      def.meaningKeys.map((k) => toText(raw[k])).find(Boolean) ||
      "";
    out.push({ name: def.name, number, meaning });
  }
  return out;
}

function parseReading(rd: unknown): string | null {
  if (typeof rd === "string") return rd.trim() || null;
  if (!rd || typeof rd !== "object") return null;
  const obj = rd as Record<string, unknown>;
  const text = [obj.reading, obj.interpretation, obj.text, obj.summary].find(
    (v) => typeof v === "string" && v.trim(),
  );
  return typeof text === "string" ? text : null;
}

const ERROR_MESSAGE =
  "We couldn't calculate your numerology right now. Check your connection and try again.";

export default function Numerology() {
  const { birthData: profileBirthData, loading: profileLoading } = useUserProfile();
  const birthData = useRequestBirthData(profileBirthData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [coreNumbers, setCoreNumbers] = useState<CoreNumber[]>([]);
  const [reading, setReading] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (profileLoading) return;
    if (!birthData?.dob) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    let timedOut = false;
    const timeoutId = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 15000);

    const fetchNumerology = async () => {
      try {
        setLoading(true);
        setError(null);

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

        if (!coreRes.ok) throw new Error(`Core numbers failed: ${coreRes.status}`);
        const coreData = await coreRes.json();
        const readingData = readingRes.ok ? await readingRes.json().catch(() => null) : null;

        const numbers = parseCoreNumbers((coreData?.data ?? coreData) || {});
        const text = readingData ? parseReading(readingData.data ?? readingData) : null;
        if (numbers.length === 0 && !text) throw new Error("Numerology response had no usable data");

        setCoreNumbers(numbers);
        setReading(text);
      } catch (err: any) {
        if (err?.name === "AbortError" && !timedOut) return;
        console.error("Numerology fetch error:", err);
        setCoreNumbers([]);
        setReading(null);
        setError(ERROR_MESSAGE);
      } finally {
        window.clearTimeout(timeoutId);
        if (!controller.signal.aborted || timedOut) setLoading(false);
      }
    };

    fetchNumerology();
    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [birthData, profileLoading, attempt]);

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

  const header = (
    <div className="flex items-center gap-4 mb-10">
      <div className="p-3 rounded-2xl bg-gold/10 text-gold">
        <Hash size={28} />
      </div>
      <div>
        <h1 className="type-page-title">Your Numerology</h1>
        <p className="text-white/55 text-sm mt-1">
          The sacred mathematics of your soul
        </p>
      </div>
    </div>
  );

  if (!profileLoading && !birthData?.dob) {
    return (
      <PageShell>
        {header}
        <BirthProfileRequired
          title="Add your birth details"
          description="Numerology is calculated from your name and date of birth. Create your birth profile to see your Life Path, Destiny and Soul Urge numbers."
        />
      </PageShell>
    );
  }

  // Loading skeleton
  if (loading || profileLoading) {
    return (
      <PageShell>
        <div aria-busy="true">
          {header}
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

  if (error) {
    return (
      <PageShell>
        {header}
        <div role="alert" className="max-w-2xl rounded-2xl border border-red-400/20 bg-red-500/[0.06] p-6">
          <h2 className="font-display text-xl text-white mb-2">Numerology unavailable</h2>
          <p className="text-sm text-white/70 mb-5">{error}</p>
          <button
            type="button"
            onClick={() => setAttempt((n) => n + 1)}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-sm font-bold text-black hover:bg-gold/90"
          >
            <RotateCcw size={15} /> Retry
          </button>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div>
        {header}

        {/* Core Numbers Grid */}
        {coreNumbers.length > 0 && (
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
              {cn.meaning && (
                <p className="text-sm text-white/65 leading-relaxed">
                  {cn.meaning}
                </p>
              )}
            </div>
          ))}
        </div>
        )}

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
