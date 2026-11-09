import test from 'node:test';
import assert from 'node:assert/strict';
import { claimPaymentAnalytics } from '../shared/payment-analytics.js';
import { createFakeFirestore } from './helpers/fake-firestore.js';

function setup() {
  return createFakeFirestore({
    'hostedCheckouts/hc_1': { uid: 'u1', status: 'paid', amount: 49, currency: 'INR', minutes: 50 },
    'hostedCheckouts/hc_2': { uid: 'u1', status: 'paid', amount: 99, currency: 'INR', minutes: 120 },
  });
}

test('confirmed payment analytics are claimed once across refreshes and concurrent return pages', async () => {
  const fake = setup();
  const results = await Promise.all([
    claimPaymentAnalytics(fake, 'u1', 'hc_1', true),
    claimPaymentAnalytics(fake, 'u1', 'hc_1', true),
  ]);
  assert.equal(results.filter(result => result.creditTopupCompleted).length, 1);
  assert.equal(results.filter(result => result.firstPayment).length, 1);
  assert.equal((await claimPaymentAnalytics(fake, 'u1', 'hc_1', true)).creditTopupCompleted, false);
});

test('first payment is per account while later purchases each count once', async () => {
  const fake = setup();
  const first = await claimPaymentAnalytics(fake, 'u1', 'hc_1', true);
  assert.equal(first.firstPayment, true);
  assert.equal(first.amount, 49);
  const second = await claimPaymentAnalytics(fake, 'u1', 'hc_2', true);
  assert.equal(second.creditTopupCompleted, true);
  assert.equal(second.firstPayment, false);
});

test('unpaid, refunded and another account cannot emit payment conversions', async () => {
  const fake = setup();
  for (const status of ['pending', 'refunded']) {
    fake.get('hostedCheckouts/hc_1')!.status = status;
    assert.equal((await claimPaymentAnalytics(fake, 'u1', 'hc_1', true)).firstPayment, false);
  }
  fake.get('hostedCheckouts/hc_1')!.status = 'paid';
  assert.equal((await claimPaymentAnalytics(fake, 'other', 'hc_1', true)).creditTopupCompleted, false);
});

test('analytics persistence failure emits no false conversion and never changes the payment', async () => {
  const fake = setup();
  fake.db.runTransaction = async () => { throw new Error('unavailable'); };
  const result = await claimPaymentAnalytics(fake, 'u1', 'hc_1', true);
  assert.equal(result.creditTopupCompleted, false);
  assert.equal(result.firstPayment, false);
  assert.equal(fake.get('hostedCheckouts/hc_1')!.status, 'paid');
});


test('passive recovery without consent does not consume conversion claims', async () => {
  const fake = setup();
  assert.equal((await claimPaymentAnalytics(fake, 'u1', 'hc_1', false)).firstPayment, false);
  assert.equal(fake.get('hostedCheckouts/hc_1')?.analyticsClaimed, undefined);
  assert.equal((await claimPaymentAnalytics(fake, 'u1', 'hc_1', true)).firstPayment, true);
});
