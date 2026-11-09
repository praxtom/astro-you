import { useState } from "react";
import { hasAnalyticsConsent, setAnalyticsConsent } from "../lib/firebase";

/**
 * Independent, revocable analytics opt-in. Off unless the user turned it on
 * (at sign-in or here); turning it off stops GA4 collection immediately.
 */
export function AnalyticsConsentToggle() {
  const [enabled, setEnabled] = useState(() => hasAnalyticsConsent());

  return (
    <label className="flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-xl bg-white/5 p-3 text-sm text-white/70">
      <span>
        Usage analytics
        <span className="block text-xs text-white/50">
          Optional. Google Analytics cookies and app usage events that help us
          see which features are used.
        </span>
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={enabled}
        onChange={(e) => {
          setAnalyticsConsent(e.target.checked);
          setEnabled(e.target.checked);
        }}
        className="h-5 w-5 shrink-0 accent-[#E5B96A]"
      />
    </label>
  );
}
