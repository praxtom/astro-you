import test from 'node:test';
import assert from 'node:assert/strict';
import { createFakeFirestore } from './helpers/fake-firestore.js';
import { createHostedCheckout, reconcileHostedCheckout, settleTopupPayment, type HostedProvider } from '../shared/hosted-payments.js';
import { applyRefundClawback } from '../shared/payment-refunds.js';

function setup() {
  const fake = createFakeFirestore({ 'users/u1': { credits: 10 } });
  let creates = 0;
  const link = { id: 'plink_1', reference_id: '', amount: 4900, currency: 'INR', amount_paid: 0, status: 'created', short_url: 'https://rzp.io/i/test', payments: [] as { payment_id: string }[] };
  const payment = { id: 'pay_1', order_id: 'order_1', amount: 4900, currency: 'INR', status: 'captured', amount_refunded: 0 };
  const provider: HostedProvider = {
    async create(options) { creates++; link.reference_id = options.reference_id; link.status = 'created'; return { ...link }; },
    async find(reference) { return creates && reference === link.reference_id ? [{ ...link }] : []; },
    async fetch() { return { ...link }; },
    async payment() { return { ...payment }; },
  };
  const create = () => createHostedCheckout(fake, provider, { uid: 'u1', minutes: 50, currency: 'INR', expectedAmount: 49, origin: 'https://astroyou.app', returnPath: '/wallet' });
  const paid = () => { link.status = 'paid'; link.amount_paid = 4900; link.payments = [{ payment_id: 'pay_1' }]; };
  return { fake, provider, link, payment, create, paid, creates: () => creates };
}

test('hosted checkout reserves server-owned price before creation and reuses a pending link', async () => {
  const s = setup();
  const first = await s.create();
  assert.equal(s.fake.get(`hostedCheckouts/${first.checkoutId}`)?.amountInMinorUnits, 4900);
  assert.equal((await s.create()).checkoutId, first.checkoutId);
  assert.equal(s.creates(), 1);
  await assert.rejects(createHostedCheckout(s.fake, s.provider, { uid: 'u1', minutes: 50, currency: 'INR', expectedAmount: 1, origin: 'https://astroyou.app' }));
});

test('status enforces ownership and captured full amount, then grants exactly once without browser claims', async () => {
  const s = setup(); const { checkoutId } = await s.create(); s.paid();
  await assert.rejects(reconcileHostedCheckout(s.fake, s.provider, checkoutId, 'another'), /another user/);
  s.payment.status = 'authorized';
  assert.equal((await reconcileHostedCheckout(s.fake, s.provider, checkoutId, 'u1')).status, 'pending');
  s.payment.status = 'captured'; s.payment.amount = 1;
  await assert.rejects(reconcileHostedCheckout(s.fake, s.provider, checkoutId, 'u1'), /mismatch/);
  s.payment.amount = 4900;
  assert.equal((await reconcileHostedCheckout(s.fake, s.provider, checkoutId, 'u1')).status, 'paid');
  await reconcileHostedCheckout(s.fake, s.provider, checkoutId, 'u1');
  assert.equal(s.fake.get('users/u1')?.credits, 60);
  assert.equal(s.fake.get('paymentOrders/order_1')?.hostedCheckoutId, checkoutId);
});

test('paid link recovers from missing provider-id write using durable reference', async () => {
  const s = setup(); const { checkoutId } = await s.create(); s.paid();
  delete s.fake.get(`hostedCheckouts/${checkoutId}`)!.razorpayPaymentLinkId;
  await reconcileHostedCheckout(s.fake, s.provider, checkoutId);
  assert.equal(s.fake.get('users/u1')?.credits, 60);
});

test('refund markers block delayed hosted capture and deleted users stay deleted', async () => {
  const s = setup(); const { checkoutId } = await s.create(); s.paid();
  s.fake.store.set('paymentRefunds/pay_1', { blocked: true });
  assert.equal((await reconcileHostedCheckout(s.fake, s.provider, checkoutId)).status, 'refunded');
  assert.equal(s.fake.get('users/u1')?.credits, 10);
  s.fake.store.delete('users/u1');
  await reconcileHostedCheckout(s.fake, s.provider, checkoutId);
  assert.equal(s.fake.get('users/u1'), undefined);
});

test('hosted payment credits are clawed back once through existing refund ledger', async () => {
  const s = setup(); const { checkoutId } = await s.create(); s.paid();
  await reconcileHostedCheckout(s.fake, s.provider, checkoutId);
  const refund = { uid: 'u1', paymentId: 'pay_1', refundId: 'r_1', grantLedgerId: 'razorpay_pay_1', grantedCredits: 50, paymentAmount: 4900, refundAmount: 4900, orderId: 'order_1', kind: 'topup' as const };
  await applyRefundClawback(s.fake, refund);
  await reconcileHostedCheckout(s.fake, s.provider, checkoutId);
  await applyRefundClawback(s.fake, refund);
  assert.equal(s.fake.get('users/u1')?.credits, 10);
});

