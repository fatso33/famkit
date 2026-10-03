import { useLayoutEffect, type RefObject } from 'react';

/** Space kept between a popover and the screen's edges, in px. */
const EDGE = 16;
/** Its gap from the mark it springs from, in px. */
const GAP = 10;

/**
 * Places a page popover (absolutely positioned in a full-width layer at the top of the page) by
 * the mark it springs from, before the first frame is drawn: under the mark, as near its middle
 * as the screen allows, or over it when there's no room below (the navigation island counts as
 * no room). Sets `--pop-origin-x` (where the mark's middle is, for the point and the spring) and
 * `data-side`. Placed once, so it scrolls with the page; placed again on resize.
 */
export function useAnchoredPlacement(
  anchor: HTMLElement,
  panelRef: RefObject<HTMLElement | null>,
): void {
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const place = () => {
      const mark = anchor.getBoundingClientRect();
      const width = panel.offsetWidth;
      const height = panel.offsetHeight;
      const middle = mark.left + mark.width / 2;
      const left = Math.min(
        Math.max(EDGE, middle - width / 2),
        document.documentElement.clientWidth - EDGE - width,
      );
      const island = document.querySelector('.nav-island')?.getBoundingClientRect();
      const floor = Math.min(window.innerHeight, island?.top ?? Infinity) - EDGE;
      const above = mark.bottom + GAP + height > floor && mark.top - GAP - height >= EDGE;
      const top = above ? mark.top - GAP - height : mark.bottom + GAP;
      panel.style.left = `${Math.round(left + window.scrollX)}px`;
      panel.style.top = `${Math.round(top + window.scrollY)}px`;
      panel.style.setProperty('--pop-origin-x', `${Math.round(middle - left)}px`);
      panel.dataset.side = above ? 'above' : 'below';
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [anchor, panelRef]);
}
