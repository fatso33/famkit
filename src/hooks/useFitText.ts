import { useLayoutEffect, type RefObject } from 'react';
import { fitScale } from '../utils/fitText';

/**
 * Shrinks an element's text only where it doesn't fit: at large text on a narrow phone, so its
 * widest word fits the line whole rather than breaking or running off the side of the screen
 * (Peter's call). Sets --fit on the element (index.css multiplies its font sizes by it), left
 * unset where everything fits. `needed` measures how wide the widest unbreakable part is at full
 * size, from layout (not transforms, which an entrance may be playing). Measured again when the
 * element changes size (text size, rotation), whenever a font finishes loading, and when `text`
 * changes. (A font arriving widens the words without resizing the element, and `fonts.ready`
 * can resolve before a font has even started loading: measured only then, the greeting kept the
 * fallback font's narrower words and ran off the screen.)
 */
export function useFitText<T extends HTMLElement>(
  ref: RefObject<T | null>,
  needed: (el: T) => number,
  text: string,
) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      el.style.removeProperty('--fit');
      const style = getComputedStyle(el);
      const available =
        el.clientWidth -
        parseFloat(style.paddingLeft || '0') -
        parseFloat(style.paddingRight || '0');
      const scale = fitScale(available, needed(el));
      if (scale < 1) el.style.setProperty('--fit', String(scale));
    };
    fit();
    // A frame later, so resizing the text here isn't reported as a resize within the observer's
    // own callback.
    let frame = 0;
    const later = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(fit);
    };
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(later);
    observer?.observe(el);
    let live = true;
    void document.fonts?.ready.then(() => {
      if (live) fit();
    });
    document.fonts?.addEventListener?.('loadingdone', later);
    return () => {
      live = false;
      cancelAnimationFrame(frame);
      observer?.disconnect();
      document.fonts?.removeEventListener?.('loadingdone', later);
    };
  }, [ref, needed, text]);
}
