import React, { useMemo } from "react";
import { Flame, Share2 } from "lucide-react";
import type { PanchangData } from "../../hooks/usePanchang";
import type { LunarPhaseData } from "../../hooks/useLunarPhase";

interface HeroAlmanacProps {
  name: string;
  emotionalState?: string;
  meditationStreak?: number;
  panchang: PanchangData | null;
  panchangLoading: boolean;
  lunar: LunarPhaseData | null;
  onShareSign: () => void;
}

/** Render-safe string: the astrology API sometimes returns objects where strings are expected. */
function asText(v: unknown): string | undefined {
  return typeof v === "string" && v !== "—" ? v : undefined;
}

/** Tolerant "HH:MM[:SS] [AM/PM]" → minutes since midnight, or null. */
function parseTimeToMinutes(raw?: string): number | null {
  if (!raw || typeof raw !== "string") return null;
  const m = raw.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?$/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const meridiem = m[3]?.toLowerCase();
  if (meridiem === "pm" && h < 12) h += 12;
  if (meridiem === "am" && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** Point at parameter t along the hero's quadratic day-arc. */
function arcPoint(t: number) {
  const p0 = { x: 24, y: 112 };
  const p1 = { x: 300, y: -36 };
  const p2 = { x: 576, y: 112 };
  const u = 1 - t;
  return {
    x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
    y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
  };
}

function DayArc({ panchang }: { panchang: PanchangData | null }) {
  const sunrise = parseTimeToMinutes(panchang?.sunrise);
  const sunset = parseTimeToMinutes(panchang?.sunset);
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const hasWindow = sunrise !== null && sunset !== null && sunset > sunrise;
  const isDay = hasWindow && nowMin >= sunrise && nowMin <= sunset;
  const t = hasWindow
    ? Math.min(1, Math.max(0, (nowMin - sunrise) / (sunset - sunrise)))
    : 0.5;
  const sun = arcPoint(t);

  return (
    <svg
      viewBox="0 0 600 130"
      className="w-full h-auto select-none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="arc-stroke" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(255,205,106,0)" />
          <stop offset="50%" stopColor="rgba(255,205,106,0.55)" />
          <stop offset="100%" stopColor="rgba(255,205,106,0)" />
        </linearGradient>
        <radialGradient id="sun-glow">
          <stop offset="0%" stopColor="rgba(255,205,106,0.9)" />
          <stop offset="100%" stopColor="rgba(255,205,106,0)" />
        </radialGradient>
      </defs>

      {/* horizon */}
      <line
        x1="0"
        y1="112"
        x2="600"
        y2="112"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth="1"
      />
      {/* the day's arc */}
      <path
        d="M 24 112 Q 300 -36 576 112"
        fill="none"
        stroke="url(#arc-stroke)"
        strokeWidth="1"
        strokeDasharray={isDay ? "none" : "2 5"}
      />
      {/* sunrise / sunset ticks */}
      <line
        x1="24"
        y1="106"
        x2="24"
        y2="118"
        stroke="rgba(255,205,106,0.4)"
        strokeWidth="1"
      />
      <line
        x1="576"
        y1="106"
        x2="576"
        y2="118"
        stroke="rgba(255,205,106,0.4)"
        strokeWidth="1"
      />

      {isDay ? (
        <g>
          <circle cx={sun.x} cy={sun.y} r="16" fill="url(#sun-glow)" />
          <circle cx={sun.x} cy={sun.y} r="4" fill="#ffcd6a" />
        </g>
      ) : (
        <g>
          <circle cx="300" cy="38" r="14" fill="rgba(248,250,252,0.06)" />
          <circle cx="300" cy="38" r="6" fill="rgba(248,250,252,0.55)" />
          <circle cx="304" cy="35" r="5.5" fill="#030308" />
        </g>
      )}

      <text
        x="24"
        y="129"
        fill="rgba(255,255,255,0.35)"
        fontSize="9"
        letterSpacing="2"
        fontFamily="var(--font-body)"
      >
        ↑ {asText(panchang?.sunrise) ?? "SUNRISE"}
      </text>
      <text
        x="576"
        y="129"
        textAnchor="end"
        fill="rgba(255,255,255,0.35)"
        fontSize="9"
        letterSpacing="2"
        fontFamily="var(--font-body)"
      >
        {asText(panchang?.sunset) ?? "SUNSET"} ↓
      </text>
    </svg>
  );
}

const EMOTION_STYLES: Record<string, string> = {
  stable: "text-emerald-300/90 border-emerald-400/25 bg-emerald-400/5",
  anxious: "text-amber-300/90 border-amber-400/25 bg-amber-400/5",
  chaotic: "text-red-300/90 border-red-400/25 bg-red-400/5",
};

function greetingForHour(hour: number): string {
  if (hour < 5) return "The stars kept watch,";
  if (hour < 12) return "Good morning,";
  if (hour < 17) return "Good afternoon,";
  if (hour < 21) return "Good evening,";
  return "The night unfolds,";
}

/**
 * Dashboard masthead: time-aware greeting, live day-arc, and the day's
 * panchang rendered as an almanac band.
 */
export const HeroAlmanac: React.FC<HeroAlmanacProps> = ({
  name,
  emotionalState,
  meditationStreak,
  panchang,
  panchangLoading,
  lunar,
  onShareSign,
}) => {
  const today = useMemo(() => {
    const now = new Date();
    return {
      greeting: greetingForHour(now.getHours()),
      dateLine: now.toLocaleDateString("en-IN", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
    };
  }, []);

  const bandCells = useMemo(() => {
    return [
      {
        label: "Tithi",
        value: asText(panchang?.tithi),
        sub: asText(panchang?.tithiEnd) && `till ${panchang?.tithiEnd}`,
      },
      {
        label: "Nakshatra",
        value: asText(panchang?.nakshatra),
        sub: asText(panchang?.nakshatraEnd) && `till ${panchang?.nakshatraEnd}`,
      },
      { label: "Yoga", value: asText(panchang?.yoga) },
      { label: "Karana", value: asText(panchang?.karana) },
      { label: "Rahu Kaal", value: asText(panchang?.rahu_kaal), caution: true },
      {
        label: "Moon",
        value: lunar
          ? `${lunar.emoji} ${lunar.phase}`
          : asText(panchang?.moonSign),
        sub: lunar ? `${Math.round(lunar.illumination)}% lit` : undefined,
      },
    ];
  }, [panchang, lunar]);

  return (
    <section className="relative">
      {/* Eyebrow */}
      <div className="flex items-baseline gap-4 animate-reveal-progressive">
        <p className="text-gold/80 text-[0.65rem] font-bold uppercase tracking-[0.4em]">
          The Ephemeris
        </p>
        <span className="hidden sm:block flex-1 h-px bg-linear-to-r from-gold/25 to-transparent" />
        <p className="text-white/35 text-[0.65rem] uppercase tracking-[0.25em]">
          {today.dateLine}
        </p>
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-x-12 gap-y-8 items-end">
        {/* Greeting */}
        <div className="animate-reveal-progressive">
          <h1 className="font-display leading-[1.02]">
            <span className="block text-2xl md:text-3xl text-white/55 italic">
              {today.greeting}
            </span>
            <span className="block text-5xl md:text-7xl text-gold italic mt-1 h-light">
              {name}
            </span>
          </h1>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            {emotionalState && (
              <span
                className={`text-[0.65rem] font-bold uppercase tracking-[0.2em] px-3 py-1.5 rounded-full border ${
                  EMOTION_STYLES[emotionalState] ??
                  "text-white/60 border-white/10 bg-white/5"
                }`}
              >
                {emotionalState.replace(/_/g, " ")}
              </span>
            )}
            {(meditationStreak ?? 0) > 0 && (
              <span className="inline-flex items-center gap-1.5 text-[0.65rem] font-bold uppercase tracking-[0.2em] text-amber-300/90 px-3 py-1.5 rounded-full border border-amber-400/25 bg-amber-400/5">
                <Flame size={11} />
                {meditationStreak} day sādhanā
              </span>
            )}
            <button
              onClick={onShareSign}
              className="inline-flex items-center gap-1.5 text-[0.65rem] font-bold uppercase tracking-[0.2em] text-white/40 px-3 py-1.5 rounded-full border border-white/10 hover:text-gold hover:border-gold/30 transition-colors"
              title="Share your sign"
            >
              <Share2 size={11} />
              Share sign
            </button>
          </div>
        </div>

        {/* Day arc */}
        <div className="animate-reveal-progressive">
          <DayArc panchang={panchang} />
        </div>
      </div>

      {/* Almanac band */}
      <div className="mt-8 border-y border-white/8">
        <div className="flex overflow-x-auto snap-x scrollbar-none [&::-webkit-scrollbar]:hidden divide-x divide-white/8">
          {bandCells.map((cell) => (
            <div
              key={cell.label}
              className="snap-start shrink-0 min-w-38 flex-1 px-5 py-4"
            >
              <p
                className={`text-[0.6rem] font-bold uppercase tracking-[0.3em] ${
                  cell.caution ? "text-red-300/50" : "text-white/30"
                }`}
              >
                {cell.label}
              </p>
              <p
                className={`mt-1.5 font-display text-lg leading-tight ${
                  cell.caution ? "text-red-200/80" : "text-white/85"
                }`}
              >
                {cell.value ?? (
                  <span className="text-white/25">
                    {panchangLoading ? "…" : "—"}
                  </span>
                )}
              </p>
              {cell.sub && (
                <p className="mt-0.5 text-[0.65rem] text-white/30">
                  {cell.sub}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
