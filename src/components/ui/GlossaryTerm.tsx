import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { GLOSSARY, type GlossaryKey } from "../../lib/glossary";

interface GlossaryTermProps {
  /** Glossary key, e.g. "tithi". Typed so a typo is a compile error. */
  k: GlossaryKey;
  /** Visible label. Defaults to the glossary entry's display term. */
  children?: React.ReactNode;
}

/** Widest the panel gets; on a phone it shrinks to the screen minus gutters. */
const PANEL_MAX_WIDTH = 320;
/** Matches the app's 16px side gutter, so the panel never touches an edge. */
const GUTTER = 16;
const GAP = 6;
/** Rough panel height, used only to decide whether to open upwards. */
const PANEL_EST_HEIGHT = 140;

type Placement = { top?: number; bottom?: number; left: number; width: number };
type OpenedBy = "hover" | "focus" | "click";

/**
 * An inline term that reveals its plain-English definition.
 *
 * Deliberately a <button>, not a <span>: a tooltip that only responds to hover
 * is invisible to keyboard and touch users, which is the usual way this pattern
 * is shipped broken. Mouse hover previews it, keyboard focus opens it, a tap or
 * click pins it open (tap again, tap elsewhere or press Escape to close). The
 * panel renders through a portal so a card's `overflow` cannot clip it, and is
 * clamped inside the viewport so it stays readable on a 375px phone.
 */
export function GlossaryTerm({ k, children }: GlossaryTermProps) {
  const entry = GLOSSARY[k];
  const [isOpen, setIsOpen] = useState(false);
  const [placement, setPlacement] = useState<Placement>({
    top: 0,
    left: 0,
    width: PANEL_MAX_WIDTH,
  });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const openedByRef = useRef<OpenedBy>("hover");
  const panelId = `glossary-${useId()}`;

  const place = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const width = Math.min(PANEL_MAX_WIDTH, viewportWidth - GUTTER * 2);
    const left = Math.max(
      GUTTER,
      Math.min(rect.left, viewportWidth - width - GUTTER),
    );
    const spaceBelow = viewportHeight - rect.bottom;
    if (spaceBelow < PANEL_EST_HEIGHT && rect.top > spaceBelow) {
      setPlacement({ bottom: viewportHeight - rect.top + GAP, left, width });
    } else {
      setPlacement({ top: rect.bottom + GAP, left, width });
    }
  }, []);

  const open = (by: OpenedBy) => {
    openedByRef.current = by;
    place();
    setIsOpen(true);
  };
  const close = () => setIsOpen(false);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };
    // iOS Safari never focuses a tapped button, so blur alone can't close a
    // tapped-open panel: any press outside the term closes it.
    const onPointerDown = (event: PointerEvent) => {
      if (!triggerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [isOpen, place]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-describedby={isOpen ? panelId : undefined}
        aria-expanded={isOpen}
        // A tap fires focus and then click; only a click on an already
        // click-pinned panel closes it, so a single tap always opens.
        onClick={() =>
          isOpen && openedByRef.current === "click" ? close() : open("click")
        }
        onPointerEnter={(event) => {
          if (event.pointerType === "mouse" && !isOpen) open("hover");
        }}
        onPointerLeave={(event) => {
          if (event.pointerType === "mouse" && openedByRef.current === "hover")
            close();
        }}
        onFocus={() => {
          if (!isOpen) open("focus");
        }}
        onBlur={close}
        className="cursor-help border-0 bg-transparent p-0 text-inherit underline decoration-dotted decoration-gold/60 decoration-1 underline-offset-[3px] transition-colors hover:decoration-gold focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold/50"
      >
        {children ?? entry.term}
      </button>
      {isOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            id={panelId}
            role="tooltip"
            className="pointer-events-none fixed z-[3000] rounded-xl border border-white/15 bg-[#0a0a0f] px-3.5 py-2.5 text-left shadow-2xl"
            style={{
              top: placement.top,
              bottom: placement.bottom,
              left: placement.left,
              width: placement.width,
            }}
          >
            <p className="text-xs font-bold uppercase tracking-widest text-gold/80">
              {entry.term}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-white/80">
              {entry.short}
            </p>
          </div>,
          document.body,
        )}
    </>
  );
}

export default GlossaryTerm;
