import { useEffect, useRef } from 'react';

/**
 * ============================================================================
 * MODAL ACCESSIBILITY
 * ============================================================================
 * Focus trap + Escape to close + focus restoration.
 *
 * Neither modal had any of this. The VR viewer was the worst case: it covers
 * the entire viewport, so a keyboard user who opened it was trapped with no
 * way out — Escape did nothing and Tab wandered off behind the overlay.
 *
 * Usage:
 *   const ref = useModalA11y(onClose);
 *   <div className="modal-backdrop"><div ref={ref} role="dialog" aria-modal="true">
 * ============================================================================
 */
export function useModalA11y(onClose) {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    // Remember what had focus so we can give it back on close.
    const previouslyFocused = document.activeElement;

    const focusables = () =>
      Array.from(
        container.querySelectorAll(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => el.offsetParent !== null);

    // Move focus into the dialog so the next Tab stays inside it.
    const first = focusables()[0];
    (first || container).focus?.();

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose?.();
        return;
      }
      if (e.key !== 'Tab') return;

      const list = focusables();
      if (!list.length) return;

      const firstEl = list[0];
      const lastEl = list[list.length - 1];

      // Wrap around at both ends — that's what makes it a trap.
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);

    // Stop the page behind the modal scrolling.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  return containerRef;
}
