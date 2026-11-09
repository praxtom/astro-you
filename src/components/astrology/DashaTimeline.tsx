import { useEffect, useMemo, useRef, useState } from "react";

interface DashaPeriod {
  planet: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  subPeriods?: DashaPeriod[];
}

interface DashaTimelineProps {
  periods: DashaPeriod[];
}

const PLANET_ABBR: Record<string, string> = {
  Sun: "Su",
  Moon: "Mo",
  Mars: "Ma",
  Mercury: "Me",
  Jupiter: "Ju",
  Venus: "Ve",
  Saturn: "Sa",
  Rahu: "Ra",
  Ketu: "Ke",
};

const monthYear = (d: string) =>
  new Date(d).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
const year = (d: string) => new Date(d).getFullYear();
const shortYear = (d: string) => `’${String(year(d)).slice(-2)}`;

/** Rendered width of an element, tracked across resizes (phone ↔ desktop). */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  // A phone-ish default so the first paint never over-labels.
  const [width, setWidth] = useState(320);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.getBoundingClientRect().width || 320);
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

// Label budgets in pixels, so labels never collide at 360px: a segment shows
// its full name, the two-letter abbreviation, or nothing (its title still
// names it), and a year only when it fits beside its neighbours.
const FULL_NAME_PX = 72;
const ABBR_PX = 26;
const FULL_YEAR_PX = 44;
const SHORT_YEAR_PX = 30;

function span(start: string, end: string, originMs: number, totalMs: number) {
  const s = new Date(start).getTime() - originMs;
  const e = new Date(end).getTime() - originMs;
  return { left: (s / totalMs) * 100, width: ((e - s) / totalMs) * 100 };
}

/**
 * One thin track per level: every segment labelled when there is room, the
 * running period in gold, and a "now" rule at today's real position — so the
 * whole sequence is readable without colour coding or tooltips.
 */
function Track({
  items,
  height,
  showYears,
  parent,
}: {
  items: DashaPeriod[];
  height: string;
  showYears: boolean;
  parent?: string;
}) {
  const originMs = new Date(items[0].startDate).getTime();
  const totalMs =
    new Date(items[items.length - 1].endDate).getTime() - originMs || 1;
  const nowPct = ((Date.now() - originMs) / totalMs) * 100;
  const nowVisible = nowPct > 0 && nowPct < 100;
  const [labelsRef, trackPx] = useWidth<HTMLDivElement>();

  return (
    <div ref={labelsRef}>
      <div className="relative" style={{ paddingTop: nowVisible ? 18 : 0 }}>
        <div className={`relative ${height}`}>
          {items.map((p, i) => {
            const { left, width } = span(
              p.startDate,
              p.endDate,
              originMs,
              totalMs,
            );
            const title = `${p.planet}${parent ? ` within ${parent}` : ""}: ${monthYear(p.startDate)} to ${monthYear(p.endDate)}`;
            return (
              <div
                key={`${p.planet}-${i}`}
                title={title}
                aria-label={title}
                role="img"
                className={`absolute inset-y-0 rounded-full ${p.isCurrent ? "bg-gold" : "bg-white/15"}`}
                style={{
                  left: `calc(${left}% + 1.5px)`,
                  width: `calc(${width}% - 3px)`,
                }}
              />
            );
          })}
        </div>
        {nowVisible && (
          <div
            className="absolute top-0 bottom-0 w-px bg-white/70"
            style={{ left: `${nowPct}%` }}
            aria-hidden="true"
          >
            <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 text-[0.65rem] font-bold uppercase tracking-[0.2em] text-white/80">
              Now
            </span>
          </div>
        )}
      </div>

      <div className="relative mt-2 h-9">
        {items.map((p, i) => {
          const { left, width } = span(
            p.startDate,
            p.endDate,
            originMs,
            totalMs,
          );
          const px = (width / 100) * trackPx;
          // Narrow periods go unlabelled (their title still names them), but
          // the running period is always labelled, at least abbreviated.
          if (px < ABBR_PX && !p.isCurrent) return null;
          const abbr = PLANET_ABBR[p.planet] || p.planet;
          const name = px >= FULL_NAME_PX ? p.planet : abbr;
          const yearText = !showYears
            ? null
            : px >= FULL_YEAR_PX
              ? String(year(p.startDate))
              : px >= SHORT_YEAR_PX
                ? shortYear(p.startDate)
                : null;
          return (
            <div
              key={`l-${p.planet}-${i}`}
              className="absolute top-0 overflow-hidden whitespace-nowrap pr-1"
              style={{
                left: `${left}%`,
                // The running period may need a little more than its share
                // for its abbreviation; never less than the abbreviation.
                width: p.isCurrent
                  ? `max(${width}%, ${ABBR_PX}px)`
                  : `${width}%`,
              }}
              title={`${p.planet}: ${monthYear(p.startDate)} to ${monthYear(p.endDate)}`}
            >
              <p
                className={`font-display text-[1.1rem] leading-tight ${p.isCurrent ? "text-gold" : "text-white/60"}`}
              >
                {name}
              </p>
              {yearText && (
                <p className="text-[0.78rem] tabular-nums text-white/55">
                  {yearText}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function DashaTimeline({ periods }: DashaTimelineProps) {
  const current = useMemo(
    () => periods.find((p) => p.isCurrent) || null,
    [periods],
  );
  if (!periods.length) return null;
  const subs = current?.subPeriods || [];
  const currentSub = subs.find((s) => s.isCurrent) || null;

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-2 text-[0.9rem] text-white/55">
        <span>
          Mahadashas, {monthYear(periods[0].startDate)} to{" "}
          {monthYear(periods[periods.length - 1].endDate)}
        </span>
        {current && (
          <span>
            Now: <span className="text-gold">{current.planet}</span> until{" "}
            {monthYear(current.endDate)}
          </span>
        )}
      </div>
      <Track items={periods} height="h-1.5" showYears />

      {subs.length > 0 && current && (
        <div className="mt-10">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-2 text-[0.9rem] text-white/55">
            <span>Antardashas within {current.planet}</span>
            {currentSub && (
              <span>
                Now: <span className="text-gold">{currentSub.planet}</span>{" "}
                until {monthYear(currentSub.endDate)}
              </span>
            )}
          </div>
          <Track
            items={subs}
            height="h-1"
            showYears={false}
            parent={current.planet}
          />
        </div>
      )}
    </div>
  );
}
