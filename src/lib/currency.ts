/**
 * Currency model.
 *
 * Deliberately free of any payment-processor types so a second processor can be
 * added later without redoing the pricing model. Razorpay-specific concerns
 * (order shape, the international-activation flag) live in
 * netlify/functions/shared/razorpay-payments.ts.
 */
export const SUPPORTED_CURRENCIES = ["INR", "USD"] as const;
export type Currency = (typeof SUPPORTED_CURRENCIES)[number];

/** India remains the primary market; other currencies are additive. */
export const DEFAULT_CURRENCY: Currency = "INR";

export function normalizeCurrency(value: unknown): Currency {
  if (typeof value !== "string") return DEFAULT_CURRENCY;
  const upper = value.toUpperCase();
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(upper)
    ? (upper as Currency)
    : DEFAULT_CURRENCY;
}

/**
 * Convert a display amount to the processor's minor units. Both supported
 * currencies have 100 minor units (paise, cents), so one factor covers both.
 *
 * Rounds because float multiplication of a decimal price is not exact:
 * 19.99 * 100 === 1998.9999999999998, and truncating that undercharges by a
 * cent.
 */
export function toMinorUnits(amount: number, _currency: Currency): number {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error(`Invalid money amount: ${amount}`);
  }
  return Math.round(amount * 100);
}

const LOCALE_FOR: Record<Currency, string> = {
  INR: "en-IN",
  USD: "en-US",
};

export function formatMoney(
  amount: number,
  currency: Currency,
  locale?: string,
): string {
  // Whole amounts read better without ".00" — ₹499, not ₹499.00.
  const isWhole = Number.isInteger(amount);
  return new Intl.NumberFormat(locale || LOCALE_FOR[currency], {
    style: "currency",
    currency,
    minimumFractionDigits: isWhole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Best-effort currency for a new viewer. The locale's region wins; the timezone
 * is a tiebreaker for bare locales like "en". Anything unrecognised stays INR
 * rather than guessing — showing someone the wrong currency is worse than
 * showing them the default.
 */
export function detectCurrency(
  locale?: string | null,
  timezone?: string | null,
): Currency {
  const region = typeof locale === "string" ? locale.split("-")[1] : undefined;
  if (region) {
    const upper = region.toUpperCase();
    if (upper === "US") return "USD";
    if (upper === "IN") return "INR";
  }
  if (typeof timezone === "string" && timezone.startsWith("America/")) {
    return "USD";
  }
  return DEFAULT_CURRENCY;
}
