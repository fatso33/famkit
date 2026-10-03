import { useEffect, type RefObject } from 'react';
import { prefersReducedMotion } from '../utils/viewTransition';

interface Span {
  top: number;
  bottom: number;
}

/** Room left between the card and the edges of what's visible, in px. */
const MARGIN = 12;

/**
 * How far to scroll (px, + is down the page) so a card is seen whole between `visible.top` (under
 * the bar) and `visible.bottom` (above the keyboard). A card taller than that room keeps the
 * field being typed in seen instead. Nothing when it's already in view.
 */
export function liftAboveKeyboard(card: Span, field: Span, visible: Span): number {
  const top = visible.top + MARGIN;
  const bottom = visible.bottom - MARGIN;
  const shown = card.bottom - card.top <= bottom - top ? card : field;
  if (shown.bottom > bottom) return Math.min(shown.bottom - bottom, shown.top - top);
  if (shown.top < top) return shown.top - top;
  return 0;
}

const isTyping = (el: Element | null) =>
  el instanceof HTMLTextAreaElement ||
  (el instanceof HTMLInputElement && !['radio', 'checkbox', 'button'].includes(el.type));

function scrollerOf(el: HTMLElement): HTMLElement | null {
  for (let at = el.parentElement; at; at = at.parentElement) {
    if (/(auto|scroll)/.test(getComputedStyle(at).overflowY)) return at;
  }
  return null;
}

/**
 * Keeps a popover card in view: as it opens, and again whenever the phone's keyboard comes up
 * for one of its fields, so the keyboard never covers the card (its other fields, its Done). The
 * keyboard slides over the page without resizing it; the visual viewport says what's left.
 */
export function useAboveKeyboard(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const card = ref.current;
    const scroller = card && scrollerOf(card);
    if (!card || !scroller) return;
    let frame = 0;
    let check = 0;
    const fit = () => {
      cancelAnimationFrame(frame);
      clearTimeout(check);
      frame = requestAnimationFrame(() => {
        const viewport = window.visualViewport;
        const visibleTop = viewport?.offsetTop ?? 0;
        const visibleBottom = visibleTop + (viewport?.height ?? window.innerHeight);
        const box = scroller.getBoundingClientRect();
        const underBar = box.top + parseFloat(getComputedStyle(scroller).paddingTop);
        // Its height unscaled: it may still be springing open.
        const cardTop = card.getBoundingClientRect().top;
        const whole = { top: cardTop, bottom: cardTop + card.offsetHeight };
        const focused = document.activeElement;
        const field =
          focused instanceof HTMLElement && card.contains(focused) && isTyping(focused)
            ? focused.getBoundingClientRect()
            : whole;
        const by = liftAboveKeyboard(whole, field, {
          top: Math.max(underBar, visibleTop),
          bottom: Math.min(box.bottom, visibleBottom),
        });
        if (Math.abs(by) < 1) return;
        if (prefersReducedMotion()) {
          scroller.scrollBy({ top: by });
          return;
        }
        const from = scroller.scrollTop;
        scroller.scrollBy({ top: by, behavior: 'smooth' });
        // WebKit drops a glide begun just as a field takes focus: then it goes there at once.
        check = window.setTimeout(() => {
          if (Math.abs(scroller.scrollTop - from) < 1) scroller.scrollBy({ top: by });
        }, 250);
      });
    };
    fit();
    const viewport = window.visualViewport;
    viewport?.addEventListener('resize', fit);
    card.addEventListener('focusin', fit);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(check);
      viewport?.removeEventListener('resize', fit);
      card.removeEventListener('focusin', fit);
    };
  }, [ref]);
}
