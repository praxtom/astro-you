/**
 * Numerology: Pythagorean and Chaldean letter values, core numbers.
 * Master numbers 11, 22, 33 are kept unreduced (Pythagorean convention).
 *
 *  - Life path: reduce month, day and year separately, then sum and reduce.
 *  - Destiny / expression: all letters of the full name.
 *  - Soul urge (heart's desire): vowels A E I O U (Y treated as consonant).
 *  - Personality: consonants.
 *  - Birthday: day of month reduced.
 *  - Chaldean name number: Chaldean values (1–8, no 9), compound total reduced.
 */

const MASTER = new Set([11, 22, 33]);

export function reduceNumber(n: number, keepMaster = true): number {
  let x = Math.abs(Math.trunc(n));
  while (x > 9 && !(keepMaster && MASTER.has(x))) {
    x = String(x)
      .split("")
      .reduce((s, d) => s + Number(d), 0);
  }
  return x;
}

export function pythagoreanValue(letter: string): number {
  const c = letter.toUpperCase().charCodeAt(0);
  if (c < 65 || c > 90) return 0;
  return ((c - 65) % 9) + 1;
}

const CHALDEAN: Record<string, number> = {
  A: 1,
  I: 1,
  J: 1,
  Q: 1,
  Y: 1,
  B: 2,
  K: 2,
  R: 2,
  C: 3,
  G: 3,
  L: 3,
  S: 3,
  D: 4,
  M: 4,
  T: 4,
  E: 5,
  H: 5,
  N: 5,
  X: 5,
  U: 6,
  V: 6,
  W: 6,
  O: 7,
  Z: 7,
  F: 8,
  P: 8,
};

export function chaldeanValue(letter: string): number {
  return CHALDEAN[letter.toUpperCase()] ?? 0;
}

const VOWELS = new Set(["A", "E", "I", "O", "U"]);

function letters(name: string): string[] {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .split("")
    .filter((ch) => ch >= "A" && ch <= "Z");
}

function sumWords(
  name: string,
  value: (l: string) => number,
  filter: (l: string) => boolean,
): number {
  // Reduce each word first (standard practice), then reduce the total.
  const words = name.split(/\s+/).filter(Boolean);
  let total = 0;
  for (const w of words) {
    const s = letters(w)
      .filter(filter)
      .reduce((acc, l) => acc + value(l), 0);
    total += reduceNumber(s);
  }
  return reduceNumber(total);
}

export function lifePathNumber(
  year: number,
  month: number,
  day: number,
): number {
  return reduceNumber(
    reduceNumber(year) + reduceNumber(month) + reduceNumber(day),
  );
}

export function birthdayNumber(day: number): number {
  return reduceNumber(day);
}

export function destinyNumber(fullName: string): number {
  return sumWords(fullName, pythagoreanValue, () => true);
}

export function soulUrgeNumber(fullName: string): number {
  return sumWords(fullName, pythagoreanValue, (l) => VOWELS.has(l));
}

export function personalityNumber(fullName: string): number {
  return sumWords(fullName, pythagoreanValue, (l) => !VOWELS.has(l));
}

export interface ChaldeanNameNumber {
  compound: number;
  reduced: number;
}

export function chaldeanNameNumber(name: string): ChaldeanNameNumber {
  const compound = letters(name).reduce((s, l) => s + chaldeanValue(l), 0);
  return { compound, reduced: reduceNumber(compound, false) };
}

export interface NumerologyProfile {
  lifePath: number;
  destiny: number;
  soulUrge: number;
  personality: number;
  birthday: number;
  chaldean: ChaldeanNameNumber;
  masterNumbers: number[];
}

/** Full profile from a name and a YYYY-MM-DD birth date. */
export function numerologyProfile(
  fullName: string,
  birthDate: string,
): NumerologyProfile {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate);
  if (!m) throw new Error(`Invalid birth date "${birthDate}"`);
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const profile = {
    lifePath: lifePathNumber(y, mo, d),
    destiny: destinyNumber(fullName),
    soulUrge: soulUrgeNumber(fullName),
    personality: personalityNumber(fullName),
    birthday: birthdayNumber(d),
    chaldean: chaldeanNameNumber(fullName),
  };
  const masterNumbers = [
    profile.lifePath,
    profile.destiny,
    profile.soulUrge,
    profile.personality,
    profile.birthday,
  ].filter((n) => MASTER.has(n));
  return { ...profile, masterNumbers: Array.from(new Set(masterNumbers)) };
}
