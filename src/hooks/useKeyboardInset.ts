import { useEffect, type RefObject } from 'react';

/**
 * How much of the bottom of the window the on-screen keyboard covers, in px. On phones the
 * keyboard slides over the page without resizing it, so something docked to the bottom ends up
 * underneath; the visual viewport (what's actually visible) says by how much.
 */
export function keyboardInset(windowHeight: number, visibleHeight: number, visibleTop: number) {
  return Math.max(0, Math.round(windowHeight - visibleHeight - visibleTop));
}

/**
 * Keeps `--keyboard-inset` on the element at the height the keyboard covers, so a sheet docked
 * to the bottom can lift itself above it (index.css: .editor-sheet).
 */
export function useKeyboardInset(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const viewport = window.visualViewport;
    const el = ref.current;
    if (!viewport || !el) return;
    const update = () => {
      // Pinch-zooming also shrinks the visual viewport; that isn't a keyboard.
      const inset =
        viewport.scale > 1.01
          ? 0
          : keyboardInset(window.innerHeight, viewport.height, viewport.offsetTop);
      el.style.setProperty('--keyboard-inset', `${inset}px`);
    };
    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
    };
  }, [ref]);
}
