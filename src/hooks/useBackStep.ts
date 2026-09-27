import { useEffect, useRef, type RefObject } from 'react';

/**
 * The phone's back gesture (and the browser's Back button) undoes the newest open step:
 * a sub-page over a main page, a photo over a recipe, and so on. The app has no URLs per
 * page, so each open step holds one history entry above the main page's. Going back pops
 * one, and its step closes itself. Closing a step through the app pops its entry too, so on
 * a main page history is back to where it started and one more back leaves the app as usual.
 */

type OnBack = (animated: boolean) => void;
// A step without onBack blocks the gesture, e.g. so a stray swipe can't discard a draft.
interface Step {
  onBack: RefObject<OnBack | null>;
}

// Open steps, oldest first. Their order is the order they opened in.
const steps: Step[] = [];
// Set while our own history.go() is on its way, so its popstate isn't taken for the user's.
let traversing = false;

const depthOf = (state: unknown): number =>
  typeof state === 'object' && state !== null && 'famkitDepth' in state
    ? Number(state.famkitDepth) || 0
    : 0;

/** Brings history in line with the open steps: one entry per step. */
function sync() {
  if (traversing) return;
  const depth = depthOf(window.history.state);
  if (depth < steps.length) {
    for (let d = depth + 1; d <= steps.length; d++) {
      window.history.pushState({ famkitDepth: d }, '');
    }
  } else if (depth > steps.length) {
    traversing = true;
    window.history.go(steps.length - depth);
  }
}

function handlePopState(e: PopStateEvent) {
  if (traversing) {
    traversing = false;
    // Steps may have opened or closed while the traversal was on its way.
    sync();
    return;
  }
  const top = steps.at(-1);
  // Forward, or back while nothing is open: just line history up again.
  if (!top || depthOf(e.state) >= steps.length) {
    sync();
    return;
  }
  const onBack = top.onBack.current;
  if (!onBack) {
    // Blocked: put the popped entry back and stay put.
    sync();
    return;
  }
  // Newer PopStateEvent field, missing from older browsers and TypeScript's DOM types.
  const { hasUAVisualTransition } = e as PopStateEvent & { hasUAVisualTransition?: boolean };
  // Closing the step unregisters it, which lines history up again.
  onBack(!hasUAVisualTransition);
}

// The app sets the scroll itself on every page change (App's navigateTo). Left to the
// browser, going back through our entries would also restore the scroll position saved with
// them, undoing the vault's remembered spot and jerking a photo morph mid-flight.
window.history.scrollRestoration = 'manual';

// A reload keeps our entries but starts with nothing open, so this entry is the base now.
// Entries left below it are lined up by sync() when back lands on them.
if (depthOf(window.history.state) > 0) window.history.replaceState(null, '');
window.addEventListener('popstate', handlePopState);

function useStep(active: boolean, onBack: OnBack | null) {
  const onBackRef = useRef(onBack);
  useEffect(() => {
    onBackRef.current = onBack;
  });

  useEffect(() => {
    if (!active) return;
    const step: Step = { onBack: onBackRef };
    steps.push(step);
    sync();
    return () => {
      steps.splice(steps.indexOf(step), 1);
      sync();
    };
  }, [active]);
}

/** While active, the back gesture calls onBack, which must close this step. */
export function useBackStep(active: boolean, onBack: OnBack) {
  useStep(active, onBack);
}

/** While mounted, the back gesture does nothing, so a stray swipe can't discard unsaved work. */
export function useBlockBack() {
  useStep(true, null);
}
