/**
 * Plain-language labels for the raw values the wallet stores.
 *
 * The server writes machine words into Firestore (`users/{uid}/creditLedger`,
 * `consultations`, `reports`). Nothing here should ever reach the screen as
 * snake_case. Known values come from:
 *
 * Ledger `type` (netlify/functions/shared/credits.ts → CreditChangeType).
 *
 * Ledger `source`:
 *   account_initialization  shared/credits.ts (signup bonus)
 *   razorpay                shared/hosted-payments.ts (credit pack purchase)
 *   razorpay_subscription   subscription-webhook.ts (plan credits)
 *   razorpay_refund         shared/payment-refunds.ts (refund clawback)
 *   referral                referral-claim.ts, shared/referrals.ts
 *   synthesis_chat / synthesis_refund            synthesis.ts
 *   consult_end                                  shared/consult-session.ts
 *   pdf_report / pdf_report_refund               pdf-report.ts, shared/report-access.ts
 *   feature_<f> / feature_<f>_refund             shared/feature-charge.ts
 *     (<f> = horoscope_weekly | horoscope_monthly | horoscope_yearly |
 *      transit | compatibility — shared/feature-credits.ts)
 *   admin                                        admin-credit-adjustment.ts
 *
 * Status:
 *   consultations: active | ended | failed | refunded  (shared/consult-session.ts)
 *   reports:       generating | completed | failed     (pdf-report.ts, shared/report-access.ts)
 */

/** "horoscope_weekly" → "Horoscope Weekly". Never returns snake_case. */
export function humanizeValue(raw: string): string {
  return raw
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function normalizeKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

/** Metered readings charged through shared/feature-charge.ts. */
const FEATURE_LABELS: Record<string, string> = {
  horoscope_weekly: "Weekly forecast",
  horoscope_monthly: "Monthly forecast",
  horoscope_yearly: "Yearly forecast",
  transit: "Transit reading",
  compatibility: "Compatibility reading",
};

const SOURCE_LABELS: Record<string, string> = {
  // Purchases and plans
  razorpay: "Card/UPI purchase",
  topup: "Card/UPI purchase",
  purchase: "Card/UPI purchase",
  razorpay_subscription: "Plan credits",
  subscription: "Plan credits",
  razorpay_refund: "Refunded to your card/UPI",
  // Gifts
  account_initialization: "Welcome credits",
  signup_bonus: "Welcome credits",
  referral: "Referral reward",
  referral_bonus: "Referral reward",
  // Spending
  synthesis_chat: "Chat message",
  synthesis: "Chat message",
  synthesis_refund: "Chat message refunded",
  consult_end: "Guide session",
  consult: "Guide session",
  consult_session: "Guide session",
  consultation: "Guide session",
  pdf_report: "PDF report",
  report: "PDF report",
  pdf_report_refund: "PDF report refunded",
  // Account
  admin: "Adjusted by support",
  admin_adjustment: "Adjusted by support",
  system: "Automatic",
};

/** Where a credit change came from, in plain words. */
export function activityLabel(source?: string | null): string {
  if (typeof source !== "string" || !source.trim()) return "";
  const key = normalizeKey(source);
  const known = SOURCE_LABELS[key];
  if (known) return known;

  const feature = /^feature_(.+?)(_refund)?$/.exec(key);
  if (feature) {
    const name = FEATURE_LABELS[feature[1]] ?? humanizeValue(feature[1]);
    return feature[2] ? `${name} refunded` : name;
  }

  return humanizeValue(source);
}

const LEDGER_TYPE_LABELS: Record<string, string> = {
  purchase: "Credit purchase",
  consultation: "Guide session",
  synthesis: "Jyotish chat",
  feature: "Reading",
  report: "PDF report",
  refund: "Refund",
  refund_clawback: "Payment refunded — credits removed",
  admin_adjustment: "Adjustment",
  subscription_grant: "Plan credits",
  signup_bonus: "Welcome credits",
  referral_bonus: "Referral reward",
};

/** Headline for a ledger entry, from its `type`. */
export function ledgerTypeLabel(type?: string | null): string {
  if (typeof type !== "string" || !type.trim()) return "Credit activity";
  return LEDGER_TYPE_LABELS[normalizeKey(type)] ?? humanizeValue(type);
}

const STATUS_LABELS: Record<string, string> = {
  completed: "Done",
  complete: "Done",
  ended: "Done",
  success: "Done",
  succeeded: "Done",
  paid: "Done",
  captured: "Done",
  active: "In progress",
  in_progress: "In progress",
  generating: "Preparing",
  pending: "Processing",
  processing: "Processing",
  created: "Processing",
  refunded: "Refunded",
  failed: "Didn't go through",
  error: "Didn't go through",
  cancelled: "Cancelled",
  canceled: "Cancelled",
  expired: "Expired",
};

/** Status of a session, report or payment, in plain words. */
export function statusLabel(status?: string | null): string {
  if (typeof status !== "string" || !status.trim()) return "";
  return STATUS_LABELS[normalizeKey(status)] ?? humanizeValue(status);
}
