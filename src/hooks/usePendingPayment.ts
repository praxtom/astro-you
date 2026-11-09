import { useEffect, useState } from 'react';
import { useAuth } from '../lib/useAuth';

/** Recover the last checkout from the account, including on another device. */
export function usePendingPayment() {
  const { user } = useAuth();
  const [checkoutId, setCheckoutId] = useState<string | null>(null);
  useEffect(() => {
    setCheckoutId(null);
    if (!user) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch('/api/pay/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({ idToken: await user.getIdToken() }),
        });
        const result = await response.json();
        const terminal = ['paid', 'refunded', 'expired', 'cancelled', 'none'];
        if (!controller.signal.aborted && response.ok && result.checkoutId &&
            !terminal.includes(result.status)) {
          setCheckoutId(result.checkoutId);
        }
      } catch {
        if (controller.signal.aborted) return;
        try {
          setCheckoutId(localStorage.getItem(`astroyou:pending-payment:${user.uid}`));
        } catch {
          // Browser storage may be disabled. Account recovery remains available.
        }
      }
    })();
    return () => controller.abort();
  }, [user]);
  return checkoutId;
}
