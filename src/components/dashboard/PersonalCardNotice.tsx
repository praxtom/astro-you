import { Lock, RefreshCw } from "lucide-react";
import type { PersonalDataErrorKind } from "../../lib/personal-data-error";

/** Event the Dashboard listens for to open its sign-in modal. */
export const OPEN_AUTH_EVENT = "astroyou:open-auth";

export function requestSignIn() {
  window.dispatchEvent(new CustomEvent(OPEN_AUTH_EVENT));
}

interface PersonalCardNoticeProps {
  kind: PersonalDataErrorKind;
  /** What the card shows, e.g. "planetary yogas" → "Sign in to see your planetary yogas". */
  thing: string;
  onRetry?: () => void;
}

/**
 * Definite end state for a personal dashboard card whose data could not load:
 * a sign-in prompt for guests, or a calm "temporarily unavailable" with retry.
 */
export function PersonalCardNotice({ kind, thing, onRetry }: PersonalCardNoticeProps) {
  if (kind === "signin") {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-[0.98rem] text-white/65 leading-relaxed">
          Sign in to see your {thing}. It's free, and your chart stays saved.
        </p>
        <button
          type="button"
          onClick={requestSignIn}
          className="min-h-11 inline-flex items-center gap-1.5 text-[0.75rem] font-bold uppercase tracking-[0.18em] text-gold hover:text-white transition-colors"
        >
          <Lock size={12} />
          Sign in
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-3">
      <p className="text-[0.98rem] text-white/60 leading-relaxed">
        Your {thing} {thing.endsWith("s") ? "are" : "is"} temporarily unavailable. Please try again in a little while.
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="min-h-11 inline-flex items-center gap-1.5 text-[0.75rem] font-bold uppercase tracking-[0.18em] text-white/55 hover:text-gold transition-colors"
        >
          <RefreshCw size={12} />
          Try again
        </button>
      )}
    </div>
  );
}
