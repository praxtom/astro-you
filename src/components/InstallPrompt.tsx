import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Download, X } from "lucide-react";
import {
  type BeforeInstallPromptEvent,
  markInstallPromptDismissed,
  promptInstallApp,
  registerInstallPromptEvent,
} from "../lib/pwa-install";

/**
 * Chat screens keep their composer pinned to the bottom of the viewport; a
 * fixed bottom banner there would sit on top of the message box.
 */
function hasBottomComposer(pathname: string): boolean {
  return (
    pathname === "/synthesis" ||
    pathname.startsWith("/synthesis/") ||
    /^\/consult\/[^/]+\/chat\/?$/.test(pathname)
  );
}

export function InstallPrompt() {
  const [show, setShow] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    const handler = (e: Event) => {
      setShow(registerInstallPromptEvent(e as BeforeInstallPromptEvent));
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!show || hasBottomComposer(pathname)) return null;

  return (
    <div className="fixed bottom-20 md:bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 z-50 bg-[#0a0a0f] border border-gold/20 rounded-2xl p-4 shadow-2xl flex items-center gap-3">
      <div className="p-2 rounded-xl bg-gold/10">
        <Download size={20} className="text-gold" />
      </div>
      <div className="flex-1">
        <p className="text-sm text-white font-medium">Install AstroYou</p>
        <p className="text-xs text-white/55">
          Add to home screen for quick access
        </p>
      </div>
      <button
        onClick={() => {
          promptInstallApp();
          setShow(false);
        }}
        className="min-h-11 px-3 rounded-lg bg-gold text-black text-xs font-bold"
      >
        Install
      </button>
      <button
        type="button"
        onClick={() => {
          setShow(false);
          markInstallPromptDismissed(localStorage);
        }}
        aria-label="Dismiss install prompt"
        className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-white/55 hover:text-white/70"
      >
        <X size={16} />
      </button>
    </div>
  );
}
