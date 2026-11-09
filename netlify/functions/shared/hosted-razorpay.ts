import Razorpay from 'razorpay';
import type { HostedProvider, ProviderLink } from './hosted-payments';

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || '',
  key_secret: process.env.RAZORPAY_KEY_SECRET || '',
});

// The SDK types describe `payments` as an object, while the API returns an array.
export const hostedProvider: HostedProvider = {
  async create(options) {
    // The API permits omitting customer; the SDK incorrectly requires it.
    const params = options as Parameters<typeof razorpay.paymentLink.create>[0];
    return await razorpay.paymentLink.create(params) as unknown as ProviderLink;
  },
  async fetch(id) {
    return await razorpay.paymentLink.fetch(id) as unknown as ProviderLink;
  },
  async find(reference) {
    const findLinks = razorpay.paymentLink.all as unknown as
      (options: { reference_id: string }) => Promise<{ payment_links: ProviderLink[] }>;
    const result = await findLinks.call(razorpay.paymentLink, { reference_id: reference });
    return result.payment_links;
  },
  async payment(id) {
    return await razorpay.payments.fetch(id);
  },
};
