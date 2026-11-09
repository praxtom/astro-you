/** Only provider-owned HTTPS pages can receive a checkout redirect. */
export function isRazorpayHostedUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    const providerHost = url.hostname === 'rzp.io' ||
      url.hostname === 'rzp.me' ||
      url.hostname === 'razorpay.com' ||
      url.hostname.endsWith('.razorpay.com');
    return url.protocol === 'https:' && !url.username &&
      !url.password && !url.port && providerHost;
  } catch {
    return false;
  }
}

export function safePaymentReturnPath(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/') ||
      value.startsWith('//') || /[\\\r\n]/.test(value)) {
    return '/wallet';
  }
  const url = new URL(value, 'https://astroyou.invalid');
  const allowed = /^\/(wallet|pricing|reports|consult(?:\/[^/]+(?:\/chat)?)?|synthesis(?:\/[^/]+)?|settings(?:\/subscription)?)$/;
  if (!allowed.test(url.pathname)) return '/wallet';
  // A Pricing sign-in resume token would otherwise start another checkout.
  url.searchParams.delete('resume');
  for (const key of [...url.searchParams.keys()]) {
    if (key.startsWith('razorpay_')) url.searchParams.delete(key);
  }
  return `${url.pathname}${url.search}`;
}
