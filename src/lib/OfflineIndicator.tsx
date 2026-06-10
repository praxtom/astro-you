import { useNetworkStatus } from "./useNetworkStatus";

/**
 * Offline indicator component.
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
