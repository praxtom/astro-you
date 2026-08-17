import { useCallback, useState } from "react";
import { useAuth } from "../lib/useAuth";
import { loadRazorpayCheckout } from "../lib/razorpay-loader";
import { getCreditPack } from "../lib/credit-packs";
import { trackAcquisitionEvent } from "../lib/acquisition";
import { useCurrency } from "./useCurrency";
import { getPackAmount } from "../lib/credit-packs";
import { toMinorUnits } from "../lib/currency";

type RazorpayCheckoutResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type RazorpayConstructor = new (options: {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (response: RazorpayCheckoutResponse) => Promise<void>;
  prefill?: { name?: string; email?: string };
  theme?: { color: string };
  modal?: { ondismiss?: () => void };
}) => { open: () => void };

interface RazorpayOrderResponse {
  id: string;
  amount: number;
  currency: string;
}

export function useCreditTopup() {
  const { user } = useAuth();
  const { currency } = useCurrency();
  const [isPaying, setIsPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buyCredits = useCallback(
    async (minutes: number): Promise<boolean> => {
      if (!user) {
        setError("Please sign in before buying credits.");
        return false;
      }

      const pack = getCreditPack(minutes);
      try {
        await loadRazorpayCheckout();
      } catch {
        setError("Payment system is still loading.");
        return false;
      }

      const Razorpay = (window as Window & { Razorpay?: RazorpayConstructor })
        .Razorpay;
      if (!Razorpay || !import.meta.env.VITE_RAZORPAY_KEY_ID) {
        setError("Payment setup is not available.");
        return false;
      }

      setIsPaying(true);
      setError(null);

      try {
        const idToken = await user.getIdToken();
        const orderResponse = await fetch("/api/pay/create-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            idToken,
            minutes: pack.minutes,
            currency,
            // Confirmed in the same currency the server will charge in.
            amount: getPackAmount(pack, currency),
          }),
        });
        const order = (await orderResponse
          .json()
          .catch(() => ({}))) as Partial<RazorpayOrderResponse> & {
          error?: string;
        };
        if (!orderResponse.ok || !order.id) {
          throw new Error(order.error || "Could not start payment.");
        }
        const orderId = order.id;

        return await new Promise<boolean>((resolve) => {
          const checkout = new Razorpay({
            key: import.meta.env.VITE_RAZORPAY_KEY_ID,
            // Minor units, straight from the Razorpay order.
            amount: order.amount || toMinorUnits(getPackAmount(pack, currency), currency),
            currency: order.currency || currency,
            name: "AstroYou",
            description: `${pack.label} for AstroYou`,
            order_id: orderId,
            prefill: {
              name: user.displayName || "",
              email: user.email || "",
            },
            theme: { color: "#ffcd6a" },
            modal: {
              ondismiss: () => {
                setIsPaying(false);
                resolve(false);
              },
            },
            handler: async (response) => {
              try {
                const verifyResponse = await fetch("/api/pay/verify", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    ...response,
                    idToken: await user.getIdToken(),
                  }),
                });
                const verifyData = await verifyResponse
                  .json()
                  .catch(() => ({}));
                if (!verifyResponse.ok || verifyData.status !== "success") {
                  throw new Error(
                    verifyData.error || "Payment verification failed.",
                  );
                }
                trackAcquisitionEvent("credit_topup_completed", {
                  amount: pack.amountInRupees,
                  minutes: pack.minutes,
                });
                setIsPaying(false);
                resolve(true);
              } catch (err) {
                const message =
                  err instanceof Error
                    ? err.message
                    : "Payment verification failed.";
                setError(message);
                setIsPaying(false);
                resolve(false);
              }
            },
          });

          checkout.open();
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Payment failed to initialize.";
        setError(message);
        setIsPaying(false);
        return false;
      }
    },
    [user],
  );

  return { buyCredits, isPaying, error };
}
