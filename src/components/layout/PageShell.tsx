import React from "react";
import { SpaceTabs } from "./SpaceTabs";

const WIDTHS = {
  /** Long-form reading: policies, guides, settings, forms. */
  reading: "max-w-4xl",
  /** Default for tools and app pages. */
  default: "max-w-6xl",
  /** Data-heavy pages that need room (charts, comparisons). */
  wide: "max-w-7xl",
} as const;

/**
 * Standard page container. The header, night sky and footer come from
 * AppFrame (rendered once for every page); this only sets the content width,
 * the space under the fixed header, and the space tabs.
 */
export const PageShell: React.FC<{
  children: React.ReactNode;
  /** Hide the space tabs (e.g. on standalone or public pages). */
  noTabs?: boolean;
  /** @deprecated use width="wide" */
  wide?: boolean;
  width?: keyof typeof WIDTHS;
  className?: string;
}> = ({ children, noTabs = false, wide = false, width, className = "" }) => (
  <div
    className={`container mx-auto px-4 sm:px-6 pt-28 pb-16 ${
      WIDTHS[width ?? (wide ? "wide" : "default")]
    } ${className}`}
  >
    {!noTabs && <SpaceTabs />}
    {children}
  </div>
);

/**
 * The one page-title block: optional small label, display-serif title, and a
 * single line of description. Actions (buttons) can sit on the right.
 */
export const PageTitle: React.FC<{
  title: React.ReactNode;
  eyebrow?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}> = ({ title, eyebrow, description, actions, className = "" }) => (
  <header
    className={`mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 ${className}`}
  >
    <div className="min-w-0 max-w-3xl">
      {eyebrow && <p className="platform-eyebrow mb-2">{eyebrow}</p>}
      <h1 className="type-page-title">{title}</h1>
      {description && (
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-white/60 md:text-[1.05rem]">
          {description}
        </p>
      )}
    </div>
    {actions && <div className="shrink-0">{actions}</div>}
  </header>
);
