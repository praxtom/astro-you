import test from 'node:test';
import assert from 'node:assert/strict';
import { isRazorpayHostedUrl, safePaymentReturnPath } from '../../../src/lib/payment-navigation.js';

test('hosted redirects accept provider HTTPS domains only', () => {
  for (const value of ['https://rzp.io/i/checkout', 'https://rzp.me/i/checkout', 'https://pages.razorpay.com/checkout']) {
    assert.equal(isRazorpayHostedUrl(value), true);
  }
  for (const value of ['https://razorpay.com.evil.test', 'javascript:alert(1)', 'http://rzp.io/test', 'https://user:pass@rzp.io/test', '//rzp.io/test', 'https://rzp.io:8888/test']) {
    assert.equal(isRazorpayHostedUrl(value), false);
  }
});

test('local return paths cannot redirect to external destinations', () => {
  for (const value of ['//evil.test', '/\\evil.test', 'https://evil.test', '/unknown', '/wallet\n']) {
    assert.equal(safePaymentReturnPath(value), '/wallet');
  }
  assert.equal(safePaymentReturnPath('/consult/jyotish/chat?session=1'), '/consult/jyotish/chat?session=1');
});

test('returning to Pricing cannot replay its sign-in purchase intent', () => {
  assert.equal(safePaymentReturnPath('/pricing?resume=topup-50'), '/pricing');
});
