/**
 * Julian Day helpers. All functions take plain numbers; no Date parsing
 * surprises (JS Date is only used to format ISO strings).
 *
 * Calendar maths: Meeus, "Astronomical Algorithms" 2nd ed., ch. 7.
 * Delta-T: Espenak & Meeus polynomial expressions (NASA Five Millennium
 * Canon of Solar Eclipses, https://eclipse.gsfc.nasa.gov/SEhelp/deltatpoly2004.html).
 */

export const J2000 = 2451545.0;
export const UNIX_EPOCH_JD = 2440587.5;

/** JD of a Gregorian calendar instant expressed in UT (fractional day allowed). */
export function julianDayFromCalendar(
  year: number,
  month: number,
  day: number,
): number {
  let y = year;
  let m = month;
  if (m <= 2) {
    y -= 1;
    m += 12;
  }
  const a = Math.floor(y / 100);
  const b = 2 - a + Math.floor(a / 4);
  return (
    Math.floor(365.25 * (y + 4716)) +
    Math.floor(30.6001 * (m + 1)) +
    day +
    b -
    1524.5
  );
}

/**
 * JD (UT) from a local civil date/time and the UTC offset in force there.
 * `utcOffsetHours` is positive east of Greenwich (IST = +5.5).
 */
export function julianDayFromLocal(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  utcOffsetHours: number,
): number {
  const dayFraction =
    (hour + minute / 60 + second / 3600 - utcOffsetHours) / 24;
  return julianDayFromCalendar(year, month, day + dayFraction);
}

/** Parse "YYYY-MM-DD" and "HH:mm[:ss]" into JD (UT). Throws on malformed input. */
export function julianDayFromStrings(
  date: string,
  time: string,
  utcOffsetHours: number,
): number {
  const d = /^(-?\d{1,4})-(\d{1,2})-(\d{1,2})$/.exec(date.trim());
  const t = /^(\d{1,2}):(\d{2})(?::(\d{2}(?:\.\d+)?))?$/.exec(time.trim());
  if (!d) throw new Error(`Invalid date "${date}" (expected YYYY-MM-DD)`);
  if (!t)
    throw new Error(`Invalid time "${time}" (expected HH:mm or HH:mm:ss)`);
  const [year, month, day] = [Number(d[1]), Number(d[2]), Number(d[3])];
  const [hour, minute, second] = [
    Number(t[1]),
    Number(t[2]),
    t[3] ? Number(t[3]) : 0,
  ];
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour > 23 ||
    minute > 59 ||
    second >= 60
  ) {
    throw new Error(`Out-of-range date/time "${date} ${time}"`);
  }
  return julianDayFromLocal(
    year,
    month,
    day,
    hour,
    minute,
    second,
    utcOffsetHours,
  );
}

export interface CalendarDate {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/** Gregorian calendar (UT) from JD. Meeus ch. 7. */
export function calendarFromJulianDay(jd: number): CalendarDate {
  const z = Math.floor(jd + 0.5);
  const f = jd + 0.5 - z;
  const alpha = Math.floor((z - 1867216.25) / 36524.25);
  const a = z + 1 + alpha - Math.floor(alpha / 4);
  const b = a + 1524;
  const c = Math.floor((b - 122.1) / 365.25);
  const d = Math.floor(365.25 * c);
  const e = Math.floor((b - d) / 30.6001);
  const day = b - d - Math.floor(30.6001 * e);
  const month = e < 14 ? e - 1 : e - 13;
  const year = month > 2 ? c - 4716 : c - 4715;
  let secs = Math.round(f * 86400 * 1000) / 1000;
  const hour = Math.floor(secs / 3600);
  secs -= hour * 3600;
  const minute = Math.floor(secs / 60);
  return { year, month, day, hour, minute, second: secs - minute * 60 };
}

export function jdToDate(jd: number): Date {
  return new Date(Math.round((jd - UNIX_EPOCH_JD) * 86400000));
}

export function dateToJd(date: Date): number {
  return date.getTime() / 86400000 + UNIX_EPOCH_JD;
}

export function jdToIso(jd: number): string {
  return jdToDate(jd).toISOString();
}

/** Decimal year for a JD (good enough for delta-T). */
export function decimalYear(jd: number): number {
  return 2000 + (jd - J2000) / 365.25;
}

/**
 * Delta-T = TT − UT in seconds (Espenak & Meeus 2006 polynomials).
 * Accuracy is ~1 s for 1900–2025; extrapolated beyond. A 1 s error moves
 * the Moon by ~0.5″, so this is ample for chart work.
 */
export function deltaTSeconds(year: number): number {
  const y = year;
  if (y < 1800 || y >= 2150) {
    const u = (y - 1820) / 100;
    return -20 + 32 * u * u;
  }
  if (y < 1860) {
    const t = y - 1800;
    return (
      13.72 -
      0.332447 * t +
      0.0068612 * t ** 2 +
      0.0041116 * t ** 3 -
      0.00037436 * t ** 4 +
      0.0000121272 * t ** 5 -
      0.0000001699 * t ** 6 +
      0.000000000875 * t ** 7
    );
  }
  if (y < 1900) {
    const t = y - 1860;
    return (
      7.62 +
      0.5737 * t -
      0.251754 * t ** 2 +
      0.01680668 * t ** 3 -
      0.0004473624 * t ** 4 +
      t ** 5 / 233174
    );
  }
  if (y < 1920) {
    const t = y - 1900;
    return (
      -2.79 +
      1.494119 * t -
      0.0598939 * t ** 2 +
      0.0061966 * t ** 3 -
      0.000197 * t ** 4
    );
  }
  if (y < 1941) {
    const t = y - 1920;
    return 21.2 + 0.84493 * t - 0.0761 * t ** 2 + 0.0020936 * t ** 3;
  }
  if (y < 1961) {
    const t = y - 1950;
    return 29.07 + 0.407 * t - t ** 2 / 233 + t ** 3 / 2547;
  }
  if (y < 1986) {
    const t = y - 1975;
    return 45.45 + 1.067 * t - t ** 2 / 260 - t ** 3 / 718;
  }
  if (y < 2005) {
    const t = y - 2000;
    return (
      63.86 +
      0.3345 * t -
      0.060374 * t ** 2 +
      0.0017275 * t ** 3 +
      0.000651814 * t ** 4 +
      0.00002373599 * t ** 5
    );
  }
  if (y < 2050) {
    const t = y - 2000;
    return 62.92 + 0.32217 * t + 0.005589 * t ** 2;
  }
  const u = (y - 1820) / 100;
  return -20 + 32 * u * u - 0.5628 * (2150 - y);
}

/** JD(TT) from JD(UT) using the polynomial delta-T. */
export function jdUtToTt(jdUT: number): number {
  return jdUT + deltaTSeconds(decimalYear(jdUT)) / 86400;
}
