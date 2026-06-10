import { Config, Context } from "@netlify/functions";
import Razorpay from "razorpay";
import { auth, db, FieldValue } from "./shared/firebase-admin";
import {
  buildTopupOrderOptions,
  getTopupProduct,
  isPaymentValidationError,
} from "./shared/razorpay-payments";

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
    const { idToken, minutes, amount } = await req.json();
    if (!idToken) {
      return new Response(JSON.stringify({ error: "Missing auth token" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const decoded = await auth.verifyIdToken(idToken);
    const product = getTopupProduct(Number(minutes));
    const options = buildTopupOrderOptions({
      uid: decoded.uid,
      minutes: product.minutes,
      expectedAmountInRupees: amount === undefined ? undefined : Number(amount),
    });

    const order = await instance.orders.create(options);
    await db.collection("paymentOrders").doc(order.id).set({
      uid: decoded.uid,
      razorpayOrderId: order.id,
      minutes: product.minutes,
      amountInRupees: product.amountInRupees,
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
