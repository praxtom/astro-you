let razorpayPromise: Promise<void> | null = null;

export function loadRazorpayCheckout(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Razorpay checkout is unavailable."));
  }

  if ((window as Window & { Razorpay?: unknown }).Razorpay) {
    return Promise.resolve();
  }

  if (razorpayPromise) return razorpayPromise;

  const pendingLoad = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://checkout.razorpay.com/v1/checkout.js"]',
    );

    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Razorpay checkout failed to load.")),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error("Razorpay checkout failed to load."));
    document.body.appendChild(script);
  });

  razorpayPromise = pendingLoad.catch((error) => {
    razorpayPromise = null;
    throw error;
  });

  return razorpayPromise;
}
