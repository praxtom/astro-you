import { randomUUID } from 'node:crypto';
import {
  applyCreditChangeInTransaction,
  type CreditDeps,
} from './credits.js';
import {
  buildTopupOrderOptions,
  getTopupProduct,
  PaymentValidationError,
} from './razorpay-payments.js';
import {
  isRazorpayHostedUrl,
  safePaymentReturnPath,
} from '../../../src/lib/payment-navigation.js';
import type { Currency } from '../../../src/lib/currency.js';

export interface ProviderPayment {
  id: string;
  order_id?: string | null;
  amount: number | string;
  currency: string;
  status: string;
  amount_refunded?: number;
}

export interface ProviderLink {
  id: string;
  reference_id?: string;
  amount: number | string;
  currency?: string;
  amount_paid: number;
  status: string;
  short_url?: string;
  payments?: { payment_id: string }[] | null;
}

export interface HostedProvider {
  create(options: {
    amount: number;
    currency: string;
    reference_id: string;
    description: string;
    customer: Record<string, string>;
    accept_partial: false;
    expire_by: number;
    notify: { sms: false; email: false };
    reminder_enable: false;
    callback_url: string;
    callback_method: 'get';
    notes: Record<string, string>;
  }): Promise<ProviderLink>;
  find(reference: string): Promise<ProviderLink[]>;
  fetch(id: string): Promise<ProviderLink>;
  payment(id: string): Promise<ProviderPayment>;
}

interface CreateHostedInput {
  uid: string;
  minutes: number;
  currency: Currency;
  expectedAmount?: number;
  origin: string;
  returnPath?: unknown;
}

export class HostedPaymentError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

const CHECKOUT_TTL = 24 * 60 * 60 * 1000;
const CREATION_LEASE = 60 * 1000;

async function readCheckout(
  deps: CreditDeps,
  checkoutId: string,
  uid?: string,
) {
  if (!/^hc_[a-f0-9]{32}$/.test(checkoutId)) {
    throw new HostedPaymentError('Payment checkout not found', 404);
  }
  return deps.db.runTransaction(async (tx) => {
    const ref = deps.db.collection('hostedCheckouts').doc(checkoutId);
    const data = (await tx.get(ref)).data();
    if (!data) {
      throw new HostedPaymentError('Payment checkout not found', 404);
    }
    if (uid && data.uid !== uid) {
      throw new HostedPaymentError('Payment checkout belongs to another user', 403);
    }
    return data;
  });
}

