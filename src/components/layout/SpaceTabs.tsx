import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getSpaceForPath } from "../../lib/spaces";

/**
 * Lateral navigation within a space — the missing sibling links. Renders the
 * space's eyebrow (label + the question it answers) and a hairline tab row
 * of its pages. Pages outside any space render nothing.
 */
export const SpaceTabs: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const space = getSpaceForPath(location.pathname);

  if (!space) return null;

  return (
    <div className="mb-8 animate-reveal-progressive">
      <div className="flex items-baseline gap-4">
        <p className="text-gold/80 text-[0.65rem] font-bold uppercase tracking-[0.4em]">
          {space.label}
        </p>
        <span className="hidden sm:block flex-1 h-px bg-linear-to-r from-gold/25 to-transparent" />
        <p className="hidden md:block text-white/30 text-[0.65rem] italic font-display text-base">
          {space.question}
        </p>
      </div>
      {space.pages.length > 1 && (
        <nav
          aria-label={`${space.label} pages`}
          className="mt-4 flex gap-1.5 overflow-x-auto scrollbar-none border-b border-white/8"
        >
          {space.pages.map((page) => {
            const active =
              location.pathname === page.path ||
              location.pathname.startsWith(page.path + "/");
            return (
              <button
                key={page.path}
                onClick={() => navigate(page.path)}
                className={`relative px-4 py-2.5 text-[0.65rem] font-bold uppercase tracking-[0.2em] whitespace-nowrap transition-colors ${
                  active ? "text-gold" : "text-white/35 hover:text-white"
                }`}
              >
                {page.label}
                {active && (
                  <span className="absolute inset-x-3 -bottom-px h-px bg-gold" />
                )}
              </button>
            );
          })}
        </nav>
      )}
    </div>
  );
};
