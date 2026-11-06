import { useEffect, useState } from "react";

export interface DashaTransition {
  planet: string;
  date: Date;
  type: "Mahadasha" | "Antardasha";
}

interface MonitoredDashaPeriod {
  planet: string;
  endDate: string;
  subPeriods?: Array<{ planet: string; endDate: string }>;
}

/**
 * Watches already-loaded dasha periods for a significant transition in the
 * next 35 days and emits `atman:dasha-shift-approaching` for
 * useProactiveTriggers.
 *
 * It takes the periods as input instead of fetching them: the Dashboard loads
 * DASHAS once (useDashaPeriods) and shares the result, so the monitor costs no
 * extra astrology-API call. Re-checks hourly against the same data.
 */
export function useDashaMonitor(
  periods: MonitoredDashaPeriod[] | null | undefined,
  enabled = true,
) {
  const [upcomingTransition, setUpcomingTransition] =
    useState<DashaTransition | null>(null);

  useEffect(() => {
    if (!enabled || !periods || periods.length === 0) return;

    const checkTransitions = () => {
      const now = Date.now();
      const limit = new Date(now);
      limit.setDate(limit.getDate() + 35);

      const nextShift = findNextSignificantShift(periods, new Date(now), limit);
      setUpcomingTransition(nextShift);
      if (!nextShift) return;

      window.dispatchEvent(
        new CustomEvent("atman:dasha-shift-approaching", {
          detail: {
            planet: nextShift.planet,
            date: nextShift.date,
            type: nextShift.type,
            daysRemaining: Math.ceil(
              (nextShift.date.getTime() - now) / (1000 * 60 * 60 * 24),
            ),
          },
        }),
      );
    };

    checkTransitions();
    const interval = setInterval(checkTransitions, 3600000);
    return () => clearInterval(interval);
  }, [periods, enabled]);

  return upcomingTransition;
}

function findNextSignificantShift(
  dashas: MonitoredDashaPeriod[],
  now: Date,
  limit: Date,
): DashaTransition | null {
  if (!dashas || !Array.isArray(dashas)) return null;

  for (const d of dashas) {
    const endDate = new Date(d.endDate);
    if (endDate > now && endDate < limit) {
      return {
        planet: d.planet,
        date: endDate,
        type: "Mahadasha",
      };
    }

    // Also check sub-periods (Antardashas)
    if (d.subPeriods) {
      for (const sd of d.subPeriods) {
        const sEndDate = new Date(sd.endDate);
        if (sEndDate > now && sEndDate < limit) {
          return {
            planet: sd.planet,
            date: sEndDate,
            type: "Antardasha",
          };
        }
      }
    }
  }

  return null;
}
