import {
  DEFAULT_CURRENCY,
  formatMoney,
  type Currency,
} from "./currency.js";

export interface CreditPack {
  minutes: number;
  /**
   * @deprecated Read via getPackAmount(pack, "INR"). Kept because
   * razorpay-payments and the Wallet page still reference it.
   */
  amountInRupees: number;
  /**
   * Per-currency price. USD is set for US willingness-to-pay rather than
   * converted from INR — a straight FX conversion of ₹49 is about $0.55, which
   * reads as valueless in that market.
   */
  amounts: Record<Currency, number>;
  label: string;
  description: string;
  badge?: string;
  recommended?: boolean;
}

export const CREDIT_PACKS: CreditPack[] = [
  {
    minutes: 50,
    amountInRupees: 49,
    amounts: { INR: 49, USD: 2.99 },
    label: "50 credits",
    description: "For a quick first consult or one small report.",
    badge: "Starter",
  },
  {
    minutes: 120,
    amountInRupees: 99,
    amounts: { INR: 99, USD: 5.99 },
    label: "120 credits",
    description: "Enough for a focused astrologer sitting.",
    badge: "Popular",
    recommended: true,
  },
  {
    minutes: 300,
    amountInRupees: 249,
    amounts: { INR: 249, USD: 14.99 },
    label: "300 credits",
    description: "For deeper guidance, reports, and follow-up questions.",
    badge: "Deep reading",
  },
  {
    minutes: 700,
    amountInRupees: 499,
    amounts: { INR: 499, USD: 29.99 },
    label: "700 credits",
    description: "Best value for regular weekly guidance.",
    badge: "Best value",
  },
];

export const DEFAULT_CREDIT_PACK =
  CREDIT_PACKS.find((item) => item.recommended) ?? CREDIT_PACKS[0];

export function getCreditPack(minutes: number): CreditPack {
  const pack = CREDIT_PACKS.find((item) => item.minutes === minutes);
  if (!pack) throw new Error("Unsupported credit pack");
  return pack;
}

export function getPackAmount(
  pack: CreditPack,
  currency: Currency = DEFAULT_CURRENCY,
): number {
  return pack.amounts[currency] ?? pack.amounts[DEFAULT_CURRENCY];
}

export function formatCreditRate(
  pack: CreditPack,
  currency: Currency = DEFAULT_CURRENCY,
): string {
  const rate = getPackAmount(pack, currency) / pack.minutes;
  return `${formatMoney(Number(rate.toFixed(2)), currency)}/credit`;
}
