import { ENTITLEMENTS } from "./entitlements.js";

/**
 * Credits granted once when an account is created. The server grants
 * getUsageLimit("free", "monthlyCredits") as the signup bonus
 * (netlify/functions/shared/credits.ts → initializeUserCredits), and the client
 * entitlements mirror the server table (billing-entitlements-parity test).
 */
export const SIGNUP_BONUS_CREDITS = ENTITLEMENTS.free.limits.monthlyCredits;
