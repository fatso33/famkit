import { useEffect, useRef } from 'react';
import type React from 'react';

const isEditable = (el: EventTarget | null) =>
  el instanceof HTMLElement &&
  (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));

/**
 * Standard modal dismissal for dialogs that are mounted only while open.
 * - Escape closes, except while typing in a field (Escape there often just dismisses
 *   browser autocomplete, and closing would throw away unsaved input).
 * - Spread the returned props on backdrop elements: they close only when the press
 *   both started and ended on that element. A click fires on the common ancestor of
 *   mousedown/mouseup, so drag-selecting text out of an input onto the backdrop, or
 *   ending a pan drag there, must not count.
 */
export function useDialogDismiss(onClose: () => void) {
  const pressStart = useRef<EventTarget | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || e.isComposing) return;
      if (isEditable(e.target)) return;
      onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return {
    onMouseDown: (e: React.MouseEvent) => {
      pressStart.current = e.target;
    },
    onClick: (e: React.MouseEvent) => {
      if (e.target === e.currentTarget && pressStart.current === e.currentTarget) onClose();
    },
  };
}
