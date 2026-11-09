import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { RotateCcw, type LucideIcon } from "lucide-react";

export interface StatusNoticeAction {
  label: string;
  /** Renders a react-router Link instead of a button. */
  to?: string;
  onClick?: () => void;
  icon?: LucideIcon;
  disabled?: boolean;
}

interface StatusNoticeProps {
  /** error: red-tinted alert (role="alert"). info: neutral card for sign-in, missing profile, empty (role="status"). */
  tone?: "error" | "info";
  /** page: standalone card with a display-font title. section: compact card inside a panel. */
  size?: "page" | "section";
  title?: ReactNode;
  message: ReactNode;
  /** Primary (gold) action. */
  action?: StatusNoticeAction;
  /** Outline action. */
  secondaryAction?: StatusNoticeAction;
  /**
   * Shorthand for a "Try again" action. It is the gold primary on a page
   * notice and an outline button in a section notice, so a page with several
   * failing sections doesn't fill up with gold.
   */
  onRetry?: () => void;
  className?: string;
}

const BUTTON_BASE =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm transition-colors disabled:opacity-50";
const PRIMARY = `${BUTTON_BASE} bg-gold font-bold text-black hover:bg-gold/90`;
const SECONDARY = `${BUTTON_BASE} border border-white/15 font-semibold text-white/80 hover:border-white/30 hover:text-white`;

function NoticeButton({
  action,
  variant,
}: {
  action: StatusNoticeAction;
  variant: "primary" | "secondary";
}) {
  const Icon = action.icon;
  const className = variant === "primary" ? PRIMARY : SECONDARY;
  const content = (
    <>
      {Icon && <Icon size={15} aria-hidden="true" />}
      {action.label}
    </>
  );
  if (action.to) {
    return (
      <Link to={action.to} onClick={action.onClick} className={className}>
        {content}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={action.onClick}
      disabled={action.disabled}
      className={className}
    >
      {content}
    </button>
  );
}

export function StatusNotice({
  tone = "error",
  size = "page",
  title,
  message,
  action,
  secondaryAction,
  onRetry,
  className = "",
}: StatusNoticeProps) {
  const retry: StatusNoticeAction | undefined = onRetry
    ? { label: "Try again", onClick: onRetry, icon: RotateCcw }
    : undefined;

  // A retry fills the primary slot on a page notice, the outline slot on a
  // section notice (unless an explicit action already claims it).
  let primary = action;
  let secondary = secondaryAction;
  if (retry) {
    if (size === "page" && !primary) primary = retry;
    else if (!secondary) secondary = retry;
    else if (!primary) primary = retry;
  }

  const isPage = size === "page";
  const toneClass =
    tone === "error"
      ? "border-red-400/20 bg-red-500/[0.06]"
      : "border-white/10 bg-white/[0.03]";
  const sizeClass = isPage ? "max-w-2xl rounded-2xl p-6" : "rounded-xl p-4";

  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`border ${toneClass} ${sizeClass} ${className}`.trim()}
    >
      {title &&
        (isPage ? (
          <h2 className="mb-2 font-display text-xl text-white">{title}</h2>
        ) : (
          <p className="mb-1 text-sm font-semibold text-white/85">{title}</p>
        ))}
      <div
        className={`text-sm ${tone === "error" ? "text-white/75" : "text-white/65"}`}
      >
        {message}
      </div>
      {(primary || secondary) && (
        <div className={`flex flex-wrap gap-3 ${isPage ? "mt-5" : "mt-3"}`}>
          {primary && <NoticeButton action={primary} variant="primary" />}
          {secondary && <NoticeButton action={secondary} variant="secondary" />}
        </div>
      )}
    </div>
  );
}
