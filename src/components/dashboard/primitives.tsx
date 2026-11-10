import { Children, type ReactNode } from "react";
import { Link } from "react-router-dom";

/**
 * Dashboard layout primitives.
 *
 * Apple-Weather-style language: every piece of information sits on a soft
 * tile (about 5% white, no border, no shadow, generous radius). Tiles are
 * grouped under quiet section headings; the tiles themselves carry the
 * structure, so the page reads as calm groups rather than columns of text.
 */

/** Shared tile surface. */
export const TILE =
  "rounded-[1.25rem] border border-white/[0.08] bg-white/[0.015] p-5 md:p-6";

/** A soft tile. */
export function Tile({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`${TILE} min-w-0 ${className}`}>{children}</div>;
}

/** Section with the single dashboard heading style (sentence case, display serif). */
export function DashSection({
  title,
  aside,
  children,
  className = "",
  id,
}: {
  title: ReactNode;
  /** Right-aligned context or a TextAction. */
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section className={className} aria-labelledby={id}>
      <span className="block h-px w-8 bg-gold/50 mb-5" aria-hidden="true" />
      <div className="flex items-end justify-between gap-4 pb-6">
        <h2
          id={id}
          className="font-display text-2xl md:text-[1.75rem] leading-tight text-white/90"
        >
          {title}
        </h2>
        {aside && (
          <div className="shrink-0 pb-1 text-xs text-white/55">{aside}</div>
        )}
      </div>
      {children}
    </section>
  );
}

const MD_COLS = {
  1: "md:grid-cols-1",
  2: "md:grid-cols-2",
  3: "md:grid-cols-3",
  4: "md:grid-cols-4",
} as const;

/**
 * Hairline ledger: cells share 1px rules (top and bottom of the block, and
 * between cells) instead of sitting in separate boxes. Null children are
 * skipped, so conditional cells don't leave gaps.
 */
export function Ledger({
  cols = 3,
  children,
  className = "",
}: {
  cols?: 1 | 2 | 3 | 4;
  children: ReactNode;
  className?: string;
}) {
  // Columns separated by space, not rules: structure comes from alignment.
  return (
    <div
      className={`grid grid-cols-1 ${MD_COLS[cols]} gap-3.5 ${className}`}
    >
      {Children.toArray(children).map((child, i) => (
        <div key={i} className={`${TILE} min-w-0`}>
          {child}
        </div>
      ))}
    </div>
  );
}

/** Small-caps label, the same one the almanac band uses. */
export function FactLabel({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "caution" | "gold";
}) {
  const color =
    tone === "caution"
      ? "text-red-300/60"
      : tone === "gold"
        ? "text-gold/75"
        : "text-white/55";
  return (
    <p
      className={`text-[0.78rem] font-semibold uppercase tracking-[0.08em] ${color}`}
    >
      {children}
    </p>
  );
}

/** Label, a display-serif value, and an optional plain-language note. */
export function Fact({
  label,
  value,
  note,
  tone,
  children,
}: {
  label: ReactNode;
  value?: ReactNode;
  note?: ReactNode;
  tone?: "default" | "caution" | "gold";
  children?: ReactNode;
}) {
  return (
    <div>
      <FactLabel tone={tone}>{label}</FactLabel>
      {value != null && value !== "" && (
        <p className="mt-2 font-display text-[1.6rem] leading-snug text-white/92">
          {value}
        </p>
      )}
      {note && (
        <p className="mt-1.5 text-[0.98rem] leading-relaxed text-white/60">
          {note}
        </p>
      )}
      {children}
    </div>
  );
}

/** Two-line shimmer used while a fact loads. */
export function FactSkeleton() {
  return (
    <div className="space-y-2" aria-hidden="true">
      <div className="h-2.5 w-20 rounded bg-white/6 animate-pulse" />
      <div className="h-5 w-36 rounded bg-white/6 animate-pulse" />
      <div className="h-3 w-48 rounded bg-white/4 animate-pulse" />
    </div>
  );
}

const ACTION_CLS =
  "min-h-11 inline-flex items-center gap-1.5 text-[0.85rem] font-semibold text-gold/85 hover:text-gold transition-colors";

/** Quiet text action: a link (to) or a button (onClick). */
export function TextAction({
  to,
  onClick,
  children,
}: {
  to?: string;
  onClick?: () => void;
  children: ReactNode;
}) {
  if (to) {
    return (
      <Link to={to} className={ACTION_CLS}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={ACTION_CLS}>
      {children}
    </button>
  );
}
