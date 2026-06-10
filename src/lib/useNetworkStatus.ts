import {
  createElement,
  useEffect,
  useState,
  type ComponentType,
} from "react";

export type NetworkStatus = "online" | "offline" | "slow";

interface UseNetworkStatusOptions {
  slowThreshold?: number;
  checkInterval?: number;
}

/**
 * Hook to detect online/offline status and connection quality.
 */
export function useNetworkStatus(options: UseNetworkStatusOptions = {}) {
  const { slowThreshold = 3000, checkInterval = 30000 } = options;

  const [status, setStatus] = useState<NetworkStatus>(() =>
    typeof navigator !== "undefined" && navigator.onLine ? "online" : "offline"
  );
  const [lastOnline, setLastOnline] = useState<Date | null>(null);

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
 * HOC to wrap components that need network status.
 */
export function withNetworkStatus<T extends object>(
  Component: ComponentType<T & { networkStatus: NetworkStatus }>
) {
  return function WrappedComponent(props: T) {
    const { status } = useNetworkStatus();
    return createElement(Component, {
      ...props,
      networkStatus: status,
    } as T & { networkStatus: NetworkStatus });
  };
}

export default useNetworkStatus;
