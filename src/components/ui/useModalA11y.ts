'use client';

import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Shared modal accessibility behaviour: traps Tab within the dialog while
 * open, closes on Escape, and returns focus to whatever triggered the modal
 * once it closes.
 *
 * Not a portal — these modals render inline in the page tree rather than into
 * document.body, so marking the rest of the page `inert` while open would
 * also inert the modal itself (it's a descendant, not a sibling, of the page
 * content). The Tab trap already stops keyboard users reaching the
 * background; the backdrop's z-index and full-viewport coverage already stop
 * pointer users. Full page-level `inert` would need the modals to render
 * through a portal first — a bigger change than this warrants on its own.
 */
export function useModalA11y(
  dialogRef: RefObject<HTMLElement | null>,
  isOpen: boolean,
  onClose: () => void
) {
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    triggerRef.current = document.activeElement as HTMLElement | null;

    const dialog = dialogRef.current;
    const firstFocusable = dialog?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    (firstFocusable ?? dialog)?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab' || !dialog) return;

      const items = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => el.offsetParent !== null
      );
      if (items.length === 0) return;

      const first = items[0];
      const last = items[items.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      triggerRef.current?.focus();
    };
  }, [isOpen, onClose, dialogRef]);
}
