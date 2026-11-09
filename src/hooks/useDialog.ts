import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

function focusableIn(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) =>
      !el.hasAttribute("disabled") && el.getAttribute("aria-hidden") !== "true",
  );
}

/**
 * Modal dialog keyboard behaviour: Escape closes, Tab / Shift+Tab cycle inside
 * the dialog, the first focusable element is focused on open, and focus goes
 * back to whatever opened the dialog when it closes.
 *
 * `onClose` may be an inline arrow — it is read through a ref, so it never
 * re-runs the effect.
 */
export function useDialog(
  ref: RefObject<HTMLElement | null>,
  onClose: () => void,
  open = true,
) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const returnTo = document.activeElement as HTMLElement | null;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      const root = ref.current;
      if (e.key !== "Tab" || !root) return;
      const items = focusableIn(root);
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !root.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !root.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    // Wait a frame so entry animations have mounted the content.
    const timer = window.setTimeout(() => {
      const root = ref.current;
      if (!root || root.contains(document.activeElement)) return;
      const target = focusableIn(root)[0] ?? root;
      if (target === root && !root.hasAttribute("tabindex")) {
        root.setAttribute("tabindex", "-1");
      }
      target.focus();
    }, 50);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", handleKeyDown);
      if (returnTo && document.contains(returnTo)) returnTo.focus();
    };
  }, [open, ref]);
}
