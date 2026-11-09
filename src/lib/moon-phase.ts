/** Minimal lunar phase shape shared by the dashboard. */
export interface LunarLike {
  phase: string;
  /** Percent lit, 0-100. */
  illumination: number;
  emoji?: string;
}

/**
 * Moon phase from the date alone (mean synodic month from the 6 Jan 2000 new
 * moon). Within about a day of the true phase — used only when the lunar
 * service returns nothing, so the moon is never drawn wrong or left blank.
 */
export function approximateLunar(date = new Date()): LunarLike {
  const SYNODIC = 29.530588853;
  const knownNew = Date.UTC(2000, 0, 6, 18, 14);
  const age =
    ((((date.getTime() - knownNew) / 86400000) % SYNODIC) + SYNODIC) % SYNODIC;
  const illumination = Math.round(
    ((1 - Math.cos((2 * Math.PI * age) / SYNODIC)) / 2) * 100,
  );
  const waxing = age < SYNODIC / 2;
  const phase =
    age < 1.0 || age > SYNODIC - 1.0
      ? "New moon"
      : Math.abs(age - SYNODIC / 2) < 1.0
        ? "Full moon"
        : illumination < 50
          ? waxing
            ? "Waxing crescent"
            : "Waning crescent"
          : waxing
            ? "Waxing gibbous"
            : "Waning gibbous";
  return { phase, illumination };
}
