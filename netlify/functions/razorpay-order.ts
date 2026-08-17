import { Config, Context } from "@netlify/functions";
import Razorpay from "razorpay";
import { auth, db, FieldValue } from "./shared/firebase-admin";
import {
  buildTopupOrderOptions,
  getTopupProduct,
  isPaymentValidationError,
  isCurrencyEnabled,
} from "./shared/razorpay-payments";
import { normalizeCurrency } from "../../src/lib/currency.js";
import { getCreditPack, getPackAmount } from "../../src/lib/credit-packs.js";

const instance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "",
});

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    console.error(
      "[Razorpay Order] Missing RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET",
    );
    return new Response(
      JSON.stringify({ error: "Payment is not configured" }),
      {
        status: 503,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  try {
    const { idToken, minutes, amount, currency } = await req.json();
    const orderCurrency = normalizeCurrency(currency);
    if (!idToken) {
      return new Response(JSON.stringify({ error: "Missing auth token" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Refuse a currency the Razorpay account cannot actually charge, before
    // creating an order that would fail opaquely at the gateway.
    if (!isCurrencyEnabled(orderCurrency, process.env)) {
      return new Response(
        JSON.stringify({
          error:
            "Card payments in this currency are not enabled yet. Please switch to INR.",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const decoded = await auth.verifyIdToken(idToken);
    const product = getTopupProduct(Number(minutes));
    const options = buildTopupOrderOptions({
      uid: decoded.uid,
      minutes: product.minutes,
      currency: orderCurrency,
      expectedAmount: amount === undefined ? undefined : Number(amount),
    });
    const displayAmount = getPackAmount(
      getCreditPack(product.minutes),
      orderCurrency,
    );

    const order = await instance.orders.create(options);
    await db.collection("paymentOrders").doc(order.id).set({
      uid: decoded.uid,
      razorpayOrderId: order.id,
      minutes: product.minutes,
      amountInRupees: product.amountInRupees,
      // The amount actually charged, in this order's currency and its minor
      // units. amountInPaise is retained for existing INR records.
      amount: displayAmount,
      amountInMinorUnits: options.amount,
      amountInPaise: options.amount,
      currency: options.currency,
      receipt: options.receipt,
      status: "created",
      createdAt: FieldValue.serverTimestamp(),
    });

    return new Response(
      JSON.stringify({
        ...order,
        minutes: product.minutes,
        amountInRupees: product.amountInRupees,
        // NOT `amount`: that key belongs to the spread Razorpay order and
        // carries minor units, which Checkout requires. Overwriting it with a
        // major-unit figure would charge 599 paise instead of $5.99.
        displayAmount,
        displayCurrency: options.currency,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error: unknown) {
    const status = isPaymentValidationError(error) ? 400 : 500;
    const message =
      error instanceof Error ? error.message : "Unable to create order";

    if (status === 500) {
      console.error(error);
    }

    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const config: Config = {
  path: "/api/pay/create-order",
};
