import crypto from "crypto";
import { CREDIT_PACKS } from "../../../src/lib/credit-packs.js";

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
  currency: "INR";
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
  expectedAmountInRupees?: number;
  now?: number;
}): TopupOrderOptions {
  if (!input.uid) throw new Error("Missing user id");
  const product = getTopupProduct(input.minutes);
  if (
    input.expectedAmountInRupees !== undefined &&
    input.expectedAmountInRupees !== product.amountInRupees
  ) {
    throw new PaymentValidationError("Requested amount does not match credit pack");
  }

  return {
    amount: product.amountInRupees * 100,
    currency: product.currency,
    receipt: `topup_${input.uid}_${input.now ?? Date.now()}`.slice(0, 40),
    notes: {
      uid: input.uid,
      minutes: String(product.minutes),
      type: "credit_topup",
    },
  };
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
