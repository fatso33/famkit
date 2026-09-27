import { useEffect, useRef } from 'react';
import type React from 'react';

const isEditable = (el: EventTarget | null) =>
  el instanceof HTMLElement &&
  (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));

// Open dialogs, oldest first. Escape closes only the topmost, so a sheet opened over the
// recipe editor closes on its own instead of taking the editor with it.
const openDialogs: symbol[] = [];

/**
 * Standard modal dismissal for dialogs that are mounted only while open.
 * - Escape closes the topmost dialog, except while typing in a field (Escape there often just
 *   dismisses browser autocomplete, and closing would throw away unsaved input).
 * - Spread the returned props on backdrop elements: they close only when the press
 *   both started and ended on that element. A click fires on the common ancestor of
 *   mousedown/mouseup, so drag-selecting text out of an input onto the backdrop, or
 *   ending a pan drag there, must not count.
 */
export function useDialogDismiss(onClose: () => void) {
  const pressStart = useRef<EventTarget | null>(null);

  // Registered once per opening (not per onClose change), so its place in the stack is stable.
  const token = useRef<symbol | null>(null);
  useEffect(() => {
    const own = Symbol('dialog');
    token.current = own;
    openDialogs.push(own);
    return () => {
      openDialogs.splice(openDialogs.indexOf(own), 1);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || e.isComposing) return;
      if (isEditable(e.target)) return;
      if (openDialogs[openDialogs.length - 1] !== token.current) return;
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
