import type { ReactNode } from "react";
import { Sparkles, Sun } from "lucide-react";
import type { PanchangData } from "../../hooks/usePanchang";
import type { TodayGuide } from "../../lib/todayGuide";
import { TILE } from "./primitives";
import { GlossaryTerm } from "../ui/GlossaryTerm";

/**
 * Apple-Weather-style dashboard tiles: self-labelled tiles that draw the data
 * (day bar) instead of only writing it. Every tile uses the same header.
 */

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

/**
 * One header for every dashboard tile: a gold line icon, the title, and an
 * optional action on the right. Every tile passes an icon.
 */
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
    <div className="mb-3 flex min-h-11 items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 font-body text-[0.78rem] font-semibold uppercase tracking-[0.08em] text-white/55">
        {icon && (
          <span className="text-gold/70 [&>svg]:size-[15px]" aria-hidden="true">
            {icon}
          </span>
        )}
        {children}
      </h2>
      {action}
    </div>
  );
}

/** The one action style used in tile headers and at the foot of tiles. */
export const TILE_ACTION_CLASS =
  "inline-flex min-h-11 shrink-0 items-center gap-1.5 text-[0.85rem] font-semibold text-gold/85 transition-colors hover:text-gold";

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
          {/* On phones the legend takes its own line so the row never cramps. */}
          <div className="mt-2.5 grid grid-cols-2 gap-y-1.5 text-[0.85rem] text-white/55 sm:flex sm:justify-between">
            <span>Sunrise {hhmm(day[0])}</span>
            <span className="order-last col-span-2 flex gap-3 sm:order-none">
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
            <span className="text-right">Sunset {hhmm(day[1])}</span>
          </div>
        </>
      )}
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
            className={TILE_ACTION_CLASS}
          >
            Set today's intention
          </button>
        }
      >
        Today, for you
      </TileHead>
      {guide.context && (
        <p className="-mt-1 mb-4 text-[0.9rem] text-white/60">
          {guide.context}
        </p>
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-5">
        {cols.map(([k, v]) => (
          <div key={k}>
            <h3 className="font-display text-[1.3rem] leading-tight text-white/92">
              {k}
            </h3>
            <p className="mt-1.5 text-[0.98rem] leading-relaxed text-white/65">
              {v}
            </p>
          </div>
        ))}
      </div>
      {showNudge && (
        <p className="mt-5 text-[0.92rem] italic text-white/55">
          {guide.nudge}
        </p>
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
  icon,
  value,
  note,
  children,
  className = "",
}: {
  label: string;
  icon?: ReactNode;
  value: ReactNode;
  note?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`${TILE} ${className}`}>
      <TileHead icon={icon}>{label}</TileHead>
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
