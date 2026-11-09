import type { Config, Context } from '@netlify/functions';
import { auth, db, FieldValue } from './shared/firebase-admin';
import {
  reconcileHostedCheckout,
  HostedPaymentError,
} from './shared/hosted-payments';
import { hostedProvider } from './shared/hosted-razorpay';
import { grantReferrerRewardAfterPayment } from './shared/referrals';
import { claimPaymentAnalytics } from './shared/payment-analytics';

export default async (req: Request, _context: Context) => {
  const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
  if (req.method !== 'POST') {
    return json({ error: 'Method Not Allowed' }, 405);
  }
  try {
    const body = await req.json();
    const { idToken } = body;
    let checkoutId = body.checkoutId;
    if (typeof idToken !== 'string') {
      return json({ error: 'Please sign in to check this payment.' }, 401);
    }
    const decoded = await auth.verifyIdToken(idToken).catch(() => null);
    if (!decoded) {
      return json({ error: 'Please sign in to check this payment.' }, 401);
    }
    if (checkoutId === undefined) {
      const customer = await db.collection('hostedPaymentCustomers').doc(decoded.uid).get();
      checkoutId = customer.data()?.lastCheckoutId;
      if (!checkoutId) return json({ status: 'none' });
    }
    if (typeof checkoutId !== 'string') {
      return json({ error: 'Missing checkout' }, 400);
    }
    const result = await reconcileHostedCheckout(
      { db, FieldValue }, hostedProvider, checkoutId, decoded.uid,
    );
    if (result.status === 'paid') {
      await grantReferrerRewardAfterPayment({ db, FieldValue }, decoded.uid, {
        source: 'topup', referenceId: checkoutId,
      }).catch(() => console.error('[Payment Status] Referral reward failed'));
    }
    // Only the consented confirmation page claims conversions. Passive Wallet
    // recovery must leave them available for that page.
    const paymentAnalytics = result.status === 'paid' && body.analyticsConsent === true
      ? await claimPaymentAnalytics({ db, FieldValue }, decoded.uid, checkoutId, true)
      : undefined;
    return json({ ...result, paymentAnalytics });
  } catch (error) {
    const status = error instanceof HostedPaymentError ? error.status : 500;
    const message = status === 500
      ? 'Could not confirm payment. Please try again shortly.'
      : (error as Error).message;
    return json({ error: message }, status);
  }
};

export const config: Config = { path: '/api/pay/status' };
