export interface AdminSummaryUserInput {
  [key: string]: unknown;
  id?: string;
  email?: unknown;
  profile?: {
    name?: unknown;
    subscription?: {
      tier?: unknown;
      priceInr?: unknown;
    };
  };
  subscription?: {
    tier?: unknown;
    priceInr?: unknown;
  };
  credits?: unknown;
  creditsUsed?: unknown;
  usage?: {
    creditsUsed?: unknown;
  };
  updatedAt?: unknown;
}

export interface AdminSummaryUser {
  id: string;
  name: string | null;
  email: string | null;
  tier: "free" | "premium" | "pro";
  credits: number;
  updatedAt: string | null;
}

export interface AdminSummary {
  totalUsers: number;
  premiumUsers: number;
  proUsers: number;
  payingUsers: number;
  paidConversionRate: number;
  estimatedMrr: number;
  totalCreditsOutstanding: number;
  totalCreditsUsed: number;
  recentUsers: AdminSummaryUser[];
  /** "aggregate" = exact Firestore count()/sum(); "sample" = first N docs. */
  source?: "aggregate" | "sample";
  sampleSize?: number;
}

export interface AdminSummaryAggregates {
  totalUsers: number;
  premiumUsers: number;
  proUsers: number;
  /** sum(subscription.priceInr) across premium users (0 when unset). */
  premiumPriceSum?: number;
  /** premium users that have a subscription.priceInr set. */
  premiumPricedUsers?: number;
  proPriceSum?: number;
  proPricedUsers?: number;
  creditsOutstanding: number;
  creditsUsed: number;
  recentUsers: AdminSummaryUserInput[];
}

/**
 * Summary from exact aggregation queries (count()/sum() over the whole users
 * collection) instead of a capped sample. MRR uses each subscriber's stored
 * price where present and the list price for the rest.
 */
export function buildAdminSummaryFromAggregates(
  input: AdminSummaryAggregates,
  listPrices: { premium: number; pro: number } = { premium: 499, pro: 999 },
): AdminSummary {
  const nonNeg = (v: unknown) => Math.max(0, toNumber(v));
  const totalUsers = nonNeg(input.totalUsers);
  const premiumUsers = nonNeg(input.premiumUsers);
  const proUsers = nonNeg(input.proUsers);
  const payingUsers = premiumUsers + proUsers;
  const mrrFor = (
    count: number,
    priceSum: unknown,
    priced: unknown,
    listPrice: number,
  ) => {
    const pricedCount = Math.min(count, nonNeg(priced));
    return nonNeg(priceSum) + (count - pricedCount) * listPrice;
  };
  return {
    totalUsers,
    premiumUsers,
    proUsers,
    payingUsers,
    paidConversionRate:
      totalUsers > 0 ? roundOne((payingUsers / totalUsers) * 100) : 0,
    estimatedMrr:
      mrrFor(
        premiumUsers,
        input.premiumPriceSum,
        input.premiumPricedUsers,
        listPrices.premium,
      ) +
      mrrFor(proUsers, input.proPriceSum, input.proPricedUsers, listPrices.pro),
    totalCreditsOutstanding: nonNeg(input.creditsOutstanding),
    totalCreditsUsed: nonNeg(input.creditsUsed),
    recentUsers: input.recentUsers
      .map(sanitizeUser)
      .sort((a, b) => dateScore(b.updatedAt) - dateScore(a.updatedAt))
      .slice(0, 10),
    source: "aggregate",
  };
}

export function buildAdminSummary(
  users: AdminSummaryUserInput[],
): AdminSummary {
  const sanitizedUsers = users.map(sanitizeUser);
  const premiumUsers = sanitizedUsers.filter(
    (user) => user.tier === "premium",
  ).length;
  const proUsers = sanitizedUsers.filter((user) => user.tier === "pro").length;
  const payingUsers = premiumUsers + proUsers;
  const totalUsers = sanitizedUsers.length;
  const estimatedMrr = users.reduce((sum, user) => {
    const tier = normalizeTier(
      user.profile?.subscription?.tier ?? user.subscription?.tier,
    );
    if (tier === "free") return sum;
    const configuredPrice = toNumber(
      user.profile?.subscription?.priceInr ?? user.subscription?.priceInr,
    );
    return (
      sum +
      (configuredPrice > 0 ? configuredPrice : tier === "premium" ? 499 : 999)
    );
  }, 0);

  return {
    totalUsers,
    premiumUsers,
    proUsers,
    payingUsers,
    paidConversionRate:
      totalUsers > 0 ? roundOne((payingUsers / totalUsers) * 100) : 0,
    estimatedMrr,
    totalCreditsOutstanding: sanitizedUsers.reduce(
      (sum, user) => sum + user.credits,
      0,
    ),
    totalCreditsUsed: users.reduce(
      (sum, user) =>
        sum +
        Math.max(0, toNumber(user.creditsUsed ?? user.usage?.creditsUsed)),
      0,
    ),
    recentUsers: sanitizedUsers
      .sort((a, b) => dateScore(b.updatedAt) - dateScore(a.updatedAt))
      .slice(0, 10),
  };
}

function sanitizeUser(user: AdminSummaryUserInput): AdminSummaryUser {
  return {
    id: cleanString(user.id, 120) || "unknown",
    name: cleanString(user.profile?.name, 100) || null,
    email: cleanString(user.email, 160) || null,
    tier: normalizeTier(
      user.profile?.subscription?.tier ?? user.subscription?.tier,
    ),
    credits: Math.max(0, toNumber(user.credits)),
    updatedAt: normalizeDate(user.updatedAt),
  };
}

function normalizeTier(value: unknown): AdminSummaryUser["tier"] {
  return value === "premium" || value === "pro" ? value : "free";
}

function cleanString(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function toNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function normalizeDate(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime()))
    return value.toISOString();
  if (typeof value === "string" && value.trim()) return value;
  if (value && typeof value === "object" && "toDate" in value) {
    const date = (value as { toDate?: () => Date }).toDate?.();
    if (date instanceof Date && !Number.isNaN(date.getTime()))
      return date.toISOString();
  }
  return null;
}

function dateScore(value: string | null) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}
