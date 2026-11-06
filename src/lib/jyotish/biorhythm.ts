/**
 * Biorhythms: sin(2π·days/period) for the physical (23), emotional (28) and
 * intellectual (33) cycles. Days are whole calendar days since birth, so the
 * result does not depend on time zones.
 */
import { julianDayFromCalendar } from "./julian.js";

export const BIORHYTHM_CYCLES = {
  physical: 23,
  emotional: 28,
  intellectual: 33,
} as const;
export type BiorhythmCycle = keyof typeof BIORHYTHM_CYCLES;

export interface BiorhythmValue {
  /** −1 … +1 */
  value: number;
  /** Day index within the cycle (0 = start). */
  dayInCycle: number;
  /** True on zero-crossing days (value changes sign between this day and the next). */
  critical: boolean;
}

export type BiorhythmReading = Record<BiorhythmCycle, BiorhythmValue> & {
  daysSinceBirth: number;
};

function parseDay(date: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) throw new Error(`Invalid date "${date}" (expected YYYY-MM-DD)`);
  return julianDayFromCalendar(Number(m[1]), Number(m[2]), Number(m[3]));
}

export function daysBetween(fromDate: string, toDate: string): number {
  return Math.round(parseDay(toDate) - parseDay(fromDate));
}

function cycleValue(days: number, period: number): BiorhythmValue {
  const v = (d: number) => Math.sin((2 * Math.PI * d) / period);
  const value = Math.abs(v(days)) < 1e-12 ? 0 : v(days);
  const next = v(days + 1);
  const dayInCycle = ((days % period) + period) % period;
  return {
    value,
    dayInCycle,
    critical: value === 0 || Math.sign(value) !== Math.sign(next),
  };
}

export function biorhythm(birthDate: string, onDate: string): BiorhythmReading {
  const days = daysBetween(birthDate, onDate);
  return {
    daysSinceBirth: days,
    physical: cycleValue(days, BIORHYTHM_CYCLES.physical),
    emotional: cycleValue(days, BIORHYTHM_CYCLES.emotional),
    intellectual: cycleValue(days, BIORHYTHM_CYCLES.intellectual),
  };
}
