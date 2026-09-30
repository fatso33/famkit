import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import { prefersReducedMotion, transitionStarted } from '../utils/viewTransition';
import { UNROLL_EASING, revealKeyframes, rollKeyframes, unrollDuration } from '../utils/unroll';

// Once the unroll is this far along, what follows it starts appearing.
const FOLLOW_ON = 0.72;

interface Parts {
  /** The photo the recipe unrolls from. */
  photo: RefObject<HTMLElement | null>;
  /** Everything under the photo. */
  body: RefObject<HTMLElement | null>;
  /** The roll that travels down the page. */
  roll: RefObject<HTMLElement | null>;
}

/**
 * Unrolls the recipe down out of its photo once, as the page opens, and calls onUnrolled as it
 * finishes. Off (`enabled` false), the page shows whole and onUnrolled is never called: the
 * recipe opened from the Recipe Box unfolds from its card instead (the flip motions).
 */
export function useUnroll({ photo, body, roll }: Parts, onUnrolled: () => void, enabled = true) {
  const latestOnUnrolled = useRef(onUnrolled);
  useEffect(() => {
    latestOnUnrolled.current = onUnrolled;
  });

  // A layout effect, so the recipe is already hidden when the browser paints the new page.
  useLayoutEffect(() => {
    if (!enabled) return;
    const bodyEl = body.current;
    const rollEl = roll.current;
    if (!bodyEl?.animate || !rollEl || prefersReducedMotion()) {
      latestOnUnrolled.current();
      return;
    }
    const { top, bottom } = measure(photo.current, bodyEl);
    const to = Math.max(0, window.innerHeight - top);
    const duration = unrollDuration(to - bottom);
    const timing = { duration, easing: UNROLL_EASING, fill: 'backwards' } as const;
    const all = [
      bodyEl.animate(revealKeyframes(bottom, to), timing),
      rollEl.animate(rollKeyframes(bottom, to, bottom), timing),
    ];
    // No keyframes: it only marks the moment what follows should start to appear.
    const cue = bodyEl.animate([], { duration: duration * FOLLOW_ON });
    all.push(cue);
    for (const animation of all) animation.pause();

    let cancelled = false;
    // Held until a page transition under way starts animating, so it unrolls in view.
    void transitionStarted().then(() => {
      if (!cancelled) for (const animation of all) animation.play();
    });
    cue.finished.then(
      () => latestOnUnrolled.current(),
      () => {}, // Cancelled: the page is leaving before it finished opening.
    );
    return () => {
      cancelled = true;
      for (const animation of all) animation.cancel();
    };
    // The page unrolls once, when it opens; the parts are fixed for its lifetime.
  }, [photo, body, roll, enabled]);
}

/**
 * Where the body starts on screen (`top`), and where the photo's bottom edge is in the body's
 * own coordinates (`bottom`, just above 0): the roll tucks away under it.
 */
function measure(photo: HTMLElement | null, body: HTMLElement) {
  const top = body.getBoundingClientRect().top;
  const photoBottom = photo?.getBoundingClientRect().bottom ?? top;
  return { top, bottom: Math.min(0, photoBottom - top) - 6 };
}
