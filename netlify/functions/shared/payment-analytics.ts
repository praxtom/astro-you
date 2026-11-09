import type { CreditDeps } from './credits.js';

interface PaymentAnalyticsClaim {
  creditTopupCompleted: boolean;
  firstPayment: boolean;
  amount?: number;
  currency?: string;
  minutes?: number;
}

/** Best-effort analytics flags, independent of credit settlement. */
export async function claimPaymentAnalytics(
  deps: CreditDeps,
  uid: string,
  checkoutId: string,
  consentGranted: boolean,
): Promise<PaymentAnalyticsClaim> {
  const none = { creditTopupCompleted: false, firstPayment: false };
  if (!consentGranted) return none;
  try {
    return await deps.db.runTransaction(async (tx) => {
      const checkoutRef = deps.db.collection('hostedCheckouts').doc(checkoutId);
      const customerRef = deps.db.collection('hostedPaymentCustomers').doc(uid);
      const checkout = (await tx.get(checkoutRef)).data();
      const customer = (await tx.get(customerRef)).data();
      if (checkout?.uid !== uid || checkout.status !== 'paid' || checkout.analyticsClaimed) {
        return none;
      }
      const firstPayment = !customer?.firstPaymentAnalyticsClaimed;
      tx.set(checkoutRef, { analyticsClaimed: true }, { merge: true });
      if (firstPayment) {
        tx.set(customerRef, { firstPaymentAnalyticsClaimed: true }, { merge: true });
      }
      return {
        creditTopupCompleted: true,
        firstPayment,
        amount: checkout.amount,
        currency: checkout.currency,
        minutes: checkout.minutes,
      };
    });
  } catch {
    // A failed analytics claim must never turn a settled payment into an error.
    return none;
  }
}
