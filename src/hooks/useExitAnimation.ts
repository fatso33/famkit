import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

// Longer than any exit animation (the longest is 0.3s).
const EXIT_TIMEOUT_MS = 1000;

// Exit keyframes in index.css are named fk-exit-*, so a layer waits for those alone and not,
// say, an endless loading pulse inside it.
const isExit = (animation: Animation) =>
  'animationName' in animation && String(animation.animationName).startsWith('fk-exit-');

/**
 * Plays a layer's exit animation before it unmounts, for layers mounted only while open.
 * requestClose() sets isClosing (render it as an `is-closing` class), the CSS runs its
 * fk-exit-* keyframes on the element behind `ref` or inside it, and onClose runs once they
 * end. Where nothing animates (old browsers, tests) it closes at once.
 */
export function useExitAnimation<T extends HTMLElement>(onClose: () => void) {
  const ref = useRef<T>(null);
  const [isClosing, setClosing] = useState(false);
  const closing = useRef(false);
  const alive = useRef(true);
  const latestOnClose = useRef(onClose);

  useEffect(() => {
    latestOnClose.current = onClose;
  });
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const requestClose = () => {
    if (closing.current) return;
    const el = ref.current;
    if (!el?.getAnimations) {
      latestOnClose.current();
      return;
    }
    closing.current = true;
    flushSync(() => setClosing(true));
    const exits = el.getAnimations({ subtree: true }).filter(isExit);
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      window.clearTimeout(safety);
      if (alive.current) latestOnClose.current();
    };
    // Animations stall while the page renders no frames (e.g. the app was backgrounded
    // mid-close), so the layer never waits longer than this to go.
    const safety = window.setTimeout(finish, EXIT_TIMEOUT_MS);
    // A cancelled animation (e.g. the layer was removed some other way) still closes.
    void Promise.all(exits.map((a) => a.finished)).then(finish, finish);
  };

  return { ref, isClosing, requestClose };
}
