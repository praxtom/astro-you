export interface CreditPack {
  minutes: number;
  amountInRupees: number;
  label: string;
  description: string;
  badge?: string;
  recommended?: boolean;
}

export const CREDIT_PACKS: CreditPack[] = [
  {
    minutes: 50,
    amountInRupees: 49,
    label: "50 credits",
    description: "For a quick first consult or one small report.",
    badge: "Starter",
  },
  {
    minutes: 120,
    amountInRupees: 99,
    label: "120 credits",
    description: "Enough for a focused AI astrologer session.",
    badge: "Popular",
    recommended: true,
  },
  {
    minutes: 300,
    amountInRupees: 249,
    label: "300 credits",
    description: "For deeper guidance, reports, and follow-up questions.",
    badge: "Deep reading",
  },
  {
    minutes: 700,
    amountInRupees: 499,
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

export function formatCreditRate(pack: CreditPack): string {
  const rate = pack.amountInRupees / pack.minutes;
  return `₹${rate < 1 ? rate.toFixed(2) : rate.toFixed(1)}/credit`;
}
