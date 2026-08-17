import React, { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { GLOSSARY, type GlossaryKey } from "../../lib/glossary";

interface GlossaryTermProps {
  /** Glossary key, e.g. "tithi". Typed so a typo is a compile error. */
  k: GlossaryKey;
  /** Visible label. Defaults to the glossary entry's display term. */
  children?: React.ReactNode;
}

/**
 * An inline term that reveals its plain-English definition.
 *
 * Deliberately a <button>, not a <span>: a tooltip that only responds to hover
 * is invisible to keyboard and touch users, which is the usual way this pattern
 * is shipped broken. Opens on hover, focus and click; closes on Escape without
 * losing focus. The panel renders through a portal so a card's `overflow`
 * cannot clip it — the same approach as LocationInput.
 */
export function GlossaryTerm({ k, children }: GlossaryTermProps) {
  const entry = GLOSSARY[k];
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = `glossary-${useId()}`;

  const place = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) setCoords({ top: rect.bottom + 6, left: rect.left });
  };

  const open = () => {
    place();
    setIsOpen(true);
  };

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [isOpen]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-describedby={isOpen ? panelId : undefined}
        aria-expanded={isOpen}
        onClick={() => (isOpen ? setIsOpen(false) : open())}
        onMouseEnter={open}
        onMouseLeave={() => setIsOpen(false)}
        onFocus={open}
        onBlur={() => setIsOpen(false)}
        className="cursor-help border-0 bg-transparent p-0 text-inherit underline decoration-dotted decoration-white/30 underline-offset-2 transition-colors hover:decoration-gold focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold/50"
      >
        {children ?? entry.term}
      </button>
      {isOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            id={panelId}
            role="tooltip"
            className="pointer-events-none fixed z-[3000] max-w-xs rounded-xl border border-white/10 bg-[#0a0a0f] px-3 py-2 shadow-2xl"
            style={{ top: coords.top, left: coords.left }}
          >
            <p className="text-xs font-bold uppercase tracking-widest text-gold/80">
              {entry.term}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-white/75">
              {entry.short}
            </p>
          </div>,
          document.body,
        )}
    </>
  );
}

export default GlossaryTerm;