export async function createHostedCheckout(
  deps: CreditDeps,
  provider: HostedProvider,
  input: CreateHostedInput,
): Promise<{ checkoutId: string; shortUrl: string; status: string }> {
  const options = buildTopupOrderOptions(input);
  const product = getTopupProduct(input.minutes);
  const now = Date.now();
  const slotKey = `${input.currency}_${input.minutes}`;
  const reservation = await deps.db.runTransaction(async (tx) => {
    const ownerRef = deps.db.collection('hostedPaymentCustomers').doc(input.uid);
    const owner = (await tx.get(ownerRef)).data() || {};
    const userRef = deps.db.collection('users').doc(input.uid);
    const user = (await tx.get(userRef)).data();
    if (!user) throw new HostedPaymentError('Account not found', 404);

    const priorId = owner.slots?.[slotKey];
    const prior = priorId
      ? (await tx.get(deps.db.collection('hostedCheckouts').doc(priorId))).data()
      : null;
    const reusable = prior && prior.expiresAtMs > now &&
      !['paid', 'refunded', 'cancelled', 'expired'].includes(prior.status);
    if (reusable) {
      if (!prior.razorpayPaymentLinkId && prior.leaseUntilMs > now) {
        throw new HostedPaymentError(
          'Checkout is being prepared. Please try again shortly.', 409,
        );
      }
      tx.set(deps.db.collection('hostedCheckouts').doc(priorId), {
        leaseUntilMs: now + CREATION_LEASE,
      }, { merge: true });
      tx.set(ownerRef, { lastCheckoutId: priorId }, { merge: true });
      return { id: priorId as string, data: prior, reused: true };
    }

    const recent: number[] = (owner.attempts || []).filter(
      (time: number) => time > now - 15 * 60 * 1000,
    );
    if (recent.length >= 5) {
      throw new HostedPaymentError(
        'Please wait before starting another checkout.', 429,
      );
    }
    const id = `hc_${randomUUID().replaceAll('-', '')}`;
    const data = {
      uid: input.uid,
      minutes: product.minutes,
      amountInRupees: product.amountInRupees,
      amount: Number(options.amount) / 100,
      amountInMinorUnits: options.amount,
      currency: options.currency,
      returnPath: safePaymentReturnPath(input.returnPath),
      status: 'creating',
      createdAtMs: now,
      expiresAtMs: now + CHECKOUT_TTL,
      leaseUntilMs: now + CREATION_LEASE,
    };
    // This reservation survives a provider success followed by a failed write.
    tx.set(deps.db.collection('hostedCheckouts').doc(id), data);
    tx.set(ownerRef, {
      slots: { [slotKey]: id },
      lastCheckoutId: id,
      attempts: [...recent, now],
    }, { merge: true });
    return { id, data, reused: false };
  });

  const record: Record<string, any> = reservation.data;
  let link: ProviderLink | undefined;
  if (record.razorpayPaymentLinkId) {
    link = await provider.fetch(record.razorpayPaymentLinkId);
  } else if (reservation.reused) {
    link = (await provider.find(reservation.id))[0];
  }
  if (!link) {
    link = await provider.create({
      amount: Number(options.amount),
      currency: options.currency,
      reference_id: reservation.id,
      description: `${product.minutes} AstroYou credits`,
      customer: {},
      accept_partial: false,
      expire_by: Math.floor(record.expiresAtMs / 1000),
      notify: { sms: false, email: false },
      reminder_enable: false,
      callback_url: `${input.origin}/payment/return?checkout=${reservation.id}`,
      callback_method: 'get',
      notes: { hostedCheckoutId: reservation.id, type: 'credit_topup' },
    });
  }
  validateLink(record, reservation.id, link);
  if (reservation.reused && ['expired', 'cancelled'].includes(link.status)) {
    const terminalStatus = link.status;
    await deps.db.runTransaction(async (tx) => {
      const ref = deps.db.collection('hostedCheckouts').doc(reservation.id);
      await tx.get(ref);
      tx.set(ref, { status: terminalStatus, leaseUntilMs: 0 }, { merge: true });
    });
    return createHostedCheckout(deps, provider, input);
  }
  const resolvedLink = link;
  if (!isRazorpayHostedUrl(resolvedLink.short_url)) {
    throw new HostedPaymentError(
      'Hosted checkout is unavailable. Please try again shortly.', 502,
    );
  }
  const shortUrl = resolvedLink.short_url;
  await deps.db.runTransaction(async (tx) => {
    const ref = deps.db.collection('hostedCheckouts').doc(reservation.id);
    const current = (await tx.get(ref)).data();
    const status = ['paid', 'refunded'].includes(current?.status)
      ? current?.status
      : resolvedLink.status;
    tx.set(ref, {
      razorpayPaymentLinkId: resolvedLink.id,
      shortUrl,
      status,
      leaseUntilMs: 0,
    }, { merge: true });
  });
  return { checkoutId: reservation.id, shortUrl, status: resolvedLink.status };
}

function validateLink(
  record: Record<string, any>,
  checkoutId: string,
  link: ProviderLink,
) {
  if (
    link.reference_id !== checkoutId ||
    (record.razorpayPaymentLinkId && record.razorpayPaymentLinkId !== link.id) ||
    Number(link.amount) !== record.amountInMinorUnits ||
    link.currency !== record.currency
  ) {
    throw new PaymentValidationError('Payment link mismatch');
  }
}

