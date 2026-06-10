export const INSTALL_VISITS_KEY = "astroyou_visits";
export const INSTALL_DISMISSED_KEY = "astroyou_install_dismissed";

export interface InstallPromptStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

export function recordInstallPromptVisit(storage: InstallPromptStorage): number {
  const current = Number.parseInt(storage.getItem(INSTALL_VISITS_KEY) || "0", 10);
  const visits = Number.isFinite(current) && current > 0 ? current + 1 : 1;
  storage.setItem(INSTALL_VISITS_KEY, String(visits));
  return visits;
}

export function shouldShowInstallPrompt(
  storage: InstallPromptStorage,
  visits: number,
  isStandalone: boolean,
): boolean {
  return (
    !isStandalone &&
    visits >= 2 &&
    storage.getItem(INSTALL_DISMISSED_KEY) !== "true"
  );
}

export function markInstallPromptDismissed(storage: InstallPromptStorage) {
  storage.setItem(INSTALL_DISMISSED_KEY, "true");
  notifyInstallPromptListeners();
}

export function isRunningStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (typeof navigator !== "undefined" &&
      "standalone" in navigator &&
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

export function registerInstallPromptEvent(
  event: BeforeInstallPromptEvent,
  storage: InstallPromptStorage = window.localStorage,
): boolean {
  event.preventDefault();
  deferredPrompt = event;
  const visits = recordInstallPromptVisit(storage);
  notifyInstallPromptListeners();
  return shouldShowInstallPrompt(storage, visits, isRunningStandalone());
}

export function canInstallApp(): boolean {
  return Boolean(deferredPrompt) && !isRunningStandalone();
}

export function subscribeInstallPrompt(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function promptInstallApp(): Promise<boolean> {
  if (!deferredPrompt) return false;
  const prompt = deferredPrompt;
  await prompt.prompt();
  const choice = await prompt.userChoice.catch(() => null);
  deferredPrompt = null;
  notifyInstallPromptListeners();
  return choice?.outcome === "accepted";
}

function notifyInstallPromptListeners() {
  listeners.forEach((listener) => listener());
}