test('concurrent settlement and refund serialize against the same ledger and order', async () => {
  const s = setup(); const { checkoutId } = await s.create(); s.paid();
  await Promise.all([reconcileHostedCheckout(s.fake, s.provider, checkoutId), reconcileHostedCheckout(s.fake, s.provider, checkoutId)]);
  assert.equal(s.fake.get('users/u1')?.credits, 60);
  await Promise.all([
    settleTopupPayment(s.fake, { orderId: 'order_1', payment: s.payment }),
    applyRefundClawback(s.fake, { uid: 'u1', paymentId: 'pay_1', refundId: 'r1', grantLedgerId: 'razorpay_pay_1', grantedCredits: 50, paymentAmount: 4900, refundAmount: 4900, orderId: 'order_1', kind: 'topup' }),
  ]);
  assert.equal(s.fake.get('users/u1')?.credits, 10);
});

test('expired upstream link is replaced and cancelled links cannot be reused', async () => {
  const s = setup(); const first = await s.create();
  s.link.status = 'expired';
  const second = await s.create();
  assert.notEqual(second.checkoutId, first.checkoutId);
});

test('provider success followed by persistence failure recovers the same link', async () => {
  const s = setup();
  const transaction = s.fake.db.runTransaction;
  let calls = 0;
  s.fake.db.runTransaction = async (callback) => {
    if (++calls === 2) throw new Error('write unavailable');
    return transaction(callback);
  };
  await assert.rejects(s.create(), /write unavailable/);
  s.fake.db.runTransaction = transaction;
  const record = [...s.fake.store.entries()].find(([key]) => key.startsWith('hostedCheckouts/'))!;
  record[1].leaseUntilMs = 0;
  await s.create();
  assert.equal(s.creates(), 1);
});

test('partial totals and cancelled links never grant credits', async () => {
  const s = setup(); const { checkoutId } = await s.create(); s.paid();
  s.link.amount_paid = 100;
  assert.equal((await reconcileHostedCheckout(s.fake, s.provider, checkoutId)).status, 'pending');
  s.link.status = 'cancelled';
  assert.equal((await reconcileHostedCheckout(s.fake, s.provider, checkoutId)).status, 'cancelled');
  assert.equal(s.fake.get('users/u1')?.credits, 10);
});

test('payment link identity, currency and amount are server-authoritative', async () => {
  const s = setup(); const { checkoutId } = await s.create(); s.paid();
  s.link.reference_id = 'hc_wrong';
  await assert.rejects(reconcileHostedCheckout(s.fake, s.provider, checkoutId), /mismatch/);
  s.link.reference_id = checkoutId; s.link.currency = 'USD';
  await assert.rejects(reconcileHostedCheckout(s.fake, s.provider, checkoutId), /mismatch/);
  assert.equal(s.fake.get('users/u1')?.credits, 10);
});

test('link options use a durable reference, no notifications and a fixed safe callback', async () => {
  const s = setup();
  const create = s.provider.create;
  s.provider.create = async options => {
    assert.ok(s.fake.get(`hostedCheckouts/${options.reference_id}`));
    const payload = JSON.parse(JSON.stringify(options));
    assert.equal(Object.hasOwn(payload, 'customer'), false, 'outbound payload must omit customer');
    assert.deepEqual(options.notify, { sms: false, email: false });
    assert.equal(options.reminder_enable, false);
    assert.equal(options.accept_partial, false);
    assert.equal(options.callback_url, `https://astroyou.app/payment/return?checkout=${options.reference_id}`);
    return create(options);
  };
  await s.create();
});

test('expired local reservation still settles an authoritative captured payment', async () => {
  const s = setup(); const { checkoutId } = await s.create(); s.paid();
  s.fake.get(`hostedCheckouts/${checkoutId}`)!.expiresAtMs = 0;
  assert.equal((await reconcileHostedCheckout(s.fake, s.provider, checkoutId, 'u1')).status, 'paid');
  assert.equal(s.fake.get('users/u1')?.credits, 60);
});

test('concurrent creation reserves one link and rate limits new checkout attempts', async () => {
  const s = setup();
  const results = await Promise.allSettled([s.create(), s.create()]);
  assert.equal(s.creates(), 1);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  const owner = s.fake.get('hostedPaymentCustomers/u1')!;
  s.fake.get(`hostedCheckouts/${owner.lastCheckoutId}`)!.status = 'expired';
  owner.attempts = Array(5).fill(Date.now());
  await assert.rejects(s.create(), /wait/);
});
