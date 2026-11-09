import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../lib/useAuth';
import { getCreditPack, getPackAmount } from '../lib/credit-packs';
import { useCurrency } from './useCurrency';
import {
  isRazorpayHostedUrl,
  safePaymentReturnPath,
} from '../lib/payment-navigation';

export function useCreditTopup() {
  const { user } = useAuth();
  const { currency } = useCurrency();
  const [isPaying, setIsPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);

  const buyCredits = useCallback(async (minutes: number): Promise<boolean> => {
    if (!user) {
      setError('Please sign in before buying credits.');
      return false;
    }
    if (controller.current) return false;
    const request = new AbortController();
    controller.current = request;
    setIsPaying(true);
    setError(null);
    try {
      const pack = getCreditPack(minutes);
      const response = await fetch('/api/pay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: request.signal,
        body: JSON.stringify({
          idToken: await user.getIdToken(),
          minutes: pack.minutes,
          currency,
          amount: getPackAmount(pack, currency),
          checkoutMode: 'hosted',
          returnPath: safePaymentReturnPath(
            `${window.location.pathname}${window.location.search}`,
          ),
        }),
      });
      const checkout = await response.json();
      if (!response.ok) {
        throw new Error(checkout.error || 'Could not start payment.');
      }
      if (!isRazorpayHostedUrl(checkout.shortUrl) ||
          typeof checkout.checkoutId !== 'string') {
        throw new Error('Hosted checkout is unavailable. Please try again.');
      }
      try {
        localStorage.setItem(
          `astroyou:pending-payment:${user.uid}`, checkout.checkoutId,
        );
      } catch {
        // Payment can proceed without optional browser recovery storage.
      }
      const destination = checkout.status === 'paid'
        ? `/payment/return?checkout=${encodeURIComponent(checkout.checkoutId)}`
        : checkout.shortUrl;
      window.location.assign(destination);
      // Only the authenticated return page confirms completion after settlement.
      return false;
    } catch (err) {
      if (!(err instanceof DOMException && err.name === 'AbortError')) {
        setError(err instanceof Error ? err.message : 'Could not start payment.');
      }
      return false;
    } finally {
      controller.current = null;
      if (!request.signal.aborted) setIsPaying(false);
    }
  }, [user, currency]);

  return { buyCredits, isPaying, error };
}
