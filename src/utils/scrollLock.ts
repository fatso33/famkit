import { transitionFinished } from './viewTransition';

// Locks held at once (a photo closing as another opens), so the first to go doesn't unlock
// the page under the second.
let locks = 0;

/**
 * Stops the page scrolling behind something shown over it (the photo viewer). The returned
 * function lets go of it, but only once the page transition under way has finished: WebKit's
 * page process crashed when the page became scrollable again in the middle of a view transition
 * (closing a photo). Each lock lets go once, however often the function is called.
 */
export function lockPageScroll(): () => void {
  locks++;
  document.body.style.overflow = 'hidden';
  let held = true;
  return () => {
    if (!held) return;
    held = false;
    void transitionFinished().then(() => {
      locks--;
      if (locks === 0) document.body.style.overflow = '';
    });
  };
}