/** Reads the order, refund marker and user in the same transaction as the grant. */
export async function settleTopupPayment(
  deps: CreditDeps,
  input: {
    orderId: string;
    payment: ProviderPayment;
    uid?: string;
    checkoutId?: string;
  },
) {
  const { payment, orderId } = input;
  return deps.db.runTransaction(async (tx) => {
    const orderRef = deps.db.collection('paymentOrders').doc(orderId);
    const existing = (await tx.get(orderRef)).data();
    const checkoutRef = input.checkoutId
      ? deps.db.collection('hostedCheckouts').doc(input.checkoutId)
      : null;
    const checkout = checkoutRef ? (await tx.get(checkoutRef)).data() : null;
    const order = checkout || existing;
    if (!order || (existing && checkout && (
      existing.uid !== checkout.uid || existing.hostedCheckoutId !== input.checkoutId
    ))) {
      throw new HostedPaymentError('Payment order not found', 404);
    }
    if (input.uid && order.uid !== input.uid) {
      throw new HostedPaymentError('Payment order belongs to another user', 403);
    }
    if (
      payment.order_id !== orderId ||
      Number(payment.amount) !== Number(order.amountInMinorUnits ?? order.amountInPaise ??
        (order.amount ?? order.amountInRupees) * 100) ||
      payment.currency !== (order.currency || 'INR')
    ) {
      throw new PaymentValidationError('Payment amount or currency mismatch');
    }
    const userRef = deps.db.collection('users').doc(order.uid);
    const user = (await tx.get(userRef)).data();
    const refundRef = deps.db.collection('paymentRefunds').doc(payment.id);
    const refund = (await tx.get(refundRef)).data();
    const refunded = payment.status === 'refunded' || Number(payment.amount_refunded) > 0 ||
      refund?.blocked || refund?.refundIds?.length ||
      ['refunded', 'partially_refunded'].includes(existing?.status) ||
      order.status === 'refunded';
    let result = { balanceAfter: user?.credits ?? 0, duplicate: false };
    let status = refunded ? 'refunded' : 'pending';
    if (user && !refunded && payment.status === 'captured') {
      result = await applyCreditChangeInTransaction(tx, deps, userRef, {
        uid: order.uid,
        amount: Number(order.minutes),
        type: 'purchase',
        source: 'razorpay',
        referenceId: payment.id,
        ledgerId: `razorpay_${payment.id}`,
        metadata: {
          razorpay_order_id: orderId,
          razorpay_payment_id: payment.id,
          paymentOrderId: orderId,
          currency: order.currency || 'INR',
          amount: order.amount ?? order.amountInRupees,
        },
      }, user.credits ?? 0);
      status = 'paid';
    }
    if (!user) status = 'account_missing';
    if (status !== 'pending') {
      tx.set(orderRef, {
        ...order,
        ...(input.checkoutId ? { hostedCheckoutId: input.checkoutId } : {}),
        razorpayOrderId: orderId,
        razorpayPaymentId: payment.id,
        status,
        balanceAfter: result.balanceAfter,
        settledAt: deps.FieldValue.serverTimestamp(),
        ...(status === 'paid' ? { paidAt: deps.FieldValue.serverTimestamp(), duplicate: result.duplicate } : {}),
      }, { merge: true });
      if (checkoutRef) {
        tx.set(checkoutRef, {
          status,
          razorpayOrderId: orderId,
          razorpayPaymentId: payment.id,
          balanceAfter: result.balanceAfter,
        }, { merge: true });
      }
    }
    return {
      status,
      uid: order.uid as string,
      minutes: Number(order.minutes),
      ...result,
    };
  });
}

export async function reconcileHostedCheckout(
  deps: CreditDeps,
  provider: HostedProvider,
  checkoutId: string,
  uid?: string,
) {
  const record = await readCheckout(deps, checkoutId, uid);
  const link = record.razorpayPaymentLinkId
    ? await provider.fetch(record.razorpayPaymentLinkId)
    : (await provider.find(checkoutId))[0];
  const base = {
    checkoutId,
    returnPath: safePaymentReturnPath(record.returnPath),
    minutes: Number(record.minutes),
  };
  if (!link) return { ...base, status: 'pending' };
  validateLink(record, checkoutId, link);
  const shortUrl = isRazorpayHostedUrl(link.short_url) ? link.short_url : undefined;
  if (link.status !== 'paid' || link.amount_paid !== record.amountInMinorUnits) {
    const status = ['expired', 'cancelled', 'partially_paid'].includes(link.status)
      ? link.status
      : 'pending';
    return { ...base, status, shortUrl };
  }
  const payments = Array.isArray(link.payments) ? link.payments : [];
  if (payments.length !== 1) return { ...base, status: 'pending' };
  const payment = await provider.payment(payments[0].payment_id);
  if (payment.id !== payments[0].payment_id || !payment.order_id) {
    throw new PaymentValidationError('Payment identity mismatch');
  }
  const result = await settleTopupPayment(deps, {
    orderId: payment.order_id, payment, uid, checkoutId,
  });
  return { ...base, ...result };
}
