import crypto from "crypto";
import {
  CREDIT_PACKS,
  getPackAmount,
  getCreditPack,
} from "../../../src/lib/credit-packs.js";
import {
  DEFAULT_CURRENCY,
  normalizeCurrency,
  toMinorUnits,
  type Currency,
} from "../../../src/lib/currency.js";

export class PaymentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentValidationError";
    Object.setPrototypeOf(this, PaymentValidationError.prototype);
  }
}

export function isPaymentValidationError(
  error: unknown,
): error is PaymentValidationError {
  return error instanceof PaymentValidationError;
}

export interface TopupProduct {
  minutes: number;
  amountInRupees: number;
  currency: "INR";
}

export interface TopupOrderOptions {
  amount: number;
  currency: Currency;
  receipt: string;
  notes: {
    uid: string;
    minutes: string;
    type: "credit_topup";
  };
}

export function listTopupProducts(): TopupProduct[] {
  return CREDIT_PACKS.map(({ minutes, amountInRupees }) => ({
    minutes,
    amountInRupees,
    currency: "INR",
  }));
}

export function getTopupProduct(minutes: number): TopupProduct {
  const product = listTopupProducts().find((item) => item.minutes === minutes);
  if (!product) {
    throw new PaymentValidationError("Unsupported credit pack");
  }
  return product;
}

export function buildTopupOrderOptions(input: {
  uid: string;
  minutes: number;
  currency?: Currency;
  /** Client-confirmed price, in the order's own currency. */
  expectedAmount?: number;
  /** @deprecated Use expectedAmount. Only meaningful for INR orders. */
  expectedAmountInRupees?: number;
  now?: number;
}): TopupOrderOptions {
  if (!input.uid) throw new Error("Missing user id");
  const currency = normalizeCurrency(input.currency ?? DEFAULT_CURRENCY);
  const pack = getCreditPack(input.minutes);
  const amount = getPackAmount(pack, currency);

  // Validate the confirmation against this order's currency. Checking a USD
  // order against the rupee figure would let a user be charged $99 for a
  // ₹99 pack.
  const expected =
    input.expectedAmount ??
    (currency === DEFAULT_CURRENCY ? input.expectedAmountInRupees : undefined);
  if (expected !== undefined && expected !== amount) {
    throw new PaymentValidationError(
      "Requested amount does not match credit pack",
    );
  }

  return {
    amount: toMinorUnits(amount, currency),
    currency,
    receipt: `topup_${input.uid}_${input.now ?? Date.now()}`.slice(0, 40),
    notes: {
      uid: input.uid,
      minutes: String(pack.minutes),
      type: "credit_topup",
    },
  };
}

/**
 * Whether a currency may actually be charged.
 *
 * Razorpay requires international payments to be activated on the account
 * before it will accept a non-INR order. Refusing here with a clear message
 * beats an opaque gateway rejection at checkout.
 */
export function isCurrencyEnabled(
  currency: Currency,
  env: Record<string, string | undefined>,
): boolean {
  if (currency === DEFAULT_CURRENCY) return true;
  return env.RAZORPAY_INTERNATIONAL_ENABLED === "true";
}

export function verifyCheckoutSignature(input: {
  orderId: string;
  paymentId: string;
  signature: string;
  secret: string;
}) {
  if (!input.secret || !input.orderId || !input.paymentId || !input.signature) {
    return false;
  }
  const expected = crypto
    .createHmac("sha256", input.secret)
    .update(`${input.orderId}|${input.paymentId}`)
    .digest("hex");
  return timingSafeEqual(expected, input.signature);
}

export function verifyWebhookSignature(input: {
  body: string;
  signature: string;
  secret: string;
}) {
  if (!input.secret || !input.body || !input.signature) return false;
  const expected = crypto
    .createHmac("sha256", input.secret)
    .update(input.body)
    .digest("hex");
  return timingSafeEqual(expected, input.signature);
}

function timingSafeEqual(expected: string, actual: string) {
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);
  return (
    expectedBuffer.length === actualBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, actualBuffer)
  );
}
