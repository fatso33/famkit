import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import {
  prefersReducedMotion,
  recipePhotoLandsIn,
  transitionStarted,
} from '../utils/viewTransition';
import {
  ROLL_UP_EASING,
  UNROLL_EASING,
  revealKeyframes,
  rollKeyframes,
  rollUpDuration,
  unrollDuration,
} from '../utils/unroll';

// Once the unroll is this far along, what follows it (the back button) starts appearing.
const FOLLOW_ON = 0.72;
// Animations stall while the page renders no frames (e.g. the phone was locked mid-roll), so
// leaving never waits longer than this.
const ROLL_UP_TIMEOUT_MS = 900;

interface Parts {
  /** The photo the recipe unrolls from. */
  photo: RefObject<HTMLElement | null>;
  /** Everything under the photo. */
  body: RefObject<HTMLElement | null>;
  /** The roll that travels down the page. */
  roll: RefObject<HTMLElement | null>;
}

/**
 * Unrolls the recipe down out of its photo once, as the page opens (after the photo lands,
 * when it morphs in from a card), and calls onUnrolled as it finishes. rollUp() plays it back
 * up into the photo and resolves when done, or returns null where nothing would animate.
 */
export function useUnroll({ photo, body, roll }: Parts, onUnrolled: () => void) {
  const unrolling = useRef<{ reveal: Animation; roll: Animation; cue: Animation } | null>(null);
  const distance = useRef(0);
  const latestOnUnrolled = useRef(onUnrolled);
  useEffect(() => {
    latestOnUnrolled.current = onUnrolled;
  });

  // A layout effect, so the recipe is already hidden when the browser snapshots the new page.
  useLayoutEffect(() => {
    const bodyEl = body.current;
    const rollEl = roll.current;
    if (!bodyEl?.animate || !rollEl || prefersReducedMotion()) {
      latestOnUnrolled.current();
      return;
    }
    const { top, bottom } = measure(photo.current, bodyEl);
    const to = Math.max(0, window.innerHeight - top);
    distance.current = to;
    const duration = unrollDuration(to - bottom);
    const timing = { duration, easing: UNROLL_EASING, fill: 'backwards' } as const;
    const parts = {
      reveal: bodyEl.animate(revealKeyframes(bottom, to), timing),
      roll: rollEl.animate(rollKeyframes(bottom, to, bottom), timing),
      // No keyframes: it only marks the moment the back button should start to appear.
      cue: bodyEl.animate([], { duration: duration * FOLLOW_ON }),
    };
    const all = Object.values(parts);
    for (const animation of all) animation.pause();
    unrolling.current = parts;

    let cancelled = false;
    void transitionStarted().then(() => {
      if (cancelled) return;
      try {
        // Hold until the photo has (nearly) landed, then unroll from under it.
        // A start time on the timeline, not play(), which would rewind a wait to no wait.
        const start = Number(document.timeline?.currentTime ?? 0) + recipePhotoLandsIn();
        for (const animation of all) animation.startTime = start;
      } catch (err) {
        // The recipe must never stay hidden: unroll it now, untimed.
        console.warn('Could not time the recipe unroll to the photo; unrolling now:', err);
        for (const animation of all) animation.play();
      }
    });
    parts.cue.finished.then(
      () => latestOnUnrolled.current(),
      () => {}, // Cancelled: the page is leaving before it finished opening.
    );
    return () => {
      cancelled = true;
      for (const animation of all) animation.cancel();
      unrolling.current = null;
    };
    // The page unrolls once, when it opens; the parts are fixed for its lifetime.
  }, [photo, body, roll]);

  const rollUp = (): Promise<void> | null => {
    const bodyEl = body.current;
    const rollEl = roll.current;
    if (!bodyEl?.animate || !rollEl || prefersReducedMotion()) return null;
    const { top, bottom } = measure(photo.current, bodyEl);

    // Roll up from wherever the paper's edge is now: mid-unroll, or the bottom of the screen.
    let from = window.innerHeight - top;
    const opening = unrolling.current;
    if (opening) {
      const progress = opening.reveal.effect?.getComputedTiming().progress;
      if (opening.reveal.playState !== 'finished' && typeof progress === 'number') {
        from = Math.min(from, bottom + (distance.current - bottom) * progress);
      } else if (opening.reveal.playState !== 'finished') {
        from = bottom; // Still waiting for the photo: nothing has unrolled yet.
      }
      for (const animation of Object.values(opening)) animation.cancel();
      unrolling.current = null;
    }
    // Scrolled down the recipe, the photo is off screen: roll up to the top of the screen.
    const to = Math.max(bottom, -top);
    from = Math.max(from, to);

    const timing = {
      duration: rollUpDuration(from - to),
      easing: ROLL_UP_EASING,
      fill: 'forwards', // Stays rolled up for the snapshot of the page it leaves.
    } as const;
    const reveal = bodyEl.animate(revealKeyframes(from, to), timing);
    rollEl.animate(rollKeyframes(from, to, bottom), timing);
    return new Promise((resolve) => {
      const timeout = window.setTimeout(resolve, ROLL_UP_TIMEOUT_MS);
      const done = () => {
        window.clearTimeout(timeout);
        resolve();
      };
      reveal.finished.then(done, done);
    });
  };

  return { rollUp };
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
