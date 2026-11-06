/**
 * Divisional charts (vargas) per Brihat Parashara Hora Shastra, ch. 6–7
 * (Parashari schemes, as used by Jagannatha Hora / Swiss-based Indian software).
 *
 * Every function takes a sidereal longitude and returns the varga sign plus
 * the degree within that varga sign (the part's fraction scaled to 30°).
 */
import { normDeg } from "./types.js";
import type { SignIndex, VargaKey, VargaPosition } from "./types.js";

export const VARGA_DIVISIONS: Record<VargaKey, number> = {
  D1: 1,
  D2: 2,
  D3: 3,
  D4: 4,
  D7: 7,
  D9: 9,
  D10: 10,
  D12: 12,
  D16: 16,
  D20: 20,
  D24: 24,
  D27: 27,
  D30: 30,
  D40: 40,
  D45: 45,
  D60: 60,
};

export const VARGA_KEYS = Object.keys(VARGA_DIVISIONS) as VargaKey[];

export const VARGA_NAMES: Record<VargaKey, string> = {
  D1: "Rashi",
  D2: "Hora",
  D3: "Drekkana",
  D4: "Chaturthamsha",
  D7: "Saptamsha",
  D9: "Navamsha",
  D10: "Dashamsha",
  D12: "Dwadashamsha",
  D16: "Shodashamsha",
  D20: "Vimshamsha",
  D24: "Chaturvimshamsha",
  D27: "Saptavimshamsha (Bhamsha)",
  D30: "Trimshamsha",
  D40: "Khavedamsha",
  D45: "Akshavedamsha",
  D60: "Shashtiamsha",
};

const EPS = 1e-9;
const wrap = (n: number): SignIndex => (((n % 12) + 12) % 12) as SignIndex;

/** Odd signs in the Jyotish sense: Aries (index 0), Gemini, Leo ... */
const isOddSign = (sign: number) => sign % 2 === 0;
/** 0 movable, 1 fixed, 2 dual. */
const modality = (sign: number) => sign % 3;

// D30: [upper bound of segment in degrees, sign] for odd and even signs.
const D30_ODD: Array<[number, SignIndex]> = [
  [5, 0], // Mars → Aries
  [10, 10], // Saturn → Aquarius
  [18, 8], // Jupiter → Sagittarius
  [25, 2], // Mercury → Gemini
  [30, 6], // Venus → Libra
];
const D30_EVEN: Array<[number, SignIndex]> = [
  [5, 1], // Venus → Taurus
  [12, 5], // Mercury → Virgo
  [20, 11], // Jupiter → Pisces
  [25, 9], // Saturn → Capricorn
  [30, 7], // Mars → Scorpio
];

function trimshamsha(sign: number, deg: number): VargaPosition {
  const table = isOddSign(sign) ? D30_ODD : D30_EVEN;
  let lower = 0;
  for (const [upper, target] of table) {
    if (deg < upper - EPS || upper === 30) {
      return {
        sign: target,
        degreeInSign: ((deg - lower) / (upper - lower)) * 30,
      };
    }
    lower = upper;
  }
  /* istanbul ignore next */
  return { sign: table[table.length - 1][1], degreeInSign: 30 };
}

/** Varga position of a sidereal longitude for the given division. */
export function vargaPosition(
  siderealLongitude: number,
  varga: VargaKey,
): VargaPosition {
  const lon = normDeg(siderealLongitude);
  const sign = Math.floor(lon / 30 + EPS) % 12;
  const deg = Math.max(0, lon - sign * 30);
  const n = VARGA_DIVISIONS[varga];
  if (varga === "D30") return trimshamsha(sign, deg);

  const part = Math.min(n - 1, Math.floor((deg * n) / 30 + EPS));
  const degreeInSign = Math.max(0, deg * n - part * 30);
  const odd = isOddSign(sign);
  const mod = modality(sign);
  let target: number;

  switch (varga) {
    case "D1":
      target = sign;
      break;
    case "D2":
      // Parashari hora: odd sign → Sun (Leo) then Moon (Cancer); even sign → Moon then Sun.
      target = odd === (part === 0) ? 4 : 3;
      break;
    case "D3":
      target = sign + 4 * part; // 1st, 5th, 9th from the sign
      break;
    case "D4":
      target = sign + 3 * part; // 1st, 4th, 7th, 10th
      break;
    case "D7":
      target = odd ? sign + part : sign + 6 + part; // even signs start from the 7th
      break;
    case "D9":
      // Fire→Aries, Earth→Capricorn, Air→Libra, Water→Cancer: equivalent to a continuous count from Aries.
      target = sign * 9 + part;
      break;
    case "D10":
      target = odd ? sign + part : sign + 8 + part; // even signs start from the 9th
      break;
    case "D12":
      target = sign + part;
      break;
    case "D16":
      target = [0, 4, 8][mod] + part; // movable Aries, fixed Leo, dual Sagittarius
      break;
    case "D20":
      target = [0, 8, 4][mod] + part; // movable Aries, fixed Sagittarius, dual Leo
      break;
    case "D24":
      target = (odd ? 4 : 3) + part; // odd from Leo, even from Cancer
      break;
    case "D27":
      // Fire Aries, Earth Cancer, Air Libra, Water Capricorn: continuous count from Aries.
      target = sign * 27 + part;
      break;
    case "D40":
      target = (odd ? 0 : 6) + part; // odd from Aries, even from Libra
      break;
    case "D45":
      target = [0, 4, 8][mod] + part; // movable Aries, fixed Leo, dual Sagittarius
      break;
    case "D60":
      target = sign + part;
      break;
    default:
      throw new Error(`Unsupported varga ${varga as string}`);
  }
  return { sign: wrap(target), degreeInSign };
}
