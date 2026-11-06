/**
 * Vimshottari dasha (120-year cycle) from the Moon's sidereal longitude.
 *
 * Balance at birth: the fraction of the Moon's nakshatra still to run times the
 * nakshatra lord's years. Sub-periods are proportional: AD = MD × years(AD)/120,
 * starting from the MD lord itself and following the fixed lord order.
 *
 * Year length: there is no single convention. Common choices:
 *   365.2425  Gregorian mean year — our default (calendar-stable dates)
 *   365.25    Julian year (Phala Dipika's "Sun returns to its place" read as 365¼ d)
 *   365.256363 sidereal year (Jagannatha Hora option, Swiss-based tools)
 *   360       savana year (some traditional texts)
 * Over a 120-year cycle 365.2425 vs 365.25 shifts dates by ~0.9 days and vs
 * the sidereal year by ~1.7 days — well inside the weeks-level precision birth
 * times allow. astrology-api.io does not document its constant (unverified).
 */
import { DASHA_ORDER } from "./types.js";
import type { DashaPeriod, Graha, VimshottariDasha } from "./types.js";
import { nakshatraOf } from "./nakshatra.js";
import { jdToIso } from "./julian.js";

export const VIMSHOTTARI_YEARS: Record<Graha, number> = {
  Ketu: 7,
  Venus: 20,
  Sun: 6,
  Moon: 10,
  Mars: 7,
  Rahu: 18,
  Jupiter: 16,
  Saturn: 19,
  Mercury: 17,
};
export const VIMSHOTTARI_TOTAL_YEARS = 120;
export const DEFAULT_DASHA_YEAR_DAYS = 365.2425;

export interface VimshottariOptions {
  /** Days per dasha year. Default 365.2425. */
  yearLengthDays?: number;
  /** 1 = MD only, 2 = MD+AD (default), 3 = MD+AD+PD. */
  depth?: 1 | 2 | 3;
  /** Number of mahadashas to list from the one running at birth. Default 9 (one full cycle). */
  cycles?: number;
}

function lordIndex(lord: Graha): number {
  return DASHA_ORDER.indexOf(lord);
}

function period(
  lord: Graha,
  level: 1 | 2 | 3,
  startJd: number,
  endJd: number,
): DashaPeriod {
  return {
    lord,
    level,
    startJd,
    endJd,
    start: jdToIso(startJd),
    end: jdToIso(endJd),
  };
}

/** Sub-periods of a period, in Vimshottari order starting from the parent's lord. */
export function subPeriods(parent: DashaPeriod, depth = 1): DashaPeriod[] {
  if (parent.level >= 3) return [];
  const span = parent.endJd - parent.startJd;
  const startIdx = lordIndex(parent.lord);
  const out: DashaPeriod[] = [];
  let cursor = parent.startJd;
  for (let i = 0; i < 9; i++) {
    const lord = DASHA_ORDER[(startIdx + i) % 9];
    const len = (span * VIMSHOTTARI_YEARS[lord]) / VIMSHOTTARI_TOTAL_YEARS;
    const end = i === 8 ? parent.endJd : cursor + len;
    const p = period(lord, (parent.level + 1) as 2 | 3, cursor, end);
    if (depth > 1) p.sub = subPeriods(p, depth - 1);
    out.push(p);
    cursor = end;
  }
  return out;
}

/** Vimshottari dasha from the Moon's sidereal longitude and the birth JD (UT). */
export function vimshottariDasha(
  moonSiderealLongitude: number,
  birthJdUT: number,
  options: VimshottariOptions = {},
): VimshottariDasha {
  const yearDays = options.yearLengthDays ?? DEFAULT_DASHA_YEAR_DAYS;
  const depth = options.depth ?? 2;
  const cycles = options.cycles ?? 9;
  const nak = nakshatraOf(moonSiderealLongitude);
  const birthLord = nak.lord;
  const lordYears = VIMSHOTTARI_YEARS[birthLord];
  const balanceYears = lordYears * (1 - nak.fraction);
  const firstStart = birthJdUT - (lordYears - balanceYears) * yearDays;

  const mahadashas: DashaPeriod[] = [];
  let cursor = firstStart;
  const startIdx = lordIndex(birthLord);
  for (let i = 0; i < cycles; i++) {
    const lord = DASHA_ORDER[(startIdx + i) % 9];
    const end = cursor + VIMSHOTTARI_YEARS[lord] * yearDays;
    const md = period(lord, 1, cursor, end);
    if (depth > 1) md.sub = subPeriods(md, depth - 1);
    mahadashas.push(md);
    cursor = end;
  }
  return {
    system: "vimshottari",
    yearLengthDays: yearDays,
    moonNakshatra: nak.index,
    birthLord,
    balanceYears,
    mahadashas,
  };
}

export interface CurrentPeriods {
  mahadasha: DashaPeriod;
  antardasha: DashaPeriod;
  pratyantardasha: DashaPeriod;
}

function findIn(periods: DashaPeriod[], jd: number): DashaPeriod | undefined {
  return periods.find((p) => jd >= p.startJd && jd < p.endJd);
}

/**
 * Running MD / AD / PD at `jdUT` (sub-periods are computed on the fly if the
 * dasha was built with a shallower depth). Returns null outside the listed range.
 */
export function currentPeriods(
  dasha: VimshottariDasha,
  jdUT: number,
): CurrentPeriods | null {
  const md = findIn(dasha.mahadashas, jdUT);
  if (!md) return null;
  const ad = findIn(md.sub ?? subPeriods(md), jdUT);
  if (!ad) return null;
  const pd = findIn(ad.sub ?? subPeriods(ad), jdUT);
  if (!pd) return null;
  return {
    mahadasha: stripSub(md),
    antardasha: stripSub(ad),
    pratyantardasha: stripSub(pd),
  };
}

function stripSub(p: DashaPeriod): DashaPeriod {
  return {
    lord: p.lord,
    level: p.level,
    startJd: p.startJd,
    endJd: p.endJd,
    start: p.start,
    end: p.end,
  };
}
