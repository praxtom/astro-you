import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import AuthModal from '../components/AuthModal';
import { useAuth } from '../lib/useAuth';
import { hasAnalyticsConsent } from '../lib/firebase';
import {
  isRazorpayHostedUrl,
  safePaymentReturnPath,
} from '../lib/payment-navigation';
import { trackAcquisitionEvent } from '../lib/acquisition';

const STATUS_LABELS: Record<string, string> = {
  confirming: 'Confirming your payment',
  paid: 'Your credits are ready',
  pending: 'Payment is pending',
  expired: 'This payment link has expired',
  cancelled: 'This payment was cancelled',
  partially_paid: 'Payment needs review',
  refunded: 'This payment was refunded',
  account_missing: 'Your account could not be found',
  error: 'Payment confirmation unavailable',
};

export default function PaymentReturn() {
  const { user, loading } = useAuth();
  const [params] = useSearchParams();
  const checkoutId = params.get('checkout') || '';
  const [status, setStatus] = useState('confirming');
  const [error, setError] = useState<string | null>(null);
  const [returnPath, setReturnPath] = useState('/wallet');
  const [shortUrl, setShortUrl] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [authOpen, setAuthOpen] = useState(false);

  useEffect(() => {
    if (!user || !checkoutId) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    setStatus('confirming');
    setError(null);
    const check = async () => {
      try {
        const response = await fetch('/api/pay/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            idToken: await user.getIdToken(),
            checkoutId,
            analyticsConsent: hasAnalyticsConsent(),
          }),
        });
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || 'Could not confirm payment.');
        }
        if (controller.signal.aborted) return;
        setStatus(result.status);
        setReturnPath(safePaymentReturnPath(result.returnPath));
        setShortUrl(isRazorpayHostedUrl(result.shortUrl) ? result.shortUrl : null);
        if (result.status === 'paid') {
          try {
            localStorage.removeItem(`astroyou:pending-payment:${user.uid}`);
          } catch {
            // Account recovery works without optional browser storage.
          }
          // Flags are claimed once on the server, across refreshes and devices.
          // Telemetry failures never change the confirmed payment state.
          try {
            const claimed = result.paymentAnalytics;
            const params = {
              checkout_id: checkoutId,
              minutes: claimed?.minutes,
              amount: claimed?.amount,
              currency: claimed?.currency,
            };
            if (claimed?.creditTopupCompleted) {
              trackAcquisitionEvent('credit_topup_completed', params);
            }
            if (claimed?.firstPayment) {
              trackAcquisitionEvent('first_payment', params);
            }
          } catch {
            // Conversion tracking is best effort.
          }
        } else if (result.status === 'pending' && ++attempts < 6) {
          timer = setTimeout(check, 4000);
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        setStatus('error');
        setError(err instanceof Error ? err.message : 'Could not confirm payment.');
      }
    };
    void check();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [user, checkoutId, retry]);

  let title = STATUS_LABELS[status] || 'Payment needs review';
  if (!checkoutId) title = 'Payment checkout not found';
  else if (!user && !loading) title = 'Sign in to confirm your payment';
  const confirming = loading || (status === 'confirming' && user && checkoutId);
  const canRetry = user && checkoutId && ['pending', 'error', 'partially_paid'].includes(status);

  const message = !checkoutId
    ? 'This link is missing its payment reference. Your wallet shows your current balance.'
    : status === 'paid'
      ? 'Your credit balance has been updated. You can continue where you left off.'
      : status === 'pending'
        ? 'We will add credits when Razorpay confirms the payment. You can return to this page at any time.'
        : status === 'partially_paid'
          ? 'Contact support with your payment reference so we can review it.'
          : ['expired', 'cancelled'].includes(status)
            ? 'You can start a new purchase from your wallet.'
            : null;

  return (
    // AppFrame already provides <main>; pt-28 clears the fixed header.
    <div className="mx-auto max-w-xl px-4 pt-28 pb-16 text-center sm:px-6">
      <div role="status" aria-live="polite">
        <h1 className="font-display text-3xl text-white sm:text-4xl">{title}</h1>
        {confirming && (
          <Loader2
            className="mx-auto mt-6 animate-spin text-gold"
            aria-label="Checking payment"
          />
        )}
        {message && <p className="mt-5 text-base leading-relaxed text-white/70">{message}</p>}
      </div>
      {error && (
        <p role="alert" className="mt-4 text-base leading-relaxed text-white/70">
          {error}
        </p>
      )}
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        {!user && !loading && (
          <button
            type="button"
            className="platform-button-primary min-w-32"
            onClick={() => setAuthOpen(true)}
          >
            Sign in
          </button>
        )}
        {status === 'paid' && (
          <Link className="platform-button-primary min-w-32" to={returnPath}>
            Continue
          </Link>
        )}
        {user && status === 'pending' && shortUrl && (
          <a className="platform-button-primary min-w-32" href={shortUrl}>
            Continue payment
          </a>
        )}
        {canRetry && (
          <button
            type="button"
            className="platform-button-secondary"
            onClick={() => setRetry(value => value + 1)}
          >
            Check payment again
          </button>
        )}
        <Link className="platform-button-secondary" to="/wallet">
          Open wallet
        </Link>
      </div>
      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />
    </div>
  );
}
