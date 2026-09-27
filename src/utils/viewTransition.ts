import { flushSync } from 'react-dom';

/**
 * How a view change moves, read by the `::view-transition` rules in index.css:
 * - forward: into a sub-page (a recipe, Settings), which slides in from the right
 * - back: out of one, sliding back to the left
 * - fade: between main pages, or pages at the same depth
 * - zoom: a photo opening over the page, or closing
 */
export type NavMotion = 'forward' | 'back' | 'fade' | 'zoom';

/**
 * A photo that morphs between its old and new place: a recipe card's photo and the
 * recipe's hero, or a step photo and the full-screen viewer.
 */
export type Morph = 'recipe' | 'photo';

interface Options {
  motion: NavMotion;
  morph?: Morph;
  /** False when the browser already animated it (the iOS back swipe draws its own). */
  animated?: boolean;
}

let current: ViewTransition | null = null;

/**
 * Runs a React state change as an animated view transition where the browser supports
 * one; elsewhere the change simply happens. The update is flushed synchronously so the
 * browser snapshots the new view, not a half-rendered one.
 */
export function transitionView(update: () => void, { motion, morph, animated = true }: Options) {
  if (!animated || !document.startViewTransition) {
    update();
    return;
  }
  const root = document.documentElement;
  root.dataset.nav = motion;
  if (morph) root.dataset.morph = morph;
  else delete root.dataset.morph;

  const transition = document.startViewTransition(() => flushSync(update));
  current = transition;
  const cleanUp = () => {
    // A newer transition skips this one; its markers belong to the newer one now.
    if (current !== transition) return;
    current = null;
    delete root.dataset.nav;
    delete root.dataset.morph;
  };
  void transition.finished.then(cleanUp, cleanUp);
}

/** Whether any of the element is on screen, so a morph to or from it would be seen. */
export function isOnScreen(el: Element | null): boolean {
  if (!el) return false;
  const rect = el.getBoundingClientRect();
  return rect.bottom > 0 && rect.top < window.innerHeight && rect.width > 0;
}
