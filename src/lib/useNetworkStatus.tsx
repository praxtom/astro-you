import { useState, useEffect } from "react";

export type NetworkStatus = "online" | "offline" | "slow";

interface UseNetworkStatusOptions {
  slowThreshold?: number;
  checkInterval?: number;
}

/**
 * Hook to detect online/offline status and connection quality
 */
export function useNetworkStatus(options: UseNetworkStatusOptions = {}) {
  const { slowThreshold = 3000, checkInterval = 30000 } = options;

  const [status, setStatus] = useState<NetworkStatus>(() =>
    typeof navigator !== "undefined" && navigator.onLine ? "online" : "offline"
  );
  const [lastOnline, setLastOnline] = useState<Date | null>(null);

  // Handle browser online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setStatus("online");
      setLastOnline(new Date());
    };

    const handleOffline = () => {
      setStatus("offline");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Check connection quality periodically
  useEffect(() => {
    if (status === "offline") return;

    const checkConnection = async () => {
      const start = Date.now();

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), slowThreshold);

        await fetch("/favicon.svg", {
          method: "HEAD",
          cache: "no-store",
          signal: controller.signal,
        });

        clearTimeout(timeout);

        const elapsed = Date.now() - start;
        setStatus(elapsed > slowThreshold / 2 ? "slow" : "online");
      } catch {
        if (navigator.onLine) {
          setStatus("slow");
        } else {
          setStatus("offline");
        }
      }
    };

    const interval = setInterval(checkConnection, checkInterval);
    return () => clearInterval(interval);
  }, [status, slowThreshold, checkInterval]);

  return { status, lastOnline, isOnline: status !== "offline" };
}

/**
 * Offline indicator component
 */
export function OfflineIndicator() {
  const { status } = useNetworkStatus();

  if (status === "online") return null;

  const isOffline = status === "offline";

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`fixed bottom-6 left-6 z-[9999] px-4 py-3 rounded-xl border flex items-center gap-3 ${
        isOffline
          ? "bg-red-500/10 border-red-500/30 text-red-400"
          : "bg-yellow-500/10 border-yellow-500/30 text-yellow-400"
      }`}
    >
      <div
        className={`w-2 h-2 rounded-full animate-pulse ${
          isOffline ? "bg-red-500" : "bg-yellow-500"
        }`}
      />
      <span className="text-sm font-sans">
        {isOffline
          ? "You are offline. Some features may not work."
          : "Slow connection detected."}
      </span>
    </div>
  );
}

/**
 * HOC to wrap components that need network status
 */
export function withNetworkStatus<T extends object>(
  Component: React.ComponentType<T & { networkStatus: NetworkStatus }>
) {
  return function WrappedComponent(props: T) {
    const { status } = useNetworkStatus();
    return <Component {...props} networkStatus={status} />;
  };
}

export default useNetworkStatus;
