/**
 * Rules shared by both onboarding flows (pages/Onboarding and
 * components/OnboardingModal), so the page and the modal can't drift.
 */

/** Minimum age for the service (Terms: not for under-18s). */
export const MIN_AGE_YEARS = 18;

/**
 * parse-kundali caps the request body at ~6MB of base64, which is ~4.5MB of
 * image. Checking the file here gives a clear message instead of a failed upload.
 */
export const MAX_CHART_UPLOAD_BYTES = 4.5 * 1024 * 1024;
export const CHART_UPLOAD_TOO_LARGE =
  "That image is over 4.5 MB. Try a smaller photo or a screenshot of the chart.";

/** The viewer's local calendar day as YYYY-MM-DD (the date input's format). */
export function todayInputValue(at: Date = new Date()): string {
  const y = at.getFullYear();
  const m = String(at.getMonth() + 1).padStart(2, "0");
  const d = String(at.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Whole years between a YYYY-MM-DD birth date and `at` (local calendar). */
export function ageInYears(dob: string, at: Date = new Date()): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  let age = at.getFullYear() - year;
  const beforeBirthday =
    at.getMonth() + 1 < month ||
    (at.getMonth() + 1 === month && at.getDate() < day);
  if (beforeBirthday) age -= 1;
  return age;
}

/**
 * A user-facing problem with the birth date, or null when it is acceptable.
 * Empty input returns null — the "required" check is the caller's.
 */
export function birthDateProblem(
  dob: string,
  at: Date = new Date(),
): string | null {
  if (!dob) return null;
  if (dob > todayInputValue(at)) {
    return "That date is in the future. Please check your birth date.";
  }
  const age = ageInYears(dob, at);
  if (age === null) return "Please enter a valid birth date.";
  if (age < MIN_AGE_YEARS) {
    return "Thank you for your interest. AstroYou is made for adults, so you need to be 18 or older to use it.";
  }
  return null;
}
