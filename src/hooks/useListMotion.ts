import { useLayoutEffect, useRef, type RefObject } from 'react';
import { prefersReducedMotion } from '../utils/viewTransition';

const GLIDE = 'cubic-bezier(0.32, 0.72, 0, 1)';
const canAnimate = (el: HTMLElement | null): el is HTMLElement =>
  Boolean(el?.animate) && !prefersReducedMotion();

// Each item's top, measured from the list's own top so that scrolling doesn't count as moving.
function positions(root: HTMLElement | null) {
  const tops = new Map<string, number>();
  if (!root) return tops;
  const origin = root.getBoundingClientRect().top;
  for (const el of root.querySelectorAll<HTMLElement>('[data-motion-id]')) {
    tops.set(el.dataset.motionId!, el.getBoundingClientRect().top - origin);
  }
  return tops;
}

/** Grows an item open from nothing, e.g. a row just added. */
export function growIn(el: HTMLElement) {
  if (!canAnimate(el)) return;
  const style = getComputedStyle(el);
  const open = {
    height: `${el.offsetHeight}px`,
    paddingTop: style.paddingTop,
    paddingBottom: style.paddingBottom,
    opacity: 1,
  };
  el.style.overflow = 'hidden';
  const closed = { height: '0px', paddingTop: '0px', paddingBottom: '0px', opacity: 0 };
  el.animate([closed, open], { duration: 420, easing: GLIDE }).finished.then(
    () => el.style.removeProperty('overflow'),
    () => el.style.removeProperty('overflow'),
  );
}

/** Folds an item away; resolves once it's gone from view, so it can then be removed. */
export function collapseAway(el: HTMLElement | null): Promise<void> {
  if (!canAnimate(el)) return Promise.resolve();
  const style = getComputedStyle(el);
  el.style.overflow = 'hidden';
  el.style.pointerEvents = 'none';
  const open = {
    height: `${el.offsetHeight}px`,
    paddingTop: style.paddingTop,
    paddingBottom: style.paddingBottom,
    opacity: 1,
  };
  const closed = { height: '0px', paddingTop: '0px', paddingBottom: '0px', opacity: 0 };
  return el
    .animate([open, closed], { duration: 300, easing: GLIDE, fill: 'forwards' })
    .finished.then(
      () => {},
      () => {},
    );
}

/**
 * Motion for an editable list whose items carry data-motion-id: reordered items glide from
 * where they were, and added ones grow in. Call beforeMove() just before a reorder, and
 * willAdd(id) when adding.
 */
export function useListMotion(container: RefObject<HTMLElement | null>) {
  const before = useRef<Map<string, number> | null>(null);
  const added = useRef(new Set<string>());

  useLayoutEffect(() => {
    const was = before.current;
    const fresh = added.current;
    if (!was && fresh.size === 0) return;
    before.current = null;
    added.current = new Set();
    const root = container.current;
    if (!canAnimate(root)) return;

    const now = positions(root);
    for (const el of root.querySelectorAll<HTMLElement>('[data-motion-id]')) {
      const id = el.dataset.motionId!;
      if (fresh.has(id)) {
        growIn(el);
        continue;
      }
      const from = was?.get(id);
      const to = now.get(id);
      if (from === undefined || to === undefined || Math.abs(from - to) < 1) continue;
      el.animate([{ transform: `translateY(${from - to}px)` }, { transform: 'none' }], {
        duration: 480,
        easing: GLIDE,
      });
    }
  });

  return {
    beforeMove: () => {
      before.current = positions(container.current);
    },
    willAdd: (id: string) => {
      added.current.add(id);
    },
  };
}
