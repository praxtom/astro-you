import type { ReactNode } from "react";
import { Moon, Share2, Sparkles, Sun, CalendarDays } from "lucide-react";
import type { PanchangData } from "../../hooks/usePanchang";
import type { TodayGuide } from "../../lib/todayGuide";
import { TILE } from "./primitives";
import { GlossaryTerm } from "../ui/GlossaryTerm";
import type { LunarLike } from "../../lib/moon-phase";

/**
 * Apple-Weather-style dashboard pieces: a centred hero that carries the day's
 * reading once, and self-labelled tiles that draw the data (day bar, moon)
 * instead of only writing it. Every tile uses the same header.
 */

type Lunar = LunarLike | null;

const asText = (v: unknown) =>
  typeof v === "string" && v.trim() && v.trim() !== "—" ? v.trim() : undefined;

/** "06:19", "6:19 AM", "18:05" → minutes since midnight. */
function toMinutes(text?: string): number | null {
  if (!text) return null;
  const m = text.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2]);
  const ap = m[3]?.toLowerCase();
  if (ap === "pm" && h < 12) h += 12;
  if (ap === "am" && h === 12) h = 0;
  return h * 60 + min;
}
function rangeMinutes(text?: string): [number, number] | null {
  if (!text) return null;
  const parts = text.split(/\s*[-–]\s*/);
  if (parts.length < 2) return null;
  const a = toMinutes(parts[0]);
  const b = toMinutes(parts[1]);
  return a != null && b != null ? [a, b] : null;
}
const hhmm = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(Math.round(m % 60)).padStart(2, "0")}`;
const nowMinutes = () => {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
};

/** One header style for every tile: small icon + label, optional action. */
export function TileHead({
  icon,
  children,
  action,
}: {
  icon?: ReactNode;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <p className="flex items-center gap-2 text-[0.78rem] font-semibold uppercase tracking-[0.08em] text-white/55">
        {icon}
        {children}
      </p>
      {action}
    </div>
  );
}

/* ---------- Moon disk with a correct terminator ---------- */
function moonPath(f: number, waxing: boolean, R: number) {
  const rx = Math.abs(1 - 2 * f) * R;
  const crescent = f < 0.5;
  return waxing
    ? `M0 ${-R} A${R} ${R} 0 0 1 0 ${R} A${rx} ${R} 0 0 ${crescent ? 0 : 1} 0 ${-R} Z`
    : `M0 ${-R} A${R} ${R} 0 0 0 0 ${R} A${rx} ${R} 0 0 ${crescent ? 1 : 0} 0 ${-R} Z`;
}
export function MoonDisk({
  lunar,
  size = 96,
}: {
  lunar: Lunar;
  size?: number;
}) {
  const f = Math.max(0, Math.min(1, (lunar?.illumination ?? 50) / 100));
  const phase = (lunar?.phase || "").toLowerCase();
  const waxing = !/(wan|last|third)/.test(phase);
  const R = 48;
  return (
    <svg
      viewBox="-52 -52 104 104"
      width={size}
      height={size}
      role="img"
      aria-label={
        lunar ? `Moon ${Math.round(f * 100)}% lit, ${lunar.phase}` : "Moon"
      }
      className="drop-shadow-[0_0_22px_rgba(243,234,214,0.22)]"
    >
      <circle r={R} fill="#14162b" />
      <path d={moonPath(f, waxing, R)} fill="#f3ead6" />
      <circle r={R} fill="none" stroke="rgba(255,255,255,0.18)" />
    </svg>
  );
}

/* ---------- Hero ---------- */
function greetingForHour(hour: number): string {
  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function TodayHero({
  name,
  place,
  panchang,
  lunar,
  reading,
  readingLoading,
  chips,
  onShareSign,
}: {
  name: string;
  place?: string;
  panchang: PanchangData | null;
  lunar: Lunar;
  reading: string;
  readingLoading: boolean;
  chips?: ReactNode;
  onShareSign: () => void;
}) {
  const now = new Date();
  const date = now.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const firstName = name.split(" ")[0] || name;
  const tithi = asText(panchang?.tithi);
  const nak = asText(panchang?.nakshatra);
  return (
    <section
      className="text-center pt-6 pb-10 animate-reveal-progressive"
      aria-labelledby="today-hero"
    >
      <p className="text-[0.95rem] text-white/60">
        {date}
        {place ? `, ${place}` : ""}
      </p>
      <h1
        id="today-hero"
        className="mt-1 font-display text-[2.6rem] md:text-[3.6rem] leading-[1.05] text-white/95"
      >
        {greetingForHour(now.getHours())}, {firstName}
      </h1>
      <div className="mt-6 flex justify-center">
        <MoonDisk lunar={lunar} size={92} />
      </div>
      {(tithi || nak) && (
        <p className="mt-3 text-lg text-white/85">
          {tithi}
          {tithi && nak ? " · " : ""}
          {nak && `Moon in ${nak}`}
        </p>
      )}
      <p className="mx-auto mt-4 max-w-[34ch] font-display text-[1.6rem] md:text-[1.9rem] leading-snug text-white/88">
        {readingLoading ? "Reading today's sky…" : reading}
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
        {chips}
        <button
          type="button"
          onClick={onShareSign}
          className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-3.5 py-1.5 text-[0.85rem] text-white/60 hover:text-gold transition-colors"
        >
          <Share2 size={13} /> Share my sign
        </button>
      </div>
    </section>
  );
}

/* ---------- Your day: day bar with Rahu Kaal, Abhijit and now ---------- */
export function DayTile({
  panchang,
  placeLabel,
  className = "sm:col-span-2",
}: {
  panchang: PanchangData | null;
  /** Where the timings are for, e.g. "Pune" or "New Delhi (default)". */
  placeLabel?: string;
  className?: string;
}) {
  const sr = toMinutes(asText(panchang?.sunrise));
  const ss = toMinutes(asText(panchang?.sunset));
  const rahu = rangeMinutes(asText(panchang?.rahu_kaal));
  const now = nowMinutes();
  const day = sr != null && ss != null && ss > sr ? [sr, ss] : null;
  // Abhijit muhurta: the 8th of 15 daytime muhurtas, centred on local noon.
  const abhijit = day
    ? ([
        (day[0] + day[1]) / 2 - (day[1] - day[0]) / 30,
        (day[0] + day[1]) / 2 + (day[1] - day[0]) / 30,
      ] as [number, number])
    : null;
  const pct = (m: number) =>
    day
      ? Math.max(0, Math.min(100, ((m - day[0]) / (day[1] - day[0])) * 100))
      : 0;

  let headline = "Your day";
  let sub = "Panchang timings will appear here once they load.";
  if (rahu) {
    if (now < rahu[0]) {
      headline = `Rahu Kaal at ${hhmm(rahu[0])}`;
      sub = `${hhmm(rahu[0])}–${hhmm(rahu[1])} suits routine work; save fresh starts for another hour.`;
    } else if (now <= rahu[1]) {
      headline = "Rahu Kaal now";
      sub = `Ends at ${hhmm(rahu[1])}. A good ${rahu[1] - now} minutes for routine work and reflection.`;
    } else {
      headline = "Rahu Kaal is over";
      sub = `It ran ${hhmm(rahu[0])}–${hhmm(rahu[1])}.`;
    }
  }
  if (abhijit)
    sub += ` Abhijit, the best window for beginnings, is ${hhmm(abhijit[0])}–${hhmm(abhijit[1])}.`;

  return (
    <div className={`${TILE} ${className}`}>
      <TileHead
        icon={<Sun size={15} />}
        action={
          placeLabel ? (
            <span className="text-[0.8rem] text-white/50">
              Times for {placeLabel}
            </span>
          ) : undefined
        }
      >
        Your day
      </TileHead>
      <p className="font-display text-[1.9rem] leading-tight text-white/95">
        {headline}
      </p>
      <p className="mt-1.5 text-[0.98rem] leading-relaxed text-white/65">
        {sub}
      </p>
      {day && (
        <>
          <div
            className="relative mt-5 h-2.5 rounded-full bg-linear-to-r from-white/8 via-gold/25 to-white/8"
            aria-hidden="true"
          >
            {rahu && (
              <span
                className="absolute inset-y-0 rounded-full bg-rose-300/80"
                style={{
                  left: `${pct(rahu[0])}%`,
                  width: `${pct(rahu[1]) - pct(rahu[0])}%`,
                }}
              />
            )}
            {abhijit && (
              <span
                className="absolute inset-y-0 rounded-full bg-emerald-300/75"
                style={{
                  left: `${pct(abhijit[0])}%`,
                  width: `${pct(abhijit[1]) - pct(abhijit[0])}%`,
                }}
              />
            )}
            {now >= day[0] && now <= day[1] && (
              <span
                className="absolute -top-[5px] h-5 w-5 -translate-x-1/2 rounded-full border-4 border-[#15172b] bg-white"
                style={{ left: `${pct(now)}%` }}
              />
            )}
          </div>
          <div className="mt-2.5 flex justify-between text-[0.85rem] text-white/50">
            <span>Sunrise {hhmm(day[0])}</span>
            <span className="flex gap-3">
              {rahu && (
                <span className="text-rose-200/80">
                  <GlossaryTerm k="rahu-kaal">Rahu Kaal</GlossaryTerm>
                </span>
              )}
              {abhijit && (
                <span className="text-emerald-200/80">
                  <GlossaryTerm k="abhijit">Abhijit</GlossaryTerm>
                </span>
              )}
            </span>
            <span>Sunset {hhmm(day[1])}</span>
          </div>
        </>
      )}
    </div>
  );
}

/* ---------- Moon ---------- */
export function MoonTile({
  panchang,
  lunar,
}: {
  panchang: PanchangData | null;
  lunar: Lunar;
}) {
  const sign = asText(panchang?.moonSign);
  return (
    <div className={TILE}>
      <TileHead icon={<Moon size={15} />}>Moon</TileHead>
      <p className="font-display text-[1.9rem] leading-tight text-white/95">
        {lunar ? `${Math.round(lunar.illumination)}% lit` : "—"}
      </p>
      <p className="mt-1.5 text-[0.98rem] leading-relaxed text-white/65">
        {lunar?.phase ?? "Phase unavailable"}
        {sign ? ` in ${sign}` : ""}.
      </p>
    </div>
  );
}

/* ---------- Panchang ---------- */
export function PanchangTile({
  panchang,
  loading,
}: {
  panchang: PanchangData | null;
  loading: boolean;
}) {
  const rows: [string, string | undefined, string | undefined][] = [
    ["Tithi", asText(panchang?.tithi), asText(panchang?.tithiEnd)],
    ["Nakshatra", asText(panchang?.nakshatra), asText(panchang?.nakshatraEnd)],
    ["Yoga", asText(panchang?.yoga), undefined],
    ["Karana", asText(panchang?.karana), undefined],
  ];
  return (
    <div className={TILE}>
      <TileHead icon={<CalendarDays size={15} />}>Panchang</TileHead>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[0.98rem]">
        {rows.map(([k, v, end]) => (
          <div key={k} className="contents">
            <dt className="text-white/50">{k}</dt>
            <dd className="text-right text-white/90">
              {v ?? (loading ? "…" : "—")}
              {end && (
                <span className="block text-[0.8rem] text-white/55">
                  till {end}
                </span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/* ---------- Today for you (full width) ---------- */
export function TodayForYouTile({
  guide,
  onSaveIntention,
  showNudge = true,
}: {
  guide: TodayGuide;
  onSaveIntention: () => void;
  /** Off when the hero already shows the nudge as its reading. */
  showNudge?: boolean;
}) {
  const cols: [string, string][] = [
    ["Energy", guide.energy],
    ["Do", guide.action],
    ["Go easy", guide.caution],
  ];
  return (
    <div className={`${TILE} sm:col-span-2 lg:col-span-4`}>
      <TileHead
        icon={<Sparkles size={15} />}
        action={
          <button
            type="button"
            onClick={onSaveIntention}
            className="rounded-full bg-gold/12 px-3.5 py-1.5 text-[0.82rem] font-semibold text-gold hover:bg-gold hover:text-black transition-colors"
          >
            Save intention
          </button>
        }
      >
        Today, for you
      </TileHead>
      {guide.context && (
        <p className="-mt-1 mb-4 text-[0.85rem] text-white/50">
          {guide.context}
        </p>
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-5">
        {cols.map(([k, v]) => (
          <div key={k}>
            <p className="font-display text-[1.45rem] leading-tight text-white/92">
              {k}
            </p>
            <p className="mt-1.5 text-[0.98rem] leading-relaxed text-white/65">
              {v}
            </p>
          </div>
        ))}
      </div>
      {showNudge && (
        <p className="mt-5 text-[0.92rem] italic text-white/55">{guide.nudge}</p>
      )}
      {guide.why && (
        <p className="mt-4 border-t border-white/[0.06] pt-4 text-[0.92rem] leading-relaxed text-white/55">
          <span className="font-semibold text-white/70">Why this? </span>
          {guide.why}
        </p>
      )}
    </div>
  );
}

/** Generic chart fact tile (Moon sign, Rising). */
export function FactTile({
  label,
  value,
  note,
  children,
  className = "",
}: {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`${TILE} ${className}`}>
      <TileHead>{label}</TileHead>
      <p className="font-display text-[1.75rem] leading-tight text-white/95">
        {value}
      </p>
      {note && (
        <p className="mt-1.5 text-[0.98rem] leading-relaxed text-white/65">
          {note}
        </p>
      )}
      {children}
    </div>
  );
}
