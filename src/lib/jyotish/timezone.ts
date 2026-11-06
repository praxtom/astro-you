/**
 * Time zone resolution for birth data.
 *
 * - tzFromLatLng: IANA zone from coordinates (@photostructure/tz-lookup).
 * - resolveLocalTime / utcOffsetAt: UTC offset in force at a local wall-clock
 *   time, using the runtime's IANA database through Intl — so historic offsets
 *   (India +6:30 war time 1942–45, Pakistan +5:30 until 1951) and DST apply.
 *
 * Wall-clock times can be ambiguous (clocks fall back: the hour repeats) or
 * nonexistent (clocks spring forward: the hour is skipped). Both are reported
 * explicitly via `status`; `offsetHours` still carries a usable default:
 *   ambiguous   → the EARLIER instant (first occurrence, pre-transition offset)
 *   nonexistent → interpreted with the pre-transition offset, i.e. shifted
 *                 forward by the gap (same as Temporal's "compatible" mode).
 */
import tzlookup from "@photostructure/tz-lookup";

export function tzFromLatLng(lat: number, lng: number): string {
  return tzlookup(lat, lng);
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatter(tz: string): Intl.DateTimeFormat {
  let f = formatterCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      era: "short",
    });
    formatterCache.set(tz, f);
  }
  return f;
}

/** Offset (minutes, east positive) of `tz` at a UTC instant in epoch ms. */
export function offsetMinutesAtInstant(tz: string, epochMs: number): number {
  const parts = formatter(tz).formatToParts(new Date(epochMs));
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value);
  const era = parts.find((p) => p.type === "era")?.value;
  let year = get("year");
  if (era && /^B/i.test(era)) year = 1 - year;
  const wallAsUtc = Date.UTC(
    year,
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
    get("second"),
  );
  const flooredInstant = Math.floor(epochMs / 1000) * 1000;
  return Math.round((wallAsUtc - flooredInstant) / 1000) / 60;
}

export interface LocalDateTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second?: number;
}

export type LocalTimeResolution =
  | { status: "ok"; tz: string; offsetHours: number; utc: Date }
  | {
      status: "ambiguous";
      tz: string;
      /** Default: earlier occurrence. */
      offsetHours: number;
      utc: Date;
      /** Both valid offsets, earlier instant first. */
      candidates: Array<{ offsetHours: number; utc: Date }>;
    }
  | {
      status: "nonexistent";
      tz: string;
      /** Default: pre-transition offset (time shifted forward by the gap). */
      offsetHours: number;
      utc: Date;
      offsetBeforeHours: number;
      offsetAfterHours: number;
    };

export function parseLocalDateTime(date: string, time: string): LocalDateTime {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  const t = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(time.trim());
  if (!d || !t) throw new Error(`Invalid local date/time "${date} ${time}"`);
  return {
    year: Number(d[1]),
    month: Number(d[2]),
    day: Number(d[3]),
    hour: Number(t[1]),
    minute: Number(t[2]),
    second: t[3] ? Number(t[3]) : 0,
  };
}

/** Resolve a wall-clock time in an IANA zone to UTC, flagging DST gaps and overlaps. */
export function resolveLocalTime(
  tz: string,
  local: LocalDateTime,
): LocalTimeResolution {
  const wall = Date.UTC(
    local.year,
    local.month - 1,
    local.day,
    local.hour,
    local.minute,
    local.second ?? 0,
  );
  const DAY = 86400000;
  const probe = [wall - DAY, wall, wall + DAY].map((ms) =>
    offsetMinutesAtInstant(tz, ms),
  );
  const candidateOffsets = Array.from(new Set(probe));
  const valid: Array<{ offsetHours: number; utc: Date }> = [];
  for (const off of candidateOffsets) {
    const utc = wall - off * 60000;
    if (offsetMinutesAtInstant(tz, utc) === off)
      valid.push({ offsetHours: off / 60, utc: new Date(utc) });
  }
  valid.sort((a, b) => a.utc.getTime() - b.utc.getTime());
  if (valid.length === 1)
    return {
      status: "ok",
      tz,
      offsetHours: valid[0].offsetHours,
      utc: valid[0].utc,
    };
  if (valid.length > 1) {
    return {
      status: "ambiguous",
      tz,
      offsetHours: valid[0].offsetHours,
      utc: valid[0].utc,
      candidates: valid,
    };
  }
  const before = probe[0];
  const after = probe[2];
  return {
    status: "nonexistent",
    tz,
    offsetHours: before / 60,
    utc: new Date(wall - before * 60000),
    offsetBeforeHours: before / 60,
    offsetAfterHours: after / 60,
  };
}

/** UTC offset in hours at a local "YYYY-MM-DD" + "HH:mm[:ss]" in `tz` (see resolveLocalTime for gaps/overlaps). */
export function utcOffsetAt(
  tz: string,
  date: string,
  time: string,
): LocalTimeResolution {
  return resolveLocalTime(tz, parseLocalDateTime(date, time));
}
